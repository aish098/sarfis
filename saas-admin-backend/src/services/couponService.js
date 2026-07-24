const couponRepository = require('../repositories/couponRepository');
const AppError = require('../errors/AppError');
const { generateCouponId } = require('../utils/crypto');

const VALID_DISCOUNT_TYPES = [
  'percentage', 'fixed', 'free_trial', 'upgrade_discount', 'lifetime', 'referral', 'partner', 'internal'
];

class CouponService {
  async getAllCoupons(status = 'all') {
    const coupons = await couponRepository.findAll({ status });
    return coupons;
  }

  async generateCoupon(data, adminId) {
    const { code, discount_type, discount_value, expiry_date, usage_limit } = data;

    if (!code || !discount_type || discount_value === undefined || !expiry_date) {
      throw new AppError('Fields code, discount_type, discount_value, and expiry_date are required.', 400, 'VALIDATION_ERROR');
    }

    if (!VALID_DISCOUNT_TYPES.includes(String(discount_type).toLowerCase())) {
      throw new AppError(`discount_type must be one of: ${VALID_DISCOUNT_TYPES.join(', ')}`, 400, 'INVALID_DISCOUNT_TYPE');
    }

    const existing = await couponRepository.findByCode(code);
    if (existing) {
      throw new AppError(`Coupon code '${code}' already exists.`, 409, 'COUPON_ALREADY_EXISTS');
    }

    const newCoupon = {
      id: generateCouponId(),
      code: String(code).toUpperCase(),
      discount_type: String(discount_type).toLowerCase(),
      discount_value: parseFloat(discount_value),
      expiry_date: new Date(expiry_date),
      usage_limit: parseInt(usage_limit || 100, 10),
      used_count: 0,
      status: 'active',
      created_by_admin_id: adminId
    };

    return await couponRepository.create(newCoupon);
  }

  async updateCouponStatus(id, { status }) {
    if (!status || !['active', 'disabled', 'expired'].includes(status.toLowerCase())) {
      throw new AppError("status must be 'active', 'disabled', or 'expired'.", 400, 'VALIDATION_ERROR');
    }

    const coupon = await couponRepository.findById(id);
    if (!coupon) {
      throw new AppError(`Coupon with ID '${id}' not found.`, 404, 'COUPON_NOT_FOUND');
    }

    return await couponRepository.update(id, { status: status.toLowerCase() });
  }

  async deleteCoupon(id) {
    const deleted = await couponRepository.delete(id);
    if (!deleted) {
      throw new AppError(`Coupon with ID '${id}' not found.`, 404, 'COUPON_NOT_FOUND');
    }
    return deleted;
  }
}

module.exports = new CouponService();
