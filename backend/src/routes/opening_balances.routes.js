const express = require('express');
const router = express.Router();
const openingBalancesController = require('../controllers/opening_balances.controller');
const { authMiddleware, requirePermission } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Define opening balances routes
router.get('/fiscal-years', requirePermission('opening_balances.view'), openingBalancesController.getFiscalYears);
router.get('/', requirePermission('opening_balances.view'), openingBalancesController.getOpeningBalances);
router.post('/', requirePermission('opening_balances.manage'), openingBalancesController.saveOpeningBalancesDraft);
router.post('/clear', requirePermission('opening_balances.manage'), openingBalancesController.clearOpeningBalancesDraft);
router.post('/post', requirePermission('opening_balances.post'), openingBalancesController.postOpeningBalances);

module.exports = router;
