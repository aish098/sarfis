const router = require('express').Router();
const riskController = require('../controllers/risk.controller');
const { authMiddleware, requirePermission } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Status & History
router.get('/status/:entityType/:entityId', riskController.getStatus);
router.get('/history/:entityType/:entityId', riskController.getHistory);
router.get('/incidents/:entityType/:entityId', riskController.getIncidentsList);

// Log & Resolve Incidents
router.post('/incidents', requirePermission('risk.manage'), riskController.logIncident);
router.post('/incidents/:incidentId/resolve', requirePermission('risk.manage'), riskController.resolveIncident);

// Flag entity status manually
router.post('/blacklist', requirePermission('risk.manage'), riskController.blacklistEntity);
router.post('/warn', requirePermission('risk.manage'), riskController.warnEntity);

// Reinstatement Requests
router.post('/reinstatement/request', requirePermission('risk.manage'), riskController.requestReinstatement);
router.post('/reinstatement/review/:requestId', requirePermission('risk.approve'), riskController.reviewReinstatement);

// Payment plans
router.get('/payment-plans/:entityType/:entityId', riskController.getPaymentPlans);
router.post('/payment-plans/installment/:installmentId/pay', requirePermission('risk.manage'), riskController.payPaymentPlanInstallment);

// Dashboard & Reports
router.get('/dashboard-stats', requirePermission('risk.view'), riskController.getDashboardStats);
router.get('/reports/blacklisted', requirePermission('risk.view'), riskController.getBlacklistedReport);
router.get('/reports/bad-debts', requirePermission('risk.view'), riskController.getBadDebtReport);
router.get('/reports/reinstatements', requirePermission('risk.view'), riskController.getReinstatementReport);
router.post('/verify-override', riskController.verifyOverride);

// Generic Approval Requests
router.post('/approval-requests', requirePermission('risk.manage'), riskController.submitApprovalRequest);
router.get('/approval-requests/:requestId', riskController.getApprovalRequest);
router.get('/approval-requests/pending', requirePermission('risk.approve'), riskController.getPendingApprovalRequests);
router.post('/approval-requests/review/:requestId', requirePermission('risk.approve'), riskController.reviewApprovalRequest);
router.post('/scheduler/reviews', requirePermission('risk.manage'), riskController.triggerScheduledReviews);

module.exports = router;
