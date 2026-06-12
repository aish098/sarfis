const router = require('express').Router();
const voucherCtrl = require('../controllers/voucher.controller');
const { authMiddleware, checkRole, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

const READ_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Purchasing Agent', 'Viewer'];
const VOUCHER_WRITE_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Purchasing Agent'];
const VENDOR_WRITE_ROLES = ['Company Admin', 'Purchasing Agent', 'Accountant', 'Manager'];
const PERIOD_WRITE_ROLES = ['Company Admin', 'Accountant'];

// --- VOUCHERS ---
router.get('/vouchers/:companyId',            companyGuard, checkRole(READ_ROLES), voucherCtrl.getVouchers);
router.get('/vouchers/:companyId/:id',        companyGuard, checkRole(READ_ROLES), voucherCtrl.getVoucherById);
router.post('/vouchers/:companyId',           companyGuard, checkRole(VOUCHER_WRITE_ROLES), voucherCtrl.createVoucher);
router.put('/vouchers/:companyId/:id',        companyGuard, checkRole(VOUCHER_WRITE_ROLES), voucherCtrl.updateVoucher);
router.delete('/vouchers/:companyId/:id',     companyGuard, checkRole(VOUCHER_WRITE_ROLES), voucherCtrl.deleteVoucher);

// Workflow states
router.post('/vouchers/:companyId/:id/submit',  companyGuard, checkRole(VOUCHER_WRITE_ROLES), voucherCtrl.submitForApproval);
router.post('/vouchers/:companyId/:id/post',    companyGuard, checkRole(['Company Admin', 'Accountant', 'Manager']), voucherCtrl.postVoucher);
router.post('/vouchers/:companyId/:id/reverse', companyGuard, checkRole(['Company Admin', 'Accountant', 'Manager']), voucherCtrl.reverseVoucher);

// --- VENDORS (SUPPLIERS) ---
router.get('/vendors/:companyId',             companyGuard, checkRole(READ_ROLES), voucherCtrl.getVendors);
router.post('/vendors/:companyId',            companyGuard, checkRole(VENDOR_WRITE_ROLES), voucherCtrl.createVendor);
router.put('/vendors/:companyId/:id',         companyGuard, checkRole(VENDOR_WRITE_ROLES), voucherCtrl.updateVendor);
router.delete('/vendors/:companyId/:id',      companyGuard, checkRole(VENDOR_WRITE_ROLES), voucherCtrl.deleteVendor);

// --- PERIOD LOCKS ---
router.get('/periods/:companyId',             companyGuard, checkRole(READ_ROLES), voucherCtrl.getPeriods);
router.post('/periods/:companyId',            companyGuard, checkRole(PERIOD_WRITE_ROLES), voucherCtrl.createPeriod);
router.patch('/periods/:companyId/:id',       companyGuard, checkRole(PERIOD_WRITE_ROLES), voucherCtrl.updatePeriodStatus);

// --- SETTINGS MAPPINGS ---
router.get('/settings/:companyId',            companyGuard, checkRole(READ_ROLES), voucherCtrl.getSettings);
router.put('/settings/:companyId',            companyGuard, checkRole(['Company Admin', 'Accountant', 'Super Admin', 'Admin', 'Owner', 'CEO']), voucherCtrl.updateSettings);

module.exports = router;
