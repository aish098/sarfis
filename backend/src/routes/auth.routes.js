const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const authRateLimiter = require('../middleware/auth_rate_limit.middleware');

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.post('/google', authRateLimiter, authController.googleLogin);
router.post('/google/create-workspace', authRateLimiter, authController.createWorkspaceWithGoogle);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.get('/seed-khaan', authController.seedKhaanUser);

// Account Identity Linking & Unlinking
router.post('/me/auth-identities/google/link', authMiddleware, authController.linkGoogleAccount);
router.delete('/me/auth-identities/google', authMiddleware, authController.unlinkGoogleAccount);

// Device Sessions Management
router.get('/me/sessions', authMiddleware, authController.getUserSessions);
router.delete('/me/sessions/:sessionId', authMiddleware, authController.revokeSession);
router.delete('/me/sessions', authMiddleware, authController.revokeAllSessions);

module.exports = router;

