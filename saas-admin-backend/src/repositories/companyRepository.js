const db = require('../db/knex');

class CompanyRepository {
  async findAll({ offset, limit, sort = 'created_at', order = 'desc', search }) {
    let query = db('companies as c')
      .leftJoin('company_subscriptions as cs', 'c.id', 'cs.company_id')
      .leftJoin('plans as p', 'cs.plan_id', 'p.id');

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query = query.whereRaw('LOWER(c.name) LIKE ?', [q]);
    }

    const totalResult = await query.clone().countDistinct('c.id as total').first();
    const totalItems = parseInt(totalResult.total || 0, 10);

    const companies = await query
      .select(
        'c.id',
        'c.name',
        'c.slug',
        'c.status',
        'c.owner_user_id',
        'p.name as plan_name',
        'p.code as plan_code',
        'cs.status as subscription_status',
        'cs.current_period_end',
        'c.created_at'
      )
      .orderBy(`c.${sort}`, order)
      .offset(offset)
      .limit(limit);

    return { companies, totalItems };
  }

  async findById(id) {
    return await db('companies as c')
      .leftJoin('company_subscriptions as cs', 'c.id', 'cs.company_id')
      .leftJoin('plans as p', 'cs.plan_id', 'p.id')
      .where({ 'c.id': id })
      .select(
        'c.id',
        'c.name',
        'c.slug',
        'c.status',
        'c.owner_user_id',
        'p.name as plan_name',
        'p.code as plan_code',
        'cs.status as subscription_status',
        'cs.current_period_end',
        'c.created_at'
      )
      .first();
  }
}

module.exports = new CompanyRepository();
