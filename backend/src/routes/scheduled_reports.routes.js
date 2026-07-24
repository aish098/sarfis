const router = require('express').Router();
const ctrl = require('../controllers/scheduled_reports.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/',       companyGuard, requirePermission('settings.manage'), ctrl.createSchedule);
router.get('/',        companyGuard, requirePermission('settings.manage'), ctrl.getSchedules);
router.put('/:id/toggle', companyGuard, requirePermission('settings.manage'), ctrl.toggleSchedule);
router.delete('/:id',  companyGuard, requirePermission('settings.manage'), ctrl.deleteSchedule);
router.get('/:id/download', companyGuard, requirePermission('settings.manage'), ctrl.downloadScheduleReport);
router.post('/run',    companyGuard, requirePermission('settings.manage'), ctrl.runPending);

module.exports = router;
