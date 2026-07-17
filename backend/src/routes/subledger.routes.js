const express = require('express');
const router = express.Router();
const subledgerController = require('../controllers/subledger.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Routes
router.get('/summary', subledgerController.getSubledgerSummary);
router.get('/receivables', subledgerController.getReceivablesSubledger);
router.get('/payables', subledgerController.getPayablesSubledger);
router.get('/aging/:type', subledgerController.getAgingAnalysis);
router.get('/aging/:type/:id', subledgerController.getIndividualAging);
router.get('/statement/:type/:id', subledgerController.getSubledgerStatement);

module.exports = router;
