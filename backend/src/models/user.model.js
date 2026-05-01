const db = require('../config/db');

class UserModel {
  static async findByEmail(email) {
    if (!email || typeof email !== 'string') return undefined;
    const normalized = email.trim().toLowerCase();
    return db('users').whereRaw('LOWER(TRIM(email)) = ?', [normalized]).first();
  }

  static async findById(id) {
    return db('users')
      .select('id', 'name', 'email', 'role', 'created_at')
      .where({ id })
      .first();
  }

  static async create(userData, trx) {
    const query = db('users');
    if (trx) query.transacting(trx);

    const [user] = await query
      .insert({
        name: userData.name || null,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'Company Admin'
      })
      .returning(['id', 'name', 'email', 'role']);
    return user;
  }
}

module.exports = UserModel;
