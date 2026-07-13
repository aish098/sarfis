const router = require('express').Router();
const grCtrl = require('../controllers/goods_receipt.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/:companyId', companyGuard, requirePermission('voucher.view'), grCtrl.getGoodsReceipts);
router.get('/:companyId/:id', companyGuard, requirePermission('voucher.view'), grCtrl.getGoodsReceiptById);
router.post('/:companyId', companyGuard, requirePermission('voucher.view'), grCtrl.createGoodsReceipt);
router.post('/:companyId/:id/post', companyGuard, requirePermission('voucher.view'), grCtrl.postGoodsReceipt);
router.post('/:companyId/:id/convert', companyGuard, requirePermission('voucher.view'), grCtrl.convertToVoucher);

module.exports = router;
