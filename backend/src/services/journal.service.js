const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');
const db = require('../config/db');

class JournalService {
  /**
   * Creates a journal entry header and lines as a DRAFT.
   */
  static async createDraft({ companyId, userId, entryDate, description, reference, lines }) {
    if (!companyId) throw new Error('Company context required.');
    if (!lines || lines.length < 2) throw new Error('Journal entry must have at least 2 lines.');

    return await db.transaction(async (trx) => {
      const entryId = await JournalModel.createEntry({
        companyId,
        entryDate,
        description,
        reference,
        userId,
        status: 'DRAFT'
      }, trx);

      for (const line of lines) {
        await JournalModel.createLine({
          entryId,
          accountId: line.accountId,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null
        }, trx);
      }
      return entryId;
    });
  }

  /**
   * Updates an existing draft journal entry header and lines.
   */
  static async updateDraft(entryId, { companyId, entryDate, description, reference, lines }) {
    return await db.transaction(async (trx) => {
      const header = await trx('journal_entries').where({ id: entryId, company_id: companyId }).first();
      if (!header) throw new Error('Journal entry not found.');
      if (header.status !== 'DRAFT') throw new Error('Only draft entries can be updated.');

      await trx('journal_entries')
        .where({ id: entryId })
        .update({
          entry_date: entryDate,
          description,
          reference
        });

      // Clear existing lines and re-add updated lines
      await trx('journal_lines').where({ entry_id: entryId }).delete();
      
      for (const line of lines) {
        await JournalModel.createLine({
          entryId,
          accountId: line.accountId,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null
        }, trx);
      }
      return entryId;
    });
  }

  /**
   * Deletes (voids) an existing draft journal entry.
   */
  static async deleteDraft(entryId, companyId) {
    const header = await db('journal_entries').where({ id: entryId, company_id: companyId }).first();
    if (!header) throw new Error('Journal entry not found.');
    if (header.status !== 'DRAFT') throw new Error('Only draft entries can be voided.');

    await db('journal_entries').where({ id: entryId }).delete();
    return true;
  }

  /**
   * Backwards compatible entry creation (defaults to draft).
   */
  static async createJournalEntry({ companyId, userId, entryDate, description, lines, overrideControlWarning }) {
    return await this.createDraft({ companyId, userId, entryDate, description, lines });
  }

  /**
   * Posts a drafted journal entry (Updates ledgers and writes detailed logs)
   */
  static async postJournalEntry(entryId, companyId, userId, overrideControlWarning = false, trx = db) {
    const startTime = Date.now();
    const JournalValidationService = require('./journal_validation.service');
    
    const executePost = async (t) => {
      const header = await t('journal_entries').where({ id: entryId, company_id: companyId }).first();
      if (!header) throw new Error('Journal entry not found.');
      if (header.status === 'POSTED') return entryId;
      if (header.status === 'REVERSED') throw new Error('Cannot post a reversed journal entry.');

      const lines = await t('journal_lines').where('entry_id', entryId);
      const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);

      // Create initial posting log
      const [log] = await t('journal_posting_logs')
        .insert({
          company_id: companyId,
          journal_entry_id: entryId,
          user_id: userId,
          reference: header.reference || null,
          status: 'POSTING_STARTED',
          debit_total: totalDebit,
          credit_total: totalDebit,
          duration_ms: 0
        })
        .returning('id');
      const logId = typeof log === 'object' ? log.id : log;

      try {
        const journalData = {
          entryDate: header.entry_date,
          reference: header.reference,
          description: header.description,
          lines: lines.map(l => ({ 
            accountId: l.account_id, 
            debit: l.debit, 
            credit: l.credit,
            department: l.department,
            project: l.project,
            branch: l.branch
          }))
        };

        await t('journal_posting_logs').where({ id: logId }).update({ status: 'VALIDATING_PERIOD' });
        await JournalValidationService.validatePeriod(companyId, journalData.entryDate, t);

        await t('journal_posting_logs').where({ id: logId }).update({ status: 'VALIDATING_ACCOUNTS' });
        await JournalValidationService.validateAccounts(companyId, journalData.lines, t);
        await JournalValidationService.validateControlAccounts(companyId, journalData.lines, overrideControlWarning, t);
        JournalValidationService.validateBalance(journalData.lines);
        
        // Budget Validation
        await JournalValidationService.validateBudget(companyId, entryId, journalData, t);
        
        if (header.reference) {
          const exists = await t('journal_entries')
            .where({ company_id: companyId })
            .andWhereRaw('LOWER(reference) = ?', [header.reference.trim().toLowerCase()])
            .andWhereNot({ id: entryId })
            .first();
          if (exists) {
            throw new Error(`A journal entry with reference '${header.reference}' already exists.`);
          }
        }

        await t('journal_posting_logs').where({ id: logId }).update({ status: 'UPDATING_LEDGER' });
        for (const line of lines) {
          await AccountModel.updateBalance(line.account_id, companyId, line.debit, line.credit, t);
        }

        await t('journal_entries').where({ id: entryId }).update({ status: 'POSTED' });

        // Commit actual budget spend
        const BudgetService = require('./budget.service');
        await BudgetService.commitActualSpend('JOURNAL', entryId, companyId, journalData.entryDate, journalData.lines, t);

        // Trigger notification
        try {
          const NotificationService = require('./notification.service');
          const totalAmount = journalData.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
          await NotificationService.notify({
            eventCode: 'JOURNAL_POSTED',
            companyId,
            payload: {
              id: entryId,
              reference: header.reference || 'N/A',
              amount: totalAmount
            },
            entityType: 'journal',
            entityId: entryId
          });
        } catch (notifErr) {
          console.error('[NOTIFY JOURNAL POSTED ERROR]', notifErr);
        }

        // Audit Log
        await t('transaction_audit_logs').insert({
          company_id: companyId,
          action: 'POST',
          user_id: userId,
          description: `Posted Journal Entry #${entryId} (Ref: ${header.reference || 'N/A'})`
        });

        const duration = Date.now() - startTime;
        await t('journal_posting_logs')
          .where({ id: logId })
          .update({
            status: 'POSTED',
            duration_ms: duration
          });

        return true;
      } catch (err) {
        const duration = Date.now() - startTime;
        try {
          await db('journal_posting_logs')
            .where({ id: logId })
            .update({
              status: 'ROLLBACK',
              error_message: err.message,
              duration_ms: duration
            });
        } catch (logErr) {
          console.error('[LOG ERROR]', logErr.message);
        }
        throw err;
      }
    };

    if (trx === db) {
      return await db.transaction(executePost);
    } else {
      return await executePost(trx);
    }
  }
}

module.exports = JournalService;
