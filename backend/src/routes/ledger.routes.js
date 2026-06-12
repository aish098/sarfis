const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledger.controller');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Roles
const READ_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Viewer'];

// Routes
router.get('/account/:accountId', checkRole(READ_ROLES), ledgerController.getLedgerByAccount);

module.exports = router;
