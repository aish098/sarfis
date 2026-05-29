const router = require('express').Router();
const voucherCtrl = require('../controllers/voucher.controller');
const { authMiddleware, checkRole, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// --- VOUCHERS ---
router.get('/vouchers/:companyId',            companyGuard, voucherCtrl.getVouchers);
router.get('/vouchers/:companyId/:id',        companyGuard, voucherCtrl.getVoucherById);
router.post('/vouchers/:companyId',           companyGuard, voucherCtrl.createVoucher);
router.put('/vouchers/:companyId/:id',        companyGuard, voucherCtrl.updateVoucher);
router.delete('/vouchers/:companyId/:id',     companyGuard, voucherCtrl.deleteVoucher);

// Workflow states
router.post('/vouchers/:companyId/:id/submit',  companyGuard, voucherCtrl.submitForApproval);
router.post('/vouchers/:companyId/:id/post',    companyGuard, checkRole(['Company Admin', 'Accountant', 'Manager']), voucherCtrl.postVoucher);
router.post('/vouchers/:companyId/:id/reverse', companyGuard, checkRole(['Company Admin', 'Accountant', 'Manager']), voucherCtrl.reverseVoucher);

// --- VENDORS (SUPPLIERS) ---
router.get('/vendors/:companyId',             companyGuard, voucherCtrl.getVendors);
router.post('/vendors/:companyId',            companyGuard, checkRole(['Company Admin', 'Purchasing Agent']), voucherCtrl.createVendor);
router.put('/vendors/:companyId/:id',         companyGuard, checkRole(['Company Admin', 'Purchasing Agent']), voucherCtrl.updateVendor);
router.delete('/vendors/:companyId/:id',      companyGuard, checkRole(['Company Admin', 'Purchasing Agent']), voucherCtrl.deleteVendor);

// --- PERIOD LOCKS ---
router.get('/periods/:companyId',             companyGuard, voucherCtrl.getPeriods);
router.post('/periods/:companyId',            companyGuard, checkRole(['Company Admin', 'Accountant']), voucherCtrl.createPeriod);
router.patch('/periods/:companyId/:id',       companyGuard, checkRole(['Company Admin', 'Accountant']), voucherCtrl.updatePeriodStatus);

// --- SETTINGS MAPPINGS ---
router.get('/settings/:companyId',            companyGuard, voucherCtrl.getSettings);
router.put('/settings/:companyId',            companyGuard, checkRole(['Company Admin', 'Accountant']), voucherCtrl.updateSettings);

module.exports = router;
