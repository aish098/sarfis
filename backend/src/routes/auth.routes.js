const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.get('/seed-khaan', authController.seedKhaanUser);

module.exports = router;
