const express = require('express');
const router = express.Router();
const SettingsModel = require('../models/settings.model');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Get settings for a company
router.get('/:companyId', companyGuard, requirePermission('settings.manage'), async (req, res) => {
  try {
    const { companyId } = req.params;
    const settings = await SettingsModel.getSettings(companyId);
    res.json(settings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// Update settings for a company
router.put('/:companyId', companyGuard, requirePermission('settings.manage'), async (req, res) => {
  try {
    const { companyId } = req.params;
    const value = req.body;
    
    const updatedSettings = await SettingsModel.upsertSettings(companyId, value);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
