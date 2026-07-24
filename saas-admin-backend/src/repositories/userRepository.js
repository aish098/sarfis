const db = require('../db/knex');

class UserRepository {
  async findAll({ offset, limit, sort, order, status, role, search }) {
    let query = db('users as u')
      .leftJoin('companies as c', 'u.company_id', 'c.id')
      .leftJoin('admins as a', 'u.blocked_by_admin_id', 'a.id');

    if (status) {
      query = query.whereRaw('LOWER(u.status) = ?', [status.toLowerCase()]);
    }

    if (role) {
      query = query.whereRaw('LOWER(u.role) = ?', [role.toLowerCase()]);
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query = query.andWhere(builder => {
        builder.whereRaw('LOWER(u.name) LIKE ?', [q])
          .orWhereRaw('LOWER(u.email) LIKE ?', [q]);
      });
    }

    const totalCountQuery = query.clone().count('u.id as total').first();

    const users = await query
      .select(
        'u.id',
        'u.name',
        'u.email',
        'u.status',
        'u.role',
        'u.company_id',
        'c.name as company_name',
        'u.blocked_reason',
        'u.blocked_at',
        'a.name as blocked_by_admin_name',
        'u.last_login_at',
        'u.login_count',
        'u.created_at',
        'u.updated_at'
      )
      .orderBy(`u.${sort}`, order)
      .offset(offset)
      .limit(limit);

    const totalResult = await totalCountQuery;
    const totalItems = parseInt(totalResult.total || 0, 10);

    return { users, totalItems };
  }

  async findById(id) {
    return await db('users as u')
      .leftJoin('companies as c', 'u.company_id', 'c.id')
      .leftJoin('admins as a', 'u.blocked_by_admin_id', 'a.id')
      .where({ 'u.id': id })
      .select(
        'u.id',
        'u.name',
        'u.email',
        'u.status',
        'u.role',
        'u.company_id',
        'c.name as company_name',
        'u.blocked_reason',
        'u.blocked_at',
        'a.name as blocked_by_admin_name',
        'u.last_login_at',
        'u.login_count',
        'u.created_at',
        'u.updated_at'
      )
      .first();
  }

  async updateStatus(id, { status, blocked_by_admin_id = null, blocked_reason = null, blocked_at = null }) {
    await db('users')
      .where({ id })
      .update({
        status,
        blocked_by_admin_id,
        blocked_reason,
        blocked_at,
        updated_at: new Date()
      });

    return this.findById(id);
  }
}

module.exports = new UserRepository();
