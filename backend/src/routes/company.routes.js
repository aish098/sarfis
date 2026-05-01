const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.post('/', authMiddleware, companyController.createCompany);
router.get('/', authMiddleware, companyController.getCompanies);

module.exports = router;
