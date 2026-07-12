const router = require('express').Router();
const communicationController = require('../controllers/communication.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Admin Routes
router.get('/admin/:companyId', companyGuard, requirePermission('settings.manage'), communicationController.getAdminCommunications);
router.get('/admin/:companyId/thread/:parentId', companyGuard, requirePermission('settings.manage'), communicationController.getAdminThread);
router.post('/admin/:companyId/compose', companyGuard, requirePermission('settings.manage'), communicationController.adminComposeMessage);
router.post('/admin/:companyId/reply', companyGuard, requirePermission('settings.manage'), communicationController.adminReplyMessage);

// Employee Routes
router.get('/employee/:companyId', companyGuard, communicationController.getEmployeeCommunications);
router.get('/employee/:companyId/thread/:parentId', companyGuard, communicationController.getEmployeeThread);
router.post('/employee/:companyId/reply', companyGuard, communicationController.employeeReplyMessage);

// ESS Self-Service Routes
router.get('/ess/:companyId/profile', companyGuard, communicationController.getEssProfile);
router.get('/ess/:companyId/leaves', companyGuard, communicationController.getEssLeaves);
router.get('/ess/:companyId/leave-balances', companyGuard, communicationController.getEssLeaveBalances);
router.post('/ess/:companyId/leaves', companyGuard, communicationController.submitEssLeave);
router.get('/ess/:companyId/payslips', companyGuard, communicationController.getEssPayslips);

module.exports = router;