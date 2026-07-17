const JournalService = require('../services/journal.service');
const JournalModel = require('../models/journal.model');
const JournalPostingService = require('../services/journal_posting.service');

/**
 * Creates a new draft journal entry.
 */
exports.createJournalEntry = async (req, res) => {
  const { entry_date, description, reference, lines } = req.body || {};
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const entryId = await JournalService.createDraft({
      companyId,
      userId,
      entryDate: entry_date,
      description,
      reference,
      lines
    });

    res.status(201).json({ id: entryId, message: 'Journal entry drafted successfully' });
  } catch (err) {
    console.error('Journal entry error:', err);
    if (err.isAccountNotFound || err.isNotPostable) {
      return res.status(400).json({
        success: false,
        error: err.isNotPostable ? 'ACCOUNT_NOT_POSTABLE' : 'ACCOUNT_NOT_FOUND',
        message: err.message,
        accountCode: err.accountCode || 'Unknown'
      });
    }
    res.status(400).json({ error: err.message });
  }
};

/**
 * Updates an existing draft journal entry.
 */
exports.updateJournalEntry = async (req, res) => {
  const { id } = req.params;
  const { entry_date, description, reference, lines } = req.body;
  const companyId = req.companyId;

  try {
    await JournalService.updateDraft(id, {
      companyId,
      entryDate: entry_date,
      description,
      reference,
      lines
    });

    res.json({ message: 'Journal entry draft updated successfully' });
  } catch (err) {
    console.error('Journal update error:', err);
    if (err.isAccountNotFound || err.isNotPostable) {
      return res.status(400).json({
        success: false,
        error: err.isNotPostable ? 'ACCOUNT_NOT_POSTABLE' : 'ACCOUNT_NOT_FOUND',
        message: err.message,
        accountCode: err.accountCode || 'Unknown'
      });
    }
    res.status(400).json({ error: err.message });
  }
};

/**
 * Gets journal entries for the company.
 */
exports.getJournalEntries = async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ message: 'Company context required.' });

  try {
    const entries = await JournalModel.getEntriesByCompany(companyId);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Gets specific entry with lines.
 */
exports.getEntryDetail = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  try {
    const header = await JournalModel.getEntryHeader(id, companyId);
    if (!header) return res.status(404).json({ message: 'Entry not found' });

    const lines = await JournalModel.getEntryLines(id);

    res.json({ ...header, lines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteJournalEntry = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  if (!id || id === 'undefined' || id === 'null') {
    return res.status(400).json({ error: 'Valid Journal Entry ID is required.' });
  }

  try {
    await JournalModel.deleteEntry(id, companyId);
    res.json({ message: 'Journal entry successfully voided / deleted' });
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Posts a drafted journal entry
 */
exports.postJournalEntry = async (req, res) => {
  const { id } = req.params;
  const { overrideControlWarning } = req.body || {};
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await JournalService.postJournalEntry(id, companyId, userId, !!overrideControlWarning);
    res.json({ message: 'Journal entry posted successfully' });
  } catch (err) {
    console.error('Post Error:', err);
    if (err.isAccountNotFound || err.isNotPostable) {
      return res.status(400).json({
        success: false,
        error: err.isNotPostable ? 'ACCOUNT_NOT_POSTABLE' : 'ACCOUNT_NOT_FOUND',
        message: err.message,
        accountCode: err.accountCode || 'Unknown'
      });
    }
    res.status(400).json({ error: err.message });
  }
};

exports.submitJournalForApproval = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  const db = require('../config/db');
  const WorkflowEngineService = require('../services/workflow_engine.service');

  try {
    const entry = await db('journal_entries').where({ id, company_id: companyId }).first();
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    if (entry.status !== 'DRAFT') return res.status(400).json({ error: 'Only draft journal entries can be submitted for approval.' });

    // Get entry total amount for condition evaluations
    const lines = await db('journal_lines').where({ entry_id: id });
    const totalAmount = lines.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);

    const result = await db.transaction(async (trx) => {
      const resWorkflow = await WorkflowEngineService.submitToWorkflow(
        companyId,
        'JOURNAL',
        id,
        totalAmount,
        req.user.id,
        trx
      );

      let status = 'PENDING_APPROVAL';
      if (resWorkflow.status === 'APPROVED') {
        status = 'POSTED';
      }

      await trx('journal_entries').where({ id }).update({ status });

      return { status, workflowInstanceId: resWorkflow.instanceId };
    });

    res.json({
      message: result.status === 'POSTED'
        ? 'Journal entry auto-approved and posted successfully'
        : 'Journal entry submitted for approval stages routing',
      status: result.status
    });
  } catch (err) {
    console.error('Submit Approval Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Reverses a posted journal entry by generating a counter-balancing transaction.
 */
exports.reverseJournalEntry = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await JournalPostingService.reverse(id, companyId, userId, reason);
    res.json({ message: 'Journal entry successfully reversed' });
  } catch (err) {
    console.error('Reversal Error:', err);
    res.status(400).json({ error: err.message });
  }
};
