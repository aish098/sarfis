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
router.post('/assets/transfer', FixedAssetsController.transferAsset);
router.post('/assets/maintenance', FixedAssetsController.logMaintenance);

// Depreciation Calculator & Wizard
router.get('/depreciation/preview', FixedAssetsController.getDepreciationPreview);
router.post('/depreciation/run', FixedAssetsController.postDepreciationRun);

module.exports = router;
