const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth.middleware');
const { validateLogin } = require('../validators/authValidator');

// Brute-force Login Protection (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many failed login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/change-initial-password', authMiddleware, authController.changeInitialPassword);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.get('/sessions', authMiddleware, authController.getSessions);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
