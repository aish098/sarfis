const router = require('express').Router();
const budgetCtrl = require('../controllers/budget.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Budgets list & details
router.get('/', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgets);
router.get('/:id', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetDetails);

// Save headers and lines
router.post('/', companyGuard, requirePermission('settings.manage'), budgetCtrl.saveBudgetHeader);
router.post('/:id/lines', companyGuard, requirePermission('settings.manage'), budgetCtrl.saveBudgetLines);

// Copy & roll forward
router.post('/copy', companyGuard, requirePermission('settings.manage'), budgetCtrl.copyBudget);

// Revisions & transfers
router.post('/:id/revision', companyGuard, requirePermission('settings.manage'), budgetCtrl.createRevision);
router.post('/:id/submit-approval', companyGuard, requirePermission('settings.manage'), budgetCtrl.submitBudgetApproval);
router.get('/transfers', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetTransfers);
router.post('/transfers', companyGuard, requirePermission('settings.manage'), budgetCtrl.transferBudget);

// Monthly distribution rules
router.get('/lines/:lineId/monthly', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetLineMonthly);
router.post('/lines/:lineId/monthly', companyGuard, requirePermission('settings.manage'), budgetCtrl.saveBudgetLineMonthly);
router.get('/lines/:lineId/transactions', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetLineTransactions);

// Dashboards and overrides log
router.get('/dashboard', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetDashboard);
router.get('/reports/vs-actual', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetVsActualReport);
router.get('/reports/overrides', companyGuard, requirePermission('analytics.view'), budgetCtrl.getBudgetOverrides);

// Forecast overrides and Excel CSV imports (Phase 16B)
router.post('/lines/:lineId/forecast-override', companyGuard, requirePermission('settings.manage'), budgetCtrl.saveForecastOverride);
router.post('/:id/validate-import', companyGuard, requirePermission('settings.manage'), budgetCtrl.validateBudgetImport);
router.post('/:id/commit-import', companyGuard, requirePermission('settings.manage'), budgetCtrl.commitBudgetImport);

module.exports = router;
