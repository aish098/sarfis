const router = require('express').Router();
const periodCloseCtrl = require('../controllers/period_close.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Close Diagnostics & Dashboard info
router.get('/:companyId/:id/dashboard',          companyGuard, requirePermission('period.view'), periodCloseCtrl.getCloseDashboard);
router.get('/:companyId/:id/financial-summary', companyGuard, requirePermission('period.view'), periodCloseCtrl.getFinancialSummary);
router.get('/:companyId/:id/module-health',      companyGuard, requirePermission('period.view'), periodCloseCtrl.getModuleHealth);
router.get('/:companyId/:id/timeline',           companyGuard, requirePermission('period.view'), periodCloseCtrl.getTimeline);
router.get('/:companyId/:id/close-checklist',   companyGuard, requirePermission('period.view'), periodCloseCtrl.getChecklist);

// Sign-offs
router.get('/:companyId/:id/signoffs',           companyGuard, requirePermission('period.view'), periodCloseCtrl.getSignoffs);
router.post('/:companyId/:id/signoffs',          companyGuard, requirePermission('period.manage'), periodCloseCtrl.saveSignoff);

// Closing sessions & workflows
router.post('/:companyId/:id/start-session',     companyGuard, requirePermission('period.manage'), periodCloseCtrl.startSession);
router.post('/:companyId/:id/submit-approval',   companyGuard, requirePermission('period.manage'), periodCloseCtrl.submitCloseApproval);
router.get('/:companyId/:id/report',             companyGuard, requirePermission('period.view'), periodCloseCtrl.getReport);

// Direct Actions
router.post('/:companyId/:id/close',             companyGuard, requirePermission('period.manage'), periodCloseCtrl.closePeriodDirectly);
router.post('/:companyId/:id/reopen',            companyGuard, requirePermission('period.manage'), periodCloseCtrl.reopenPeriod);

module.exports = router;
