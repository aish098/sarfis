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

        if (header.correction_of_entry_id) {
          await t('journal_entries')
            .where({ id: header.correction_of_entry_id, company_id: companyId })
            .update({ superseded_by_document_id: entryId });
        }

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

  /**
   * Requests correction for a posted Journal Entry
   */
  static async requestCorrection({ companyId, userId, entryId, reasonCode, reasonText }) {
    if (!reasonCode || !reasonText || reasonText.trim().length < 5) {
      throw new Error('A valid reason code and explanation (at least 5 characters) is required.');
    }

    return await db.transaction(async (trx) => {
      const header = await trx('journal_entries').where({ id: entryId, company_id: companyId }).forUpdate().first();
      if (!header) throw new Error('Journal entry not found.');
      if (header.status !== 'POSTED') {
        const err = new Error('Only posted journal entries can request a correction.');
        err.statusCode = 409;
        throw err;
      }
      if (header.is_reversed) {
        const err = new Error('This journal entry has already been reversed.');
        err.statusCode = 409;
        throw err;
      }

      // Check for active correction request
      const activeReq = await trx('document_correction_requests')
        .where({ company_id: companyId, document_type: 'JOURNAL', document_id: entryId })
        .whereIn('status', ['PENDING_APPROVAL', 'APPROVED', 'EXECUTING'])
        .first();

      if (activeReq) {
        const err = new Error('An active correction request already exists for this journal entry.');
        err.statusCode = 409;
        throw err;
      }

      const [inserted] = await trx('document_correction_requests')
        .insert({
          company_id: companyId,
          document_type: 'JOURNAL',
          document_id: entryId,
          reason_code: reasonCode,
          reason_text: reasonText.trim(),
          requested_by: userId,
          status: 'PENDING_APPROVAL'
        })
        .returning('id');

      const requestId = typeof inserted === 'object' ? inserted.id : inserted;

      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'CORRECTION_REQUESTED',
        user_id: userId,
        description: `Requested correction for Journal #${entryId} (Reason: [${reasonCode}] ${reasonText})`
      });

      return requestId;
    });
  }

  /**
   * Approves a posted Journal correction request
   */
  static async approveCorrectionRequest({ companyId, userId, requestId, allowSelfApproval = false }) {
    return await db.transaction(async (trx) => {
      const req = await trx('document_correction_requests')
        .where({ id: requestId, company_id: companyId, document_type: 'JOURNAL' })
        .forUpdate()
        .first();

      if (!req) throw new Error('Correction request not found.');
      if (req.status !== 'PENDING_APPROVAL') {
        const err = new Error(`Cannot approve correction request in '${req.status}' state.`);
        err.statusCode = 409;
        throw err;
      }

      // Segregation of duties enforcement
      if (!allowSelfApproval && parseInt(req.requested_by, 10) === parseInt(userId, 10)) {
        const err = new Error('SEGREGATION_OF_DUTIES: Requisition requester cannot approve their own correction request.');
        err.statusCode = 403;
        throw err;
      }

      await trx('document_correction_requests')
        .where({ id: requestId })
        .update({
          status: 'APPROVED',
          approved_by: userId,
          approved_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

      return true;
    });
  }

  /**
   * Rejects a posted Journal correction request
   */
  static async rejectCorrectionRequest({ companyId, userId, requestId, rejectionReason }) {
    return await db.transaction(async (trx) => {
      const req = await trx('document_correction_requests')
        .where({ id: requestId, company_id: companyId, document_type: 'JOURNAL' })
        .forUpdate()
        .first();

      if (!req) throw new Error('Correction request not found.');
      if (req.status !== 'PENDING_APPROVAL') {
        const err = new Error(`Cannot reject correction request in '${req.status}' state.`);
        err.statusCode = 409;
        throw err;
      }

      await trx('document_correction_requests')
        .where({ id: requestId })
        .update({
          status: 'REJECTED',
          rejected_by: userId,
          rejected_at: trx.fn.now(),
          rejection_reason: rejectionReason || 'Correction request denied by approver.',
          updated_at: trx.fn.now()
        });

      return true;
    });
  }

  /**
   * Executes an approved Journal Correction Request:
   * 1. Enforces execution idempotency & lock
   * 2. Validates period close & accounting dimensions
   * 3. Creates & posts Inverted Reversal Journal Entry via canonical posting engine
   * 4. Marks original journal entry is_reversed: true & sets correction_draft_id (Do NOT set superseded until posted!)
   * 5. Creates replacement Draft copy (setting correction_of_entry_id)
   * 6. Updates correction request status to EXECUTED
   */
  static async executeCorrectionRequest({ companyId, userId, requestId }) {
    try {
      return await db.transaction(async (trx) => {
        const req = await trx('document_correction_requests')
          .where({ id: requestId, company_id: companyId, document_type: 'JOURNAL' })
          .forUpdate()
          .first();

        if (!req) throw new Error('Correction request not found.');

        // Idempotent execution check
        if (req.status === 'EXECUTED') {
          return {
            reversalEntryId: req.reversal_document_id,
            correctedDraftId: req.corrected_document_id,
            idempotent: true
          };
        }

        if (req.status !== 'APPROVED') {
          const err = new Error(`Only APPROVED correction requests can be executed (Current status: ${req.status}).`);
          err.statusCode = 409;
          throw err;
        }

        // Mark request EXECUTING
        await trx('document_correction_requests')
          .where({ id: requestId })
          .update({
            status: 'EXECUTING',
            execution_attempts: (req.execution_attempts || 0) + 1,
            updated_at: trx.fn.now()
          });

        const origEntry = await trx('journal_entries')
          .where({ id: req.document_id, company_id: companyId })
          .forUpdate()
          .first();

        if (!origEntry) throw new Error('Original journal entry not found.');
        if (origEntry.status !== 'POSTED') throw new Error('Original journal entry is no longer POSTED.');
        if (origEntry.is_reversed) throw new Error('Original journal entry is already marked REVERSED.');

        const origLines = await trx('journal_lines').where({ entry_id: origEntry.id });
        if (!origLines || origLines.length === 0) throw new Error('Original journal entry has no line items.');

        // Validate Period Close at execution time
        const JournalValidationService = require('./journal_validation.service');
        await JournalValidationService.validatePeriod(companyId, origEntry.entry_date, trx);

        // Calculate reversal lines preserving all dimensions
        const reversalLines = origLines.map(line => {
          const invDebit = parseFloat(line.credit) || 0;
          const invCredit = parseFloat(line.debit) || 0;
          return {
            accountId: line.account_id,
            debit: invDebit,
            credit: invCredit,
            department: line.department,
            project: line.project,
            branch: line.branch,
            reversalOfLineId: line.id
          };
        });

        // Assert reversal journal balance
        const totalDebit = reversalLines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = reversalLines.reduce((sum, l) => sum + l.credit, 0);
        if (Math.abs(totalDebit - totalCredit) > 0.001) {
          throw new Error('REVERSAL_JOURNAL_NOT_BALANCED: Reversal debit total does not match credit total.');
        }

        // 1. Create Reversal Entry as Draft first
        const JournalModel = require('../models/journal.model');
        const reversalEntryId = await JournalModel.createEntry({
          companyId,
          entryDate: origEntry.entry_date,
          description: `Reversal of Journal #${origEntry.id}: ${origEntry.description || ''}`,
          reference: `REV-${origEntry.reference || origEntry.id}`,
          reversalOfId: origEntry.id,
          reversalReason: req.reason_text,
          userId,
          status: 'DRAFT'
        }, trx);

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

        // Post Reversal Journal through single canonical posting engine
        await this.postJournalEntry(reversalEntryId, companyId, userId, true, trx);

        // 2. Create Corrected Draft Copy
        const correctedDraftId = await JournalModel.createEntry({
          companyId,
          entryDate: origEntry.entry_date,
          description: `Corrected Copy of Journal #${origEntry.id}: ${origEntry.description || ''}`,
          reference: `CORR-${origEntry.reference || origEntry.id}`,
          userId,
          status: 'DRAFT'
        }, trx);

        for (const line of origLines) {
          await JournalModel.createLine({
            entryId: correctedDraftId,
            accountId: line.account_id,
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0,
            department: line.department,
            project: line.project,
            branch: line.branch
          }, trx);
        }

        // Update correction_of_entry_id link on corrected copy
        await trx('journal_entries')
          .where({ id: correctedDraftId })
          .update({ correction_of_entry_id: origEntry.id });

        // 3. Mark Original Journal REVERSED & store correction_draft_id (Do NOT mark superseded until draft is posted!)
        await trx('journal_entries')
          .where({ id: origEntry.id })
          .update({
            is_reversed: true,
            reversed_by_entry_id: reversalEntryId,
            correction_draft_id: correctedDraftId
          });

        // 4. Update Correction Request EXECUTED
        await trx('document_correction_requests')
          .where({ id: requestId })
          .update({
            status: 'EXECUTED',
            executed_by: userId,
            executed_at: trx.fn.now(),
            reversal_document_id: reversalEntryId,
            corrected_document_id: correctedDraftId,
            updated_at: trx.fn.now()
          });

        // Audit Trail
        await trx('transaction_audit_logs').insert({
          company_id: companyId,
          action: 'CORRECTION_EXECUTED',
          user_id: userId,
          description: `Executed Correction for Journal #${origEntry.id}. Created Reversal Journal #${reversalEntryId} and Draft Copy #${correctedDraftId}`
        });

        // Outbox Notification
        const NotificationOutboxService = require('./notification_outbox.service');
        await NotificationOutboxService.enqueueNotification({
          companyId,
          eventType: 'JOURNAL_CORRECTION_EXECUTED',
          aggregateType: 'JOURNAL',
          aggregateId: origEntry.id,
          payload: {
            title: `Journal Correction Executed: #${origEntry.id}`,
            message: `Journal #${origEntry.id} was reversed by Reversal #${reversalEntryId}. Corrected draft #${correctedDraftId} created.`,
            userIds: [origEntry.user_id, req.requested_by]
          },
          trx
        });

        return { reversalEntryId, correctedDraftId };
      });
    } catch (err) {
      await db('document_correction_requests')
        .where({ id: requestId })
        .update({
          status: 'FAILED',
          execution_error: err.message,
          updated_at: db.fn.now()
        });
      throw err;
    }
  }
}

module.exports = JournalService;
