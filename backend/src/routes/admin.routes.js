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

module.exports = router;
