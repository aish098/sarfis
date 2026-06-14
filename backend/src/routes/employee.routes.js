const router = require('express').Router();
const employeeCtrl = require('../controllers/employee.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/employees/:companyId', companyGuard, employeeCtrl.getEmployees);
router.post('/employees/:companyId', companyGuard, requirePermission('user.manage'), employeeCtrl.createEmployee);
router.patch('/employees/:companyId/:id', companyGuard, requirePermission('user.manage'), employeeCtrl.updateEmployee);
router.delete('/employees/:companyId/:id', companyGuard, requirePermission('user.manage'), employeeCtrl.deleteEmployee);

module.exports = router;
