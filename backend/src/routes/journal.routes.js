const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journal.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Routes
router.delete('/:id', authMiddleware, journalController.deleteJournalEntry);
router.post('/', authMiddleware, journalController.createJournalEntry);
router.get('/', authMiddleware, journalController.getJournalEntries);
router.get('/:id', authMiddleware, journalController.getEntryDetail);

module.exports = router;
