const router = require('express').Router();
const soCtrl = require('../controllers/sales_order.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/:companyId', companyGuard, requirePermission('voucher.view'), soCtrl.getSalesOrders);
router.get('/:companyId/:id', companyGuard, requirePermission('voucher.view'), soCtrl.getSalesOrderById);
router.post('/:companyId', companyGuard, requirePermission('voucher.view'), soCtrl.createSalesOrder);
router.post('/:companyId/:id/confirm', companyGuard, requirePermission('voucher.view'), soCtrl.confirmSalesOrder);
router.patch('/:companyId/:id/status', companyGuard, requirePermission('voucher.view'), soCtrl.updateStatus);
router.post('/:companyId/:id/convert', companyGuard, requirePermission('voucher.view'), soCtrl.convertToVoucher);

module.exports = router;
