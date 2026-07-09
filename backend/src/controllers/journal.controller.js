const JournalService = require('../services/journal.service');
const JournalModel = require('../models/journal.model');

/**
 * Creates a new journal entry with multiple lines (double-entry).
 * Enforces Balanced Entry (Debit = Credit).
 */
exports.createJournalEntry = async (req, res) => {
  const { entry_date, description, lines } = req.body;
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    const entryId = await JournalService.createJournalEntry({
      companyId,
      userId,
      entryDate: entry_date,
      description,
      lines,
      overrideControlWarning: req.body.overrideControlWarning
    });

    res.status(201).json({ id: entryId, message: 'Journal entry drafted successfully' });
  } catch (err) {
    console.error('Journal entry error:', err);
    if (err.isControlWarning) {
      return res.status(409).json({
        warning: 'CONTROL_ACCOUNT_DIRECT_POST',
        message: err.message,
        controlAccounts: err.controlAccounts
      });
    }
    res.status(err.message.includes('required') || err.message.includes('lines') || err.message.includes('Uneven') || err.message.includes('Negative') ? 400 : 500).json({ message: err.message });
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
  const companyId = req.companyId;
  const userId = req.user.id;

  try {
    await JournalService.postJournalEntry(id, companyId, userId);
    res.json({ message: 'Journal entry posted successfully' });
  } catch (err) {
    console.error('Post Error:', err);
    res.status(err.message.includes('not found') || err.message.includes('already') ? 400 : 500).json({ error: err.message });
  }
};

exports.submitJournalForApproval = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  const db = require('../config/db');

  try {
    const entry = await db('journal_entries').where({ id, company_id: companyId }).first();
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    if (entry.status !== 'DRAFT') return res.status(400).json({ error: 'Only draft journal entries can be submitted for approval.' });

    await db('journal_entries').where({ id }).update({ status: 'PENDING_APPROVAL', updated_at: db.fn.now() });

    try {
      const NotificationService = require('../services/notification.service');
      const submitter = await db('users').where({ id: req.user.id }).first();
      const submitterName = submitter ? submitter.name : 'A clerk';

      // Get entry total amount for logging
      const lines = await db('journal_lines').where({ entry_id: id });
      const totalAmount = lines.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);

      // 1. Notify users with journal.post
      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'journal.post',
        title: 'Journal Pending Posting',
        message: `Journal entry #${id} (${entry.description || 'Manual Journal'}) of PKR ${totalAmount.toLocaleString()} submitted by ${submitterName} requires posting.`,
        type: 'approval',
        priority: 'HIGH',
        entityType: 'journal',
        entityId: id
      });

      // 2. Notify users with journal.approve
      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'journal.approve',
        title: 'Journal Submitted for Review',
        message: `Journal entry #${id} submitted by ${submitterName} requires review.`,
        type: 'approval',
        priority: 'MEDIUM',
        entityType: 'journal',
        entityId: id
      });
    } catch (notifErr) {
      console.error('Failed to dispatch notifications for journal submission:', notifErr);
    }

    res.json({ message: 'Journal entry submitted for approval' });
  } catch (err) {
    console.error('Submit Approval Error:', err);
    res.status(500).json({ error: err.message });
  }
};
