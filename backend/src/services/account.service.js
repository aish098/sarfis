const AccountModel = require('../models/account.model');

class AccountService {
  /**
   * Creates a new account with validation.
   */
  static async createAccount({ companyId, code, name, category, normal_balance, is_contra }) {
    if (!companyId) throw new Error('Company context required.');
    if (!code || !name || !category) throw new Error('Code, Name, and Category are required.');

    // Validate account code prefix vs category
    const prefix = code[0];
    const validationMap = {
      '1': ['Asset'],
      '2': ['Liability'],
      '3': ['Equity'],
      '4': ['Income', 'Revenue'],
      '5': ['Expense']
    };

    if (!validationMap[prefix] || !validationMap[prefix].includes(category)) {
      throw new Error(`Invalid code prefix for account category '${category}'.`);
    }

    return await AccountModel.create({
      companyId,
      code,
      name,
      category,
      normal_balance,
      is_contra
    });
  }
}

module.exports = AccountService;
