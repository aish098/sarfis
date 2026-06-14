const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/overview', adminController.getOverview);
router.post('/companies', adminController.createCompany);
router.patch('/companies/:companyId', companyGuard, requirePermission('settings.manage'), adminController.updateCompany);
router.post('/companies/:companyId/members', companyGuard, requirePermission('user.manage'), adminController.addMember);
router.patch('/companies/:companyId/members/:userId', companyGuard, requirePermission('user.manage'), adminController.updateMemberRole);
router.delete('/companies/:companyId/members/:userId', companyGuard, requirePermission('user.manage'), adminController.removeMember);

// Backup, Restore & Purge Maintenance Utilities
router.get('/companies/:companyId/backup', companyGuard, requirePermission('settings.manage'), adminController.exportCompanyBackup);
router.post('/companies/:companyId/restore', companyGuard, requirePermission('settings.manage'), adminController.restoreCompanyBackup);
router.post('/companies/:companyId/purge', companyGuard, requirePermission('settings.manage'), adminController.purgeCompanyTransactions);

// Active DB-Backed Sessions
router.get('/companies/:companyId/sessions', companyGuard, requirePermission('settings.manage'), adminController.getActiveSessions);
router.post('/companies/:companyId/sessions/:id/terminate', companyGuard, requirePermission('settings.manage'), adminController.terminateSession);

// Custom User Permission Overrides Matrix
router.get('/companies/:companyId/members/:userId/permissions', companyGuard, requirePermission('settings.manage'), adminController.getUserPermissionDetails);
router.post('/companies/:companyId/members/:userId/permissions', companyGuard, requirePermission('settings.manage'), adminController.saveUserPermissionOverrides);
router.post('/companies/:companyId/members/:userId/permissions/:permissionId/approve', companyGuard, requirePermission('settings.manage'), adminController.approveUserPermissionOverride);

module.exports = router;
