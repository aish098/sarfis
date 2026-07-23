const JournalModel = require('../../models/journal.model');
const AccountModel = require('../../models/account.model');
const JournalPostingService = require('../journal_posting.service');
const JournalValidationService = require('../journal_validation.service');

class JournalCorrectionHandler {
  async loadDocument({ trx, companyId, documentId, forUpdate = false }) {
    const query = trx('journal_entries').where({ id: documentId, company_id: companyId });
    if (forUpdate) query.forUpdate();
    const entry = await query.first();
    if (!entry) {
      const err = new Error('Journal entry not found.');
      err.statusCode = 404;
      throw err;
    }
    return entry;
  }

  async validateRequest({ trx, companyId, userId, document, reasonCode, reasonText }) {
    if (document.status !== 'POSTED') {
      const err = new Error('Only posted journal entries can request a correction.');
      err.statusCode = 409;
      throw err;
    }
    if (document.is_reversed) {
      const err = new Error('This journal entry has already been reversed.');
      err.statusCode = 409;
      throw err;
    }
  }

  async validateExecution({ trx, companyId, userId, request, document }) {
    if (document.status !== 'POSTED') throw new Error('Original journal entry is no longer POSTED.');
    if (document.is_reversed) throw new Error('Original journal entry is already marked REVERSED.');

    const lines = await trx('journal_lines').where({ entry_id: document.id });
    if (!lines || lines.length === 0) throw new Error('Original journal entry has no line items.');

    await JournalValidationService.validatePeriod(companyId, document.entry_date, trx);
  }

  async executeReversal({ trx, companyId, userId, request, document }) {
    const origLines = await trx('journal_lines').where({ entry_id: document.id });

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

    const totalDebit = reversalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = reversalLines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error('REVERSAL_JOURNAL_NOT_BALANCED: Reversal debit total does not match credit total.');
    }

    const JournalService = require('../journal.service');
    const reversalEntryId = await JournalModel.createEntry({
      companyId,
      entryDate: document.entry_date,
      description: `Reversal of Journal #${document.id}: ${document.description || ''}`,
      reference: `REV-${document.reference || document.id}`,
      reversalOfId: document.id,
      reversalReason: request.reason_text,
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

    await JournalService.postJournalEntry(reversalEntryId, companyId, userId, true, trx);

    return {
      reversalDocumentId: reversalEntryId,
      reversalJournalEntryId: reversalEntryId
    };
  }

  async createReplacementDraft({ trx, companyId, userId, request, document, reversal }) {
    const origLines = await trx('journal_lines').where({ entry_id: document.id });

    const correctedDraftId = await JournalModel.createEntry({
      companyId,
      entryDate: document.entry_date,
      description: `Corrected Copy of Journal #${document.id}: ${document.description || ''}`,
      reference: `CORR-${document.reference || document.id}`,
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

    await trx('journal_entries')
      .where({ id: correctedDraftId })
      .update({ correction_of_entry_id: document.id });

    return { id: correctedDraftId };
  }

  async finalizeOriginal({ trx, companyId, userId, request, document, reversal, correctedDraft }) {
    await trx('journal_entries')
      .where({ id: document.id })
      .update({
        is_reversed: true,
        reversed_by_entry_id: reversal.reversalDocumentId,
        correction_draft_id: correctedDraft.id
      });
  }
}

module.exports = JournalCorrectionHandler;
