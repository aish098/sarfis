const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/auth.middleware');
const rbacMiddleware = require('../middleware/rbac.middleware');

router.use(authMiddleware);

router.get('/', rbacMiddleware('users.view'), companyController.getAllCompanies);
router.get('/:company_id', rbacMiddleware('users.view'), companyController.getCompanyById);

module.exports = router;
