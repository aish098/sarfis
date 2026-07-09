const router = require('express').Router();
const FixedAssetsController = require('../controllers/fixed_assets.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Categories
router.get('/categories', FixedAssetsController.getCategories);
router.post('/categories', FixedAssetsController.createCategory);
router.put('/categories/:id', FixedAssetsController.updateCategory);

// Assets
router.get('/assets', FixedAssetsController.getAssets);
router.post('/assets', FixedAssetsController.createAsset);
router.get('/assets/:id/inquiry', FixedAssetsController.getAssetInquiry);
router.post('/assets/dispose', FixedAssetsController.disposeAsset);
router.post('/assets/usage', FixedAssetsController.logUsage);
router.post('/assets/transfer/request', FixedAssetsController.requestTransfer);
router.get('/assets/transfer/requests', FixedAssetsController.getTransferRequests);
router.post('/assets/transfer/approve', FixedAssetsController.approveTransfer);
router.post('/assets/transfer/reject', FixedAssetsController.rejectTransfer);

// Work Orders (Maintenance)
router.post('/assets/work-orders', FixedAssetsController.createWorkOrder);
router.get('/assets/work-orders', FixedAssetsController.getWorkOrders);
router.put('/assets/work-orders/:id', FixedAssetsController.updateWorkOrder);

// Assignments / Lending / Checkout
router.post('/assets/assignments/reserve', FixedAssetsController.reserveAsset);
router.post('/assets/assignments/checkout', FixedAssetsController.checkoutAsset);
router.post('/assets/assignments/checkin/:id', FixedAssetsController.checkinAsset);
router.get('/assets/assignments', FixedAssetsController.getAssignments);

// Physical Verifications
router.post('/assets/verification/sessions', FixedAssetsController.createVerificationSession);
router.get('/assets/verification/sessions', FixedAssetsController.getVerificationSessions);
router.get('/assets/verification/sessions/:id/items', FixedAssetsController.getVerificationSessionItems);
router.post('/assets/verification/verify', FixedAssetsController.logVerificationItem);
router.post('/assets/verification/sessions/:id/complete', FixedAssetsController.completeVerificationSession);

// Depreciation Calculator & Wizard
router.get('/depreciation/preview', FixedAssetsController.getDepreciationPreview);
router.post('/depreciation/run', FixedAssetsController.postDepreciationRun);

module.exports = router;
