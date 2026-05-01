const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Routes
router.post('/', accountController.createAccount);
router.get('/', accountController.getAccountsByCompany);
router.get('/company/:companyId', accountController.getAccountsByCompany);
router.put('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

module.exports = router;
