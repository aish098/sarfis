const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journal.controller');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// Protect all routes
router.use(authMiddleware);

// Roles
const READ_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Viewer'];
const WRITE_ROLES = ['Company Admin', 'Accountant'];

// Routes
router.get('/', checkRole(READ_ROLES), journalController.getJournalEntries);
router.get('/:id', checkRole(READ_ROLES), journalController.getEntryDetail);

router.post('/', checkRole(WRITE_ROLES), journalController.createJournalEntry);
router.delete('/:id', checkRole(WRITE_ROLES), journalController.deleteJournalEntry);

module.exports = router;
