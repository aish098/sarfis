const db = require('../db/knex');

class CouponRepository {
  async findAll({ status = 'all' }) {
    let query = db('coupons as c')
      .leftJoin('admins as a', 'c.created_by_admin_id', 'a.id');

    if (status !== 'all') {
      query = query.whereRaw('LOWER(c.status) = ?', [status.toLowerCase()]);
    }

    const coupons = await query
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

    const now = new Date();
    return coupons.map(coupon => {
      const isExpired = new Date(coupon.expiry_date) < now;
      const isExhausted = coupon.used_count >= coupon.usage_limit;
      let effectiveStatus = coupon.status;
      if (coupon.status === 'active') {
        if (isExpired) effectiveStatus = 'expired';
        else if (isExhausted) effectiveStatus = 'exhausted';
      }
      return {
        ...coupon,
        effective_status: effectiveStatus,
        is_redeemable: effectiveStatus === 'active'
      };
    });
  }

  async findById(id) {
    const coupon = await db('coupons as c')
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

    if (!coupon) return null;

    const now = new Date();
    const isExpired = new Date(coupon.expiry_date) < now;
    const isExhausted = coupon.used_count >= coupon.usage_limit;
    let effectiveStatus = coupon.status;
    if (coupon.status === 'active') {
      if (isExpired) effectiveStatus = 'expired';
      else if (isExhausted) effectiveStatus = 'exhausted';
    }

    return {
      ...coupon,
      effective_status: effectiveStatus,
      is_redeemable: effectiveStatus === 'active'
    };
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

  async redeemAtomic(id, { companyId, userId, discountAmount }) {
    const now = new Date();
    const updatedRows = await db('coupons')
      .where('id', id)
      .andWhere('status', 'active')
      .andWhere('expiry_date', '>', now)
      .andWhereRaw('used_count < usage_limit')
      .increment('used_count', 1);

    if (updatedRows === 0) {
      return false;
    }

    await db('coupon_redemptions').insert({
      coupon_id: id,
      company_id: companyId || null,
      user_id: userId || null,
      discount_applied: discountAmount || 0,
      redeemed_at: now
    });

    return true;
  }

  async delete(id) {
    const coupon = await this.findById(id);
    if (!coupon) return null;

    if (coupon.used_count > 0) {
      // Soft disable if coupon has historical redemptions
      await db('coupons').where({ id }).update({ status: 'disabled', updated_at: new Date() });
      return { ...coupon, status: 'disabled', soft_deleted: true };
    }

    await db('coupons').where({ id }).del();
    return { ...coupon, soft_deleted: false };
  }
}

module.exports = new CouponRepository();
