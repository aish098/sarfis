const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const db = require('../config/db');

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.get('/me', authMiddleware, authController.getCurrentUser);

router.get('/debug-db', async (req, res) => {
  try {
    const info = await db('communications').columnInfo();
    res.json({ message: 'Table exists!', columns: Object.keys(info) });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;
