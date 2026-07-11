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
router.put('/notifications/:companyId/:id/unarchive', companyGuard, notifCtrl.unarchiveNotification);
router.get('/notifications/preferences/:companyId', companyGuard, notifCtrl.getPreferences);
router.put('/notifications/preferences/:companyId', companyGuard, notifCtrl.updatePreferences);
router.get('/notifications/admin/email-queue/:companyId', companyGuard, notifCtrl.getEmailQueue);
router.post('/notifications/admin/email-queue/:id/resend/:companyId', companyGuard, notifCtrl.resendEmail);
router.post('/notifications/admin/email-queue/compose/:companyId', companyGuard, notifCtrl.composeCustomEmail);

module.exports = router;
