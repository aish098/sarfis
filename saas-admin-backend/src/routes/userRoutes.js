const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');
const auditMiddleware = require('../middleware/audit.middleware');

router.use(authMiddleware);

// 1. Get All Users with Pagination, Search & Filters
router.get('/', rbacMiddleware('users.view'), userController.getAllUsers);

// 2. Get Single User Details
router.get('/:user_id', rbacMiddleware('users.view'), userController.getUserById);

// 3. Block or Unblock a User (Audited Action)
router.put(
  '/:user_id/block',
  rbacMiddleware('users.block'),
  auditMiddleware('USER_BLOCK_STATUS_TOGGLED', (req, resData) => ({
    targetType: 'user',
    targetId: req.params.user_id,
    payload: { status: req.body.status, reason: req.body.reason }
  })),
  userController.toggleBlockStatus
);

module.exports = router;
