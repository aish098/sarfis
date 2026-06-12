const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledger.controller');
const { authMiddleware, requirePermission } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Routes
router.get('/account/:accountId', requirePermission('ledger.view'), ledgerController.getLedgerByAccount);

module.exports = router;
