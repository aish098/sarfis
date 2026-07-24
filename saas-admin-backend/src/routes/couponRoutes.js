const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const auditMiddleware = require('../middleware/audit.middleware');
const { validateGenerateCoupon } = require('../validators/couponValidator');

router.use(authMiddleware);

// 1. Generate Coupon (Validated & Audited Action)
router.post(
  '/generate',
  rbacMiddleware('coupons.create'),
  validateGenerateCoupon,
  auditMiddleware('COUPON_GENERATED', (req, resData) => ({
    targetType: 'coupon',
    targetId: resData?.data?.id,
    afterJson: resData?.data
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
    afterJson: resData?.data
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
    afterJson: resData
  })),
  couponController.deleteCoupon
);

module.exports = router;
