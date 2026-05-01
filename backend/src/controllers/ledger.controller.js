const JournalModel = require('../models/journal.model');

/**
 * Gets the General Ledger for a specific account.
 */
exports.getLedgerByAccount = async (req, res) => {
  const { accountId } = req.params;
  const companyId = req.companyId;

  if (!companyId) return res.status(400).json({ message: 'Company context required.' });
  if (!accountId) return res.status(400).json({ message: 'Account ID is required.' });

  try {
    const lines = await JournalModel.getLedgerByAccount(accountId, companyId);
    res.json(lines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
