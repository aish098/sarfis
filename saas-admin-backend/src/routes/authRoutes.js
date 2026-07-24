const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth.middleware');
const { validateLogin } = require('../validators/authValidator');

// Brute-force Login Protection (100 attempts in dev, 5 in production)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
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
