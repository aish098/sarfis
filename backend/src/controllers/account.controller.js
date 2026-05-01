const AccountService = require('../services/account.service');
const AccountModel = require('../models/account.model');

/**
 * Creates a new account in the Chart of Accounts.
 * Validates the account code prefix against the account type.
 */
exports.createAccount = async (req, res) => {
  const { code, name, type } = req.body;
  const companyId = req.companyId;

  try {
    const account = await AccountService.createAccount({
      companyId,
      code,
      name,
      type
    });
    res.status(201).json(account);
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('Invalid code prefix')) {
        return res.status(400).json({ message: err.message });
    }
    if (err.code === '23505') return res.status(400).json({ message: 'Account code already exists for this company.' });
    res.status(500).json({ error: err.message });
  }
};

/**
 * Gets all accounts for the active company.
 */
exports.getAccountsByCompany = async (req, res) => {
  const companyId = req.params.companyId || req.companyId;
  
  if (!companyId) {
    console.warn('getAccountsByCompany: No company company ID provided in params or header.');
    return res.status(400).json({ message: 'Company context required.' });
  }

  try {
    console.log(`[API] getAccountsByCompany: Fetching for ID=${companyId}`);
    const accounts = await AccountModel.getByCompany(companyId);
    console.log(`[API] getAccountsByCompany: Found ${accounts?.length || 0} accounts`);
    res.json(accounts);
  } catch (err) {
    console.error('getAccountsByCompany error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Updates an account (name and type usually).
 */
exports.updateAccount = async (req, res) => {
  const { id } = req.params;
  const { name, type, code } = req.body;
  const companyId = req.companyId;

  try {
    const account = await AccountModel.update(id, companyId, {
      name,
      type,
      code
    });
    if (!account) return res.status(404).json({ message: 'Account not found or access denied.' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Deletes an account (if not used in journalEntries).
 */
exports.deleteAccount = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  try {
    // Check if account has journal entries (lines)
    const hasEntries = await AccountModel.hasJournalEntries(id);
    if (hasEntries) {
      return res.status(400).json({ message: 'Cannot delete account with existing transactions.' });
    }

    const deletedAccount = await AccountModel.delete(id, companyId);
    if (!deletedAccount) return res.status(404).json({ message: 'Account not found or access denied.' });
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
