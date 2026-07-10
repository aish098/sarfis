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
router.post('/vouchers/:companyId/:id/reverse', companyGuard, requirePermission('voucher.post'), voucherCtrl.reverseVoucher);
router.post('/vouchers/:companyId/:id/comment', companyGuard, requirePermission('voucher.edit'), voucherCtrl.addVoucherComment);

// --- VENDORS (SUPPLIERS) ---
router.get('/vendors/:companyId',             companyGuard, requirePermission('vendor.manage'), voucherCtrl.getVendors);
router.post('/vendors/:companyId',            companyGuard, requirePermission('vendor.manage'), voucherCtrl.createVendor);
router.put('/vendors/:companyId/:id',         companyGuard, requirePermission('vendor.manage'), voucherCtrl.updateVendor);
router.delete('/vendors/:companyId/:id',      companyGuard, requirePermission('vendor.manage'), voucherCtrl.deleteVendor);

// --- PERIOD LOCKS ---
router.get('/periods/:companyId',             companyGuard, requirePermission('period.view'), voucherCtrl.getPeriods);
router.post('/periods/:companyId',            companyGuard, requirePermission('period.manage'), voucherCtrl.createPeriod);
router.patch('/periods/:companyId/:id',       companyGuard, requirePermission('period.manage'), voucherCtrl.updatePeriodStatus);
router.get('/periods/:companyId/:id/close-checklist', companyGuard, requirePermission('period.view'), voucherCtrl.getPeriodCloseChecklist);
router.post('/periods/:companyId/:id/close',            companyGuard, requirePermission('period.manage'), voucherCtrl.closePeriod);
router.post('/periods/:companyId/:id/reopen',           companyGuard, requirePermission('period.manage'), voucherCtrl.reopenPeriod);
router.get('/periods/:companyId/:id/history',          companyGuard, requirePermission('period.view'), voucherCtrl.getPeriodHistory);

// --- SETTINGS MAPPINGS ---
router.get('/settings/:companyId',            companyGuard, requirePermission('settings.manage'), voucherCtrl.getSettings);
router.put('/settings/:companyId',            companyGuard, requirePermission('settings.manage'), voucherCtrl.updateSettings);

module.exports = router;
