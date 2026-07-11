const router = require('express').Router();
const employeeCtrl = require('../controllers/employee.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/employees/:companyId', companyGuard, employeeCtrl.getEmployees);
router.get('/employees/:companyId/users', companyGuard, employeeCtrl.getCompanyUsers);
router.post('/employees/:companyId', companyGuard, requirePermission('user.manage'), employeeCtrl.createEmployee);
router.patch('/employees/:companyId/:id', companyGuard, requirePermission('user.manage'), employeeCtrl.updateEmployee);
router.delete('/employees/:companyId/:id', companyGuard, requirePermission('user.manage'), employeeCtrl.deleteEmployee);

router.get('/employees/:companyId/:id/notification-subscriptions', companyGuard, employeeCtrl.getNotificationSubscriptions);
router.put('/employees/:companyId/:id/notification-subscriptions', companyGuard, requirePermission('user.manage'), employeeCtrl.updateNotificationSubscriptions);

module.exports = router;
