const db = require('../config/db');

class AccountModel {
  static async create(accountData) {
    const [account] = await db('accounts')
      .insert({
        company_id: accountData.companyId,
        code: accountData.code,
        name: accountData.name,
        category: accountData.category,
        normal_balance: accountData.normal_balance,
        is_contra: accountData.is_contra,
        balance: 0
      })
      .returning('*');
    return account;
  }

  static async getByCompany(companyId) {
    return db('accounts')
      .where({ company_id: companyId })
      .orderBy('code', 'asc');
  }

  static async update(id, companyId, accountData) {
    const [account] = await db('accounts')
      .where({ id, company_id: companyId })
      .update({
        name: accountData.name,
        category: accountData.category,
        code: accountData.code,
        normal_balance: accountData.normal_balance,
        is_contra: accountData.is_contra
      })
      .returning('*');
    return account;
  }

  static async delete(id, companyId) {
    const [account] = await db('accounts')
      .where({ id, company_id: companyId })
      .delete()
      .returning('*');
    return account;
  }

  static async hasJournalEntries(id) {
    const entry = await db('journal_lines')
      .where({ account_id: id })
      .first();
    return !!entry;
  }

  static async findByCode(companyId, code) {
    return db('accounts')
      .where({ company_id: companyId, code })
      .first();
  }

  static async seedCoa(companyId, coaData, trx) {
    const query = db('accounts');
    if (trx) query.transacting(trx);

    const accountsToInsert = coaData.map(([code, name, category, normal_balance, is_contra]) => ({
      company_id: companyId,
      code,
      name,
      category,
      normal_balance,
      is_contra,
      balance: 0
    }));

    await query.insert(accountsToInsert);
  }

  static async updateBalance(id, companyId, debit, credit, trx) {
    const query = db('accounts');
    if (trx) query.transacting(trx);

    await query
      .where({ id, company_id: companyId })
      .increment('balance', (debit || 0) - (credit || 0));
  }
}

module.exports = AccountModel;
