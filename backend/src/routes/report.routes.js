const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authMiddleware, checkRole, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

const READ_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Viewer'];
const WRITE_ROLES = ['Company Admin', 'Accountant'];

router.get('/trial-balance/:companyId', companyGuard, checkRole(READ_ROLES), reportController.getTrialBalance);
router.get('/adjusted-trial-balance/:companyId', companyGuard, checkRole(READ_ROLES), reportController.getAdjustedTrialBalance);
router.get('/income-statement/:companyId', companyGuard, checkRole(READ_ROLES), reportController.getIncomeStatement);
router.get('/balance-sheet/:companyId', companyGuard, checkRole(READ_ROLES), reportController.getBalanceSheet);
router.get('/cash-flow/:companyId', companyGuard, checkRole(READ_ROLES), reportController.getCashFlow);

// For ledger, there is no companyId in the route path, it's /ledger/:accountId.
// We can't use companyGuard here unless we modify the path or fetch the company from account.
// So we just apply authMiddleware and checkRole.
router.get('/ledger/:accountId', checkRole(READ_ROLES), reportController.getLedgerByAccount);

router.post('/close-period/:companyId', companyGuard, checkRole(WRITE_ROLES), reportController.closePeriod);

module.exports = router;
