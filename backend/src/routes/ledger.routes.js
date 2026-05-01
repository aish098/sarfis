const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledger.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Routes
router.get('/account/:accountId', authMiddleware, ledgerController.getLedgerByAccount);

module.exports = router;
