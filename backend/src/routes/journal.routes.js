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
router.post('/:id/request-correction', requirePermission('journal.request_correction'), journalController.requestCorrection);
router.post('/correction-requests/:id/approve', requirePermission('journal.approve_correction'), journalController.approveCorrectionRequest);
router.post('/correction-requests/:id/reject', requirePermission('journal.reject_correction'), journalController.rejectCorrectionRequest);
router.post('/correction-requests/:id/execute', requirePermission('journal.execute_correction'), journalController.executeCorrectionRequest);

module.exports = router;
