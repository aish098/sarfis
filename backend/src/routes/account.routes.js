const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');
const { validateAccount } = require('../middleware/validation.middleware');

// Protect all routes
router.use(authMiddleware);

// Roles
const READ_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Viewer'];
const WRITE_ROLES = ['Company Admin', 'Accountant'];

// Routes
router.get('/', checkRole(READ_ROLES), accountController.getAccountsByCompany);
router.get('/company/:companyId', checkRole(READ_ROLES), accountController.getAccountsByCompany);

router.post('/', checkRole(WRITE_ROLES), validateAccount, accountController.createAccount);
router.put('/:id', checkRole(WRITE_ROLES), validateAccount, accountController.updateAccount);
router.delete('/:id', checkRole(WRITE_ROLES), accountController.deleteAccount);

module.exports = router;
