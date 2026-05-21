const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { validateAccount } = require('../middleware/validation.middleware');

// Protect all routes
router.use(authMiddleware);

// Routes
router.post('/', validateAccount, accountController.createAccount);
router.get('/', accountController.getAccountsByCompany);
router.get('/company/:companyId', accountController.getAccountsByCompany);
router.put('/:id', validateAccount, accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

module.exports = router;
