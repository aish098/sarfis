const AccountModel = require('../models/account.model');

class AccountService {
  /**
   * Creates a new account with validation.
   */
  static async createAccount({ companyId, code, name, type }) {
    if (!companyId) throw new Error('Company context required.');
    if (!code || !name || !type) throw new Error('Code, Name, and Type are required.');

    // Validate account code prefix vs type
    const prefix = code[0];
    const validationMap = {
      '1': ['Asset'],
      '2': ['Liability'],
      '3': ['Equity'],
      '4': ['Income', 'Revenue'],
      '5': ['Expense']
    };

    if (!validationMap[prefix] || !validationMap[prefix].includes(type)) {
      throw new Error(`Invalid code prefix for account type '${type}'.`);
    }

    return await AccountModel.create({
      companyId,
      code,
      name,
      type
    });
  }
}

module.exports = AccountService;
