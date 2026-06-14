const router = require('express').Router();
const notifCtrl = require('../controllers/notification.controller');
const { authMiddleware, companyGuard } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

router.get('/notifications/stream', notifCtrl.streamNotifications);
router.get('/notifications/:companyId', companyGuard, notifCtrl.getNotifications);
router.put('/notifications/:companyId/read-all', companyGuard, notifCtrl.markAllAsRead);
router.put('/notifications/:companyId/:id/read', companyGuard, notifCtrl.markAsRead);
router.put('/notifications/:companyId/:id/archive', companyGuard, notifCtrl.archiveNotification);

module.exports = router;
