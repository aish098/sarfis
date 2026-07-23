const router = require('express').Router();
const prCtrl = require('../controllers/purchase_requisition.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/:companyId', companyGuard, requirePermission('voucher.view'), prCtrl.getPurchaseRequisitions);
router.get('/:companyId/:id', companyGuard, requirePermission('voucher.view'), prCtrl.getPurchaseRequisitionById);
router.get('/:companyId/:id/revisions', companyGuard, requirePermission('voucher.view'), prCtrl.getRevisions);
router.post('/:companyId', companyGuard, requirePermission('voucher.view'), prCtrl.createPurchaseRequisition);
router.put('/:companyId/:id', companyGuard, requirePermission('voucher.view'), prCtrl.updatePurchaseRequisition);
router.post('/:companyId/:id/submit', companyGuard, requirePermission('voucher.view'), prCtrl.submitForApproval);
router.post('/:companyId/:id/resubmit', companyGuard, requirePermission('voucher.view'), prCtrl.resubmitForApproval);
router.post('/:companyId/:id/convert', companyGuard, requirePermission('voucher.view'), prCtrl.convertToPurchaseOrder);

module.exports = router;
