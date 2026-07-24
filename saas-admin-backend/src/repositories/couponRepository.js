const db = require('../db/knex');

class CouponRepository {
  async findAll({ status = 'all' }) {
    let query = db('coupons as c')
      .leftJoin('admins as a', 'c.created_by_admin_id', 'a.id');

    // Programmatic Expiration Update
    const now = new Date();
    await db('coupons')
      .where('status', 'active')
      .andWhere(builder => {
        builder.where('expiry_date', '<', now)
          .orWhereRaw('used_count >= usage_limit');
      })
      .update({ status: 'expired', updated_at: now });

    if (status !== 'all') {
      query = query.whereRaw('LOWER(c.status) = ?', [status.toLowerCase()]);
    }

    return await query
      .select(
        'c.id',
        'c.code',
        'c.discount_type',
        'c.discount_value',
        'c.status',
        'c.expiry_date',
        'c.usage_limit',
        'c.used_count',
        'c.created_by_admin_id',
        'a.name as created_by_admin_name',
        'c.created_at',
        'c.updated_at'
      )
      .orderBy('c.created_at', 'desc');
  }

  async findById(id) {
    return await db('coupons as c')
      .leftJoin('admins as a', 'c.created_by_admin_id', 'a.id')
      .where({ 'c.id': id })
      .select(
        'c.id',
        'c.code',
        'c.discount_type',
        'c.discount_value',
        'c.status',
        'c.expiry_date',
        'c.usage_limit',
        'c.used_count',
        'c.created_by_admin_id',
        'a.name as created_by_admin_name',
        'c.created_at',
        'c.updated_at'
      )
      .first();
  }

  async findByCode(code) {
    return await db('coupons').whereRaw('LOWER(code) = ?', [code.toLowerCase()]).first();
  }

  async create(couponData) {
    await db('coupons').insert(couponData);
    return this.findById(couponData.id);
  }

  async update(id, updateData) {
    await db('coupons').where({ id }).update({ ...updateData, updated_at: new Date() });
    return this.findById(id);
  }

  async delete(id) {
    const coupon = await this.findById(id);
    if (!coupon) return null;
    await db('coupons').where({ id }).del();
    return coupon;
  }
}

module.exports = new CouponRepository();
