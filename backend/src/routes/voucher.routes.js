const router = require('express').Router();
const voucherCtrl = require('../controllers/voucher.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// --- VOUCHERS ---
router.get('/vouchers/:companyId',            companyGuard, requirePermission('voucher.view'), voucherCtrl.getVouchers);
router.get('/vouchers/:companyId/:id',        companyGuard, requirePermission('voucher.view'), voucherCtrl.getVoucherById);
router.get('/vouchers/:companyId/:id/details',companyGuard, requirePermission('voucher.view'), voucherCtrl.getTransactionInquiry);
router.post('/vouchers/:companyId',           companyGuard, requirePermission('voucher.create'), voucherCtrl.createVoucher);
router.put('/vouchers/:companyId/:id',        companyGuard, requirePermission('voucher.edit'), voucherCtrl.updateVoucher);
router.delete('/vouchers/:companyId/:id',     companyGuard, requirePermission('voucher.delete'), voucherCtrl.deleteVoucher);

// Workflow states
router.post('/vouchers/:companyId/:id/submit',  companyGuard, requirePermission('voucher.edit'), voucherCtrl.submitForApproval);
router.post('/vouchers/:companyId/:id/post',    companyGuard, requirePermission('voucher.post'), voucherCtrl.postVoucher);
router.post('/vouchers/:companyId/:id/request-correction', companyGuard, requirePermission('voucher.request_correction'), voucherCtrl.requestCorrection);
router.post('/voucher-correction-requests/:companyId/:id/approve', companyGuard, requirePermission('voucher.approve_correction'), voucherCtrl.approveCorrectionRequest);
router.post('/voucher-correction-requests/:companyId/:id/reject', companyGuard, requirePermission('voucher.reject_correction'), voucherCtrl.rejectCorrectionRequest);
router.post('/voucher-correction-requests/:companyId/:id/execute', companyGuard, requirePermission('voucher.execute_correction'), voucherCtrl.executeCorrectionRequest);

// --- VENDORS (SUPPLIERS) ---
router.get('/vendors/:companyId',             companyGuard, requirePermission('vendor.manage'), voucherCtrl.getVendors);
router.post('/vendors/:companyId',            companyGuard, requirePermission('vendor.manage'), voucherCtrl.createVendor);
router.put('/vendors/:companyId/:id',         companyGuard, requirePermission('vendor.manage'), voucherCtrl.updateVendor);
router.delete('/vendors/:companyId/:id',      companyGuard, requirePermission('vendor.manage'), voucherCtrl.deleteVendor);

// --- PERIOD LOCKS ---
router.get('/periods/:companyId',             companyGuard, requirePermission('period.view'), voucherCtrl.getPeriods);
router.post('/periods/:companyId',            companyGuard, requirePermission('period.manage'), voucherCtrl.createPeriod);
router.post('/accounting-periods/:companyId/initialize', companyGuard, requirePermission('period.manage'), voucherCtrl.initializeFiscalYear);
router.post('/accounting-periods/:companyId/generate-missing', companyGuard, requirePermission('period.manage'), voucherCtrl.generateMissingPeriods);
router.patch('/periods/:companyId/:id',       companyGuard, requirePermission('period.manage'), voucherCtrl.updatePeriodStatus);

// --- SETTINGS MAPPINGS ---
router.get('/settings/:companyId',            companyGuard, requirePermission('settings.manage'), voucherCtrl.getSettings);
router.put('/settings/:companyId',            companyGuard, requirePermission('settings.manage'), voucherCtrl.updateSettings);

module.exports = router;
