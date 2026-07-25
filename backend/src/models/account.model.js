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
        current_classification: accountData.current_classification || 'NOT_APPLICABLE',
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
    const isAssetOrLiab = ['Asset', 'Liability'].includes(accountData.category);
    const classification = isAssetOrLiab ? (accountData.current_classification || 'NOT_APPLICABLE') : 'NOT_APPLICABLE';

    const [account] = await db('accounts')
      .where({ id, company_id: companyId })
      .update({
        name: accountData.name,
        category: accountData.category,
        code: accountData.code,
        normal_balance: accountData.normal_balance,
        is_contra: accountData.is_contra,
        current_classification: classification
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
    if (!Array.isArray(coaData) || coaData.length === 0) return;

    for (const [code, name, category, normal_balance, is_contra] of coaData) {
      const row = {
        company_id: companyId,
        code: String(code),
        name: String(name),
        category: String(category),
        type: String(category),
        normal_balance: String(normal_balance || 'Debit'),
        is_contra: Boolean(is_contra),
        balance: 0
      };

      try {
        const query = db('accounts');
        if (trx) query.transacting(trx);
        await query.insert(row).onConflict(['company_id', 'code']).merge();
      } catch (err1) {
        try {
          delete row.type;
          const retryQuery = db('accounts');
          if (trx) retryQuery.transacting(trx);
          await retryQuery.insert(row).onConflict(['company_id', 'code']).merge();
        } catch (err2) {
          // Ignore individual seeding error if conflict or duplicate key exists
        }
      }
    }
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
