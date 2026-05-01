const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');

router.get('/trial-balance/:companyId', reportController.getTrialBalance);
router.get('/adjusted-trial-balance/:companyId', reportController.getAdjustedTrialBalance);
router.get('/income-statement/:companyId', reportController.getIncomeStatement);
router.get('/balance-sheet/:companyId', reportController.getBalanceSheet);
router.get('/cash-flow/:companyId', reportController.getCashFlow);
router.get('/ledger/:accountId', reportController.getLedgerByAccount);

router.post('/close-period/:companyId', reportController.closePeriod);

module.exports = router;
