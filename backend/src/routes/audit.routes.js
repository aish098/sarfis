const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Admins can view audit logs
router.get('/:companyId', companyGuard, requirePermission('settings.manage'), auditController.getLogs);

// Any user can log an action if they have access to the company
router.post('/:companyId', companyGuard, auditController.logAction);

module.exports = router;
