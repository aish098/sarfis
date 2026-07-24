const couponService = require('../services/couponService');

// 1. Generate Coupon
exports.generateCoupon = async (req, res, next) => {
  try {
    const adminId = req.admin ? req.admin.id : null;
    const newCoupon = await couponService.generateCoupon(req.body, adminId);
    return res.status(201).json({
      success: true,
      message: 'Coupon generated successfully',
      data: newCoupon
    });
  } catch (err) {
    next(err);
  }
};

// 2. Get All Coupons
exports.getAllCoupons = async (req, res, next) => {
  try {
    const { status = 'all' } = req.query;
    const coupons = await couponService.getAllCoupons(status);
    return res.status(200).json({
      success: true,
      data: coupons
    });
  } catch (err) {
    next(err);
  }
};

// 3. Update Coupon Status
exports.updateCouponStatus = async (req, res, next) => {
  try {
    const { coupon_id } = req.params;
    const { status } = req.body;
    const updated = await couponService.updateCouponStatus(coupon_id, { status });
    return res.status(200).json({
      success: true,
      message: `Coupon status updated to '${updated.status}'.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// 4. Delete Coupon
exports.deleteCoupon = async (req, res, next) => {
  try {
    const { coupon_id } = req.params;
    const deleted = await couponService.deleteCoupon(coupon_id);
    return res.status(200).json({
      success: true,
      message: `Coupon '${deleted.code}' was successfully deleted permanently from backend database.`,
      deleted_id: coupon_id
    });
  } catch (err) {
    next(err);
  }
};
