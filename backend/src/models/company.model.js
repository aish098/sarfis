const db = require('../config/db');

class CompanyModel {
  static async create(companyData, trx) {
    const query = db('companies');
    if (trx) query.transacting(trx);

    const [company] = await query
      .insert({
        name: companyData.name,
        owner_id: companyData.ownerId
      })
      .returning('*');
    return company;
  }

  static async addUser(companyId, userId, role, trx) {
    const query = db('company_users');
    if (trx) query.transacting(trx);

    await query.insert({
      company_id: companyId,
      user_id: userId,
      role: role
    });
  }

  static async getByUser(userId) {
    return db('companies as c')
      .join('company_users as cu', 'c.id', 'cu.company_id')
      .select('c.*', 'cu.role as user_role')
      .where('cu.user_id', userId);
  }
}

module.exports = CompanyModel;
