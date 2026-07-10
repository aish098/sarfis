const router = require('express').Router();
const periodCloseCtrl = require('../controllers/period_close.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Close Diagnostics & Dashboard info
router.get('/:id/dashboard',          companyGuard, requirePermission('period.view'), periodCloseCtrl.getCloseDashboard);
router.get('/:id/financial-summary', companyGuard, requirePermission('period.view'), periodCloseCtrl.getFinancialSummary);
router.get('/:id/module-health',      companyGuard, requirePermission('period.view'), periodCloseCtrl.getModuleHealth);
router.get('/:id/timeline',           companyGuard, requirePermission('period.view'), periodCloseCtrl.getTimeline);

// Sign-offs
router.get('/:id/signoffs',           companyGuard, requirePermission('period.view'), periodCloseCtrl.getSignoffs);
router.post('/:id/signoffs',          companyGuard, requirePermission('period.manage'), periodCloseCtrl.saveSignoff);

// Closing sessions & workflows
router.post('/:id/start-session',     companyGuard, requirePermission('period.manage'), periodCloseCtrl.startSession);
router.post('/:id/submit-approval',   companyGuard, requirePermission('period.manage'), periodCloseCtrl.submitCloseApproval);
router.get('/:id/report',             companyGuard, requirePermission('period.view'), periodCloseCtrl.getReport);

// Direct Actions
router.post('/:id/close',             companyGuard, requirePermission('period.manage'), periodCloseCtrl.closePeriodDirectly);
router.post('/:id/reopen',            companyGuard, requirePermission('period.manage'), periodCloseCtrl.reopenPeriod);

module.exports = router;
