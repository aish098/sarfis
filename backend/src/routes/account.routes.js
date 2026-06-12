const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { authMiddleware, requirePermission } = require('../middleware/auth.middleware');
const { validateAccount } = require('../middleware/validation.middleware');

// Protect all routes
router.use(authMiddleware);

// Routes
router.get('/', requirePermission('ledger.view'), accountController.getAccountsByCompany);
router.get('/company/:companyId', requirePermission('ledger.view'), accountController.getAccountsByCompany);

router.post('/', requirePermission('journal.create'), validateAccount, accountController.createAccount);
router.put('/:id', requirePermission('journal.create'), validateAccount, accountController.updateAccount);
router.delete('/:id', requirePermission('journal.create'), accountController.deleteAccount);

module.exports = router;
