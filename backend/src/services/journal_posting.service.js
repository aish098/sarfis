const db = require('../config/db');
const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');
const JournalValidationService = require('./journal_validation.service');

class JournalPostingService {
  /**
   * Posts a journal entry directly to the General Ledger.
   * Runs validations, creates header/lines, updates ledger balances, and logs detailed stages.
   */
  static async post(companyId, journalData, userId, overrideControlWarning) {
    const startTime = Date.now();
    const { entryDate, reference, description, lines } = journalData;
    const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);

    // 1. Create the initial posting log
    const [log] = await db('journal_posting_logs')
      .insert({
        company_id: companyId,
        user_id: userId,
        reference: reference || null,
        status: 'POSTING_STARTED',
        debit_total: totalDebit,
        credit_total: totalDebit,
        duration_ms: 0
      })
      .returning('id');
    const logId = typeof log === 'object' ? log.id : log;

    try {
      // 2. Step-by-Step Validation Stages
      await db('journal_posting_logs').where({ id: logId }).update({ status: 'VALIDATING_PERIOD' });
      await JournalValidationService.validatePeriod(companyId, entryDate, db);

      await db('journal_posting_logs').where({ id: logId }).update({ status: 'VALIDATING_ACCOUNTS' });
      await JournalValidationService.validateAccounts(companyId, lines, db);
      await JournalValidationService.validateControlAccounts(companyId, lines, overrideControlWarning, db);
      JournalValidationService.validateBalance(lines);
      await JournalValidationService.validateReference(companyId, reference, db);

      let createdEntryId = null;

      // 3. Database Transaction for Core Integrity
      await db.transaction(async (trx) => {
        // Create entry header
        await trx('journal_posting_logs').where({ id: logId }).update({ status: 'CREATING_HEADER' });
        createdEntryId = await JournalModel.createEntry({
          companyId,
          entryDate,
          description: description || 'Journal Entry',
          reference: reference || null,
          status: 'POSTED',
          userId
        }, trx);

        // Create entry lines
        await trx('journal_posting_logs').where({ id: logId }).update({ status: 'CREATING_LINES' });
        for (const line of lines) {
          await JournalModel.createLine({
            entryId: createdEntryId,
            accountId: line.accountId,
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0
          }, trx);
        }

        // Update accounts ledger balances
        await trx('journal_posting_logs').where({ id: logId }).update({ status: 'UPDATING_LEDGER' });
        for (const line of lines) {
          await AccountModel.updateBalance(line.accountId, companyId, parseFloat(line.debit) || 0, parseFloat(line.credit) || 0, trx);
        }

        // Insert core transaction audit log
        await trx('transaction_audit_logs').insert({
          company_id: companyId,
          action: 'POST',
          user_id: userId,
          description: `Posted Journal Entry #${createdEntryId} (Ref: ${reference || 'N/A'})`
        });

        // Update log to completed POSTED state
        const duration = Date.now() - startTime;
        await trx('journal_posting_logs')
          .where({ id: logId })
          .update({
            journal_entry_id: createdEntryId,
            status: 'POSTED',
            duration_ms: duration
          });
      });

      return createdEntryId;

    } catch (err) {
      const duration = Date.now() - startTime;
      await db('journal_posting_logs')
        .where({ id: logId })
        .update({
          status: err.isControlWarning ? 'VALIDATION_FAILED' : 'ROLLBACK',
          error_message: err.message,
          duration_ms: duration
        });
      throw err;
    }
  }

  /**
   * Reverses a posted journal entry.
   * Generates a counter-balancing journal entry, link entries together, and logs results.
   */
  static async reverse(entryId, companyId, userId, reversalReason) {
    const startTime = Date.now();
    let logId = null;

    try {
      const originalHeader = await JournalModel.getEntryHeader(entryId, companyId);
      if (!originalHeader) throw new Error('Original journal entry not found.');
      if (originalHeader.status !== 'POSTED') {
        throw new Error('Only posted journal entries can be reversed.');
      }
      if (originalHeader.reversed_by_id) {
        throw new Error('This journal entry has already been reversed.');
      }
      if (!reversalReason || reversalReason.trim() === '') {
        throw new Error('A reversal reason is required.');
      }

      // Initialize the reversal log record
      const [log] = await db('journal_posting_logs')
        .insert({
          company_id: companyId,
          journal_entry_id: entryId,
          user_id: userId,
          reference: originalHeader.reference ? `REV-${originalHeader.reference}` : null,
          status: 'POSTING_STARTED',
          debit_total: 0,
          credit_total: 0,
          duration_ms: 0
        })
        .returning('id');
      logId = typeof log === 'object' ? log.id : log;

      await db.transaction(async (trx) => {
        // Fetch lines of the original entry
        const originalLines = await JournalModel.getEntryLines(entryId);
        if (originalLines.length === 0) {
          throw new Error('Original journal entry has no lines.');
        }

        let totalAmount = 0;
        const reversalLines = originalLines.map(line => {
          const debit = parseFloat(line.credit) || 0;
          const credit = parseFloat(line.debit) || 0;
          totalAmount += debit;
          return {
            accountId: line.account_id,
            debit,
            credit,
            department: line.department,
            project: line.project,
            branch: line.branch
          };
        });

        // Insert new Reversal Journal Header
        await trx('journal_posting_logs').where({ id: logId }).update({ status: 'CREATING_HEADER' });
        const reversalEntryId = await JournalModel.createEntry({
          companyId,
          entryDate: new Date(),
          description: `Reversal of JE #${originalHeader.id} - Reason: ${reversalReason}`,
          reference: originalHeader.reference ? `REV-${originalHeader.reference}` : `REV-${originalHeader.id}`,
          reversalOfId: originalHeader.id,
          reversalReason,
          status: 'POSTED',
          userId
        }, trx);

        // Insert reversal lines
        await trx('journal_posting_logs').where({ id: logId }).update({ status: 'CREATING_LINES' });
        for (const line of reversalLines) {
          await JournalModel.createLine({
            entryId: reversalEntryId,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            department: line.department,
            project: line.project,
            branch: line.branch
          }, trx);
        }

        // Invert balances and update ledger
        await trx('journal_posting_logs').where({ id: logId }).update({ status: 'UPDATING_LEDGER' });
        for (const line of reversalLines) {
          await AccountModel.updateBalance(line.accountId, companyId, line.debit, line.credit, trx);
        }

        // Commit budget reversal spend actuals (offsets the original budget consumption)
        const BudgetService = require('./budget.service');
        await BudgetService.commitActualSpend('JOURNAL', reversalEntryId, companyId, new Date(), reversalLines, trx);

        // Link original journal entry
        await trx('journal_entries')
          .where({ id: originalHeader.id })
          .update({ reversed_by_id: reversalEntryId, status: 'REVERSED' });

        // Add to general audit logs
        await trx('transaction_audit_logs').insert({
          company_id: companyId,
          action: 'POST',
          user_id: userId,
          description: `Reversed Journal Entry #${originalHeader.id} with Reversal Entry #${reversalEntryId}`
        });

        // Complete reversal log
        const duration = Date.now() - startTime;
        await trx('journal_posting_logs')
          .where({ id: logId })
          .update({
            journal_entry_id: reversalEntryId,
            status: 'REVERSED',
            debit_total: totalAmount,
            credit_total: totalAmount,
            duration_ms: duration
          });
      });

    } catch (err) {
      const duration = Date.now() - startTime;
      if (logId) {
        await db('journal_posting_logs')
          .where({ id: logId })
          .update({
            status: 'ROLLBACK',
            error_message: err.message,
            duration_ms: duration
          });
      }
      throw err;
    }
  }
}

module.exports = JournalPostingService;
