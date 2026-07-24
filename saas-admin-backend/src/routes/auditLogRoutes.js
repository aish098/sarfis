const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');

router.use(authMiddleware);

router.get('/', rbacMiddleware('audit.view'), auditLogController.getAuditLogs);

module.exports = router;
