const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/overview', adminController.getOverview);
router.post('/companies', adminController.createCompany);
router.patch('/companies/:companyId', adminController.updateCompany);
router.post('/companies/:companyId/members', adminController.addMember);
router.patch('/companies/:companyId/members/:userId', adminController.updateMemberRole);
router.delete('/companies/:companyId/members/:userId', adminController.removeMember);

module.exports = router;
