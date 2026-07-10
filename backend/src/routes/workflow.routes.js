const router = require('express').Router();
const workflowCtrl = require('../controllers/workflow.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Pending approvals inbox listing
router.get('/pending', companyGuard, requirePermission('approval.view'), workflowCtrl.getPendingApprovals);

// Workflow stats
router.get('/stats', companyGuard, requirePermission('approval.view'), workflowCtrl.getWorkflowStats);

// Dev route to seed a test approval entry dynamically
router.get('/seed-test-approval', companyGuard, workflowCtrl.seedTestApproval);

// Reviewing step action
router.post('/review/:instanceId', companyGuard, requirePermission('approval.approve'), workflowCtrl.reviewApprovalStage);

// History logs
router.get('/history', companyGuard, requirePermission('approval.view'), workflowCtrl.getApprovalHistory);

// Timeline view helper
router.get('/timeline/:instanceId', companyGuard, requirePermission('approval.view'), workflowCtrl.getInstanceTimeline);

// Definitions CRUD
router.get('/definitions', companyGuard, requirePermission('settings.manage'), workflowCtrl.getWorkflowDefinitions);
router.post('/definitions', companyGuard, requirePermission('settings.manage'), workflowCtrl.saveWorkflowDefinition);

// Delegations CRUD
router.get('/delegations', companyGuard, requirePermission('approval.view'), workflowCtrl.getDelegations);
router.post('/delegations', companyGuard, requirePermission('approval.approve'), workflowCtrl.createDelegation);
router.post('/delegations/:id/cancel', companyGuard, requirePermission('approval.approve'), workflowCtrl.cancelDelegation);

module.exports = router;
