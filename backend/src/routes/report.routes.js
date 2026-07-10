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

router.get('/ledger/:accountId', requirePermission('ledger.view'), reportController.getLedgerByAccount);
router.get('/balance-sheet/note/:accountId', requirePermission('report.view'), reportController.getBalanceSheetNote);

router.post('/close-period/:companyId', companyGuard, requirePermission('journal.post'), reportController.closePeriod);

// AP/AR Aging & Statements
router.get('/ap-aging/:companyId',                   companyGuard, requirePermission('report.view'), reportController.getAPAging);
router.get('/ar-aging/:companyId',                   companyGuard, requirePermission('report.view'), reportController.getARAging);
router.get('/vendor-statement/:companyId/:vendorId',  companyGuard, requirePermission('report.view'), reportController.getVendorStatement);
router.get('/customer-statement/:companyId/:clientId',companyGuard, requirePermission('report.view'), reportController.getCustomerStatement);

module.exports = router;
