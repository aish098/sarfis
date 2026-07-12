const router = require('express').Router();
const poCtrl = require('../controllers/purchase_order.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/:companyId', companyGuard, requirePermission('voucher.view'), poCtrl.getPurchaseOrders);
router.get('/:companyId/:id', companyGuard, requirePermission('voucher.view'), poCtrl.getPurchaseOrderById);
router.post('/:companyId', companyGuard, requirePermission('voucher.view'), poCtrl.createPurchaseOrder);
router.put('/:companyId/:id', companyGuard, requirePermission('voucher.view'), poCtrl.updatePurchaseOrder);
router.post('/:companyId/:id/submit', companyGuard, requirePermission('voucher.view'), poCtrl.submitForApproval);
router.post('/:companyId/:id/convert-to-voucher', companyGuard, requirePermission('voucher.view'), poCtrl.convertToVoucher);

module.exports = router;
