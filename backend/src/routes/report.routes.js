const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/trial-balance/:companyId', companyGuard, requirePermission('report.view'), reportController.getTrialBalance);
router.get('/adjusted-trial-balance/:companyId', companyGuard, requirePermission('report.view'), reportController.getAdjustedTrialBalance);
router.get('/income-statement/:companyId', companyGuard, requirePermission('report.view'), reportController.getIncomeStatement);
router.get('/balance-sheet/:companyId', companyGuard, requirePermission('report.view'), reportController.getBalanceSheet);
router.get('/cash-flow/:companyId', companyGuard, requirePermission('report.view'), reportController.getCashFlow);

// For ledger, there is no companyId in the route path, it's /ledger/:accountId.
// We can't use companyGuard here unless we modify the path or fetch the company from account.
// So we just apply authMiddleware and requirePermission.
router.get('/ledger/:accountId', requirePermission('ledger.view'), reportController.getLedgerByAccount);

router.post('/close-period/:companyId', companyGuard, requirePermission('journal.post'), reportController.closePeriod);

module.exports = router;
