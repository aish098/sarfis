const FixedAssetsService = require('../services/fixed_assets.service');
const AssetInquiryService = require('../services/asset_inquiry.service');

class FixedAssetsController {
  // Category Endpoints
  static async getCategories(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const categories = await FixedAssetsService.getCategories(companyId);
      res.json(categories);
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const category = await FixedAssetsService.createCategory(companyId, req.body);
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const category = await FixedAssetsService.updateCategory(companyId, req.params.id, req.body);
      res.json(category);
    } catch (err) {
      next(err);
    }
  }

  // Asset Endpoints
  static async getAssets(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const { status } = req.query;
      const assets = await FixedAssetsService.getAssets(companyId, status);
      res.json(assets);
    } catch (err) {
      next(err);
    }
  }

  static async createAsset(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const assetId = await FixedAssetsService.createAsset(companyId, userId, req.body);
      res.status(201).json({ id: assetId, message: 'Asset card registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  // 360-Degree Asset Inquiry
  static async getAssetInquiry(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const details = await AssetInquiryService.getAssetInquiryDetails(req.params.id, companyId);
      res.json(details);
    } catch (err) {
      next(err);
    }
  }

  // Depreciation Preview & Calculation Wizard
  static async getDepreciationPreview(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const { period, book = 'Accounting' } = req.query;
      if (!period) return res.status(400).json({ error: 'Period (YYYY-MM) parameter is required.' });

      const preview = await FixedAssetsService.calculateDepreciationRun(companyId, period, book);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  static async postDepreciationRun(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const { period } = req.body;
      if (!period) return res.status(400).json({ error: 'Period (YYYY-MM) is required.' });

      const result = await FixedAssetsService.postDepreciationRun(companyId, period, userId);
      res.json({
        message: `Depreciation posted successfully for period ${period}.`,
        runId: result.runId,
        voucherNumber: result.voucherNumber,
        totalAmount: result.totalAmount
      });
    } catch (err) {
      next(err);
    }
  }

  // Disposal lifecycle retiree
  static async disposeAsset(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const { asset_id, disposal_date, disposal_reason, proceeds_amount } = req.body;

      if (!asset_id || !disposal_date || !disposal_reason) {
        return res.status(400).json({ error: 'asset_id, disposal_date, and disposal_reason are required.' });
      }

      const result = await FixedAssetsService.disposeAsset(companyId, userId, {
        asset_id,
        disposal_date,
        disposal_reason,
        proceeds_amount: parseFloat(proceeds_amount || 0)
      });

      res.json({
        message: 'Asset retired successfully and posted to ledger.',
        voucherNumber: result.voucherNumber,
        gainLoss: result.gainLoss
      });
    } catch (err) {
      next(err);
    }
  }

  // Meter usage log for Units of Production
  static async logUsage(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const { asset_id, usage_date, units_used, source } = req.body;

      if (!asset_id || !usage_date || !units_used) {
        return res.status(400).json({ error: 'asset_id, usage_date, and units_used are required.' });
      }

      await FixedAssetsService.logUsage(companyId, userId, {
        asset_id,
        usage_date,
        units_used: parseFloat(units_used),
        source
      });

      res.status(201).json({ message: 'Asset usage logged successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async transferAsset(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      await FixedAssetsService.transferAsset(companyId, userId, req.body);
      res.json({ message: 'Asset transferred successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async logMaintenance(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      await FixedAssetsService.logMaintenance(companyId, userId, req.body);
      res.json({ message: 'Asset maintenance logged successfully.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = FixedAssetsController;
