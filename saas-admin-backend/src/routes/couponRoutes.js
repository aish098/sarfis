const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const auditMiddleware = require('../middleware/audit.middleware');

router.use(authMiddleware);

// 1. Generate Coupon (Audited Action)
router.post(
  '/generate',
  rbacMiddleware('coupons.create'),
  auditMiddleware('COUPON_GENERATED', (req, resData) => ({
    targetType: 'coupon',
    targetId: resData?.data?.id,
    payload: { code: req.body.code, discount_type: req.body.discount_type, value: req.body.discount_value }
  })),
  couponController.generateCoupon
);

// 2. Get All Coupons
router.get('/', rbacMiddleware('coupons.view'), couponController.getAllCoupons);

// 3. Update Coupon Status
router.patch(
  '/:coupon_id',
  rbacMiddleware('coupons.update'),
  auditMiddleware('COUPON_STATUS_UPDATED', (req, resData) => ({
    targetType: 'coupon',
    targetId: req.params.coupon_id,
    payload: { status: req.body.status }
  })),
  couponController.updateCouponStatus
);

// 4. Delete/Deactivate Coupon (Audited Action)
router.delete(
  '/:coupon_id',
  rbacMiddleware('coupons.delete'),
  auditMiddleware('COUPON_DELETED', (req, resData) => ({
    targetType: 'coupon',
    targetId: req.params.coupon_id,
    payload: {}
  })),
  couponController.deleteCoupon
);

module.exports = router;
