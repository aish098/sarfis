const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journal.controller');
const { authMiddleware, requirePermission } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Routes
router.get('/', requirePermission('journal.view'), journalController.getJournalEntries);
router.get('/:id', requirePermission('journal.view'), journalController.getEntryDetail);

router.post('/', requirePermission('journal.create'), journalController.createJournalEntry);
router.put('/:id', requirePermission('journal.create'), journalController.updateJournalEntry);
router.post('/:id/submit', requirePermission('journal.create'), journalController.submitJournalForApproval);
router.post('/:id/post', requirePermission('journal.post'), journalController.postJournalEntry);
router.post('/:id/reverse', requirePermission('journal.post'), journalController.reverseJournalEntry);
router.delete('/:id', requirePermission('journal.create'), journalController.deleteJournalEntry); // Assuming creator can delete draft

module.exports = router;
