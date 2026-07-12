const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const db = require('../config/db');

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.get('/me', authMiddleware, authController.getCurrentUser);

const bcrypt = require('bcrypt');

router.get('/debug-db', async (req, res) => {
  try {
    const hash = await bcrypt.hash('password', 10);
    const affected = await db('users').where({ email: 'aisha@gmail.com' }).update({ password: hash });
    res.json({ message: 'Password reset successfully!', affected });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;
