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
      lines
    });

    res.status(201).json({ id: entryId, message: 'Journal entry posted successfully' });
  } catch (err) {
    console.error('Journal entry error:', err);
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
