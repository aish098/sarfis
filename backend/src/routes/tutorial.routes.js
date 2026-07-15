const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tutorialController = require('../controllers/tutorial.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer video config
const uploadVideo = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for video files
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Multer manual config
const uploadManual = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for PDF manuals
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF manuals are allowed'));
    }
  }
});

// 1. PUBLIC ROUTING (No authentication needed for viewing tutorials on marketing site)
router.get('/', tutorialController.getLatestPublished);
router.post('/videos/:id/watch', tutorialController.recordVideoWatch);
router.post('/manuals/:id/download', tutorialController.recordManualDownload);

// 2. ADMIN ROUTING (Authentication and authorization guards applied)
router.use(authMiddleware);

// Fetch current draft configurations
router.get('/draft', companyGuard, requirePermission('tutorial.view'), tutorialController.getDraft);

// Save settings draft (title & description)
router.post('/', companyGuard, requirePermission('tutorial.manage'), tutorialController.saveDraft);

// Upload video
router.post('/upload-video', companyGuard, requirePermission('tutorial.manage'), uploadVideo.single('video'), tutorialController.uploadVideo);

// Delete video
router.delete('/videos/:id', companyGuard, requirePermission('tutorial.manage'), tutorialController.deleteVideo);

// Upload PDF manual
router.post('/upload-manual', companyGuard, requirePermission('tutorial.manage'), uploadManual.single('manual'), tutorialController.uploadManual);

// Publish changes live
router.put('/publish', companyGuard, requirePermission('tutorial.publish'), tutorialController.publish);

module.exports = router;
