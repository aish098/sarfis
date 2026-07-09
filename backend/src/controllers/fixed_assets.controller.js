const FixedAssetsService = require('../services/fixed_assets.service');
const AssetInquiryService = require('../services/asset_inquiry.service');
const AssetMovementService = require('../services/asset_movement.service');

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
      const result = await AssetMovementService.disposeAsset(companyId, userId, req.body);
      res.json(result);
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

  // Transfers
  static async requestTransfer(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.requestTransfer(companyId, userId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getTransferRequests(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const { status } = req.query;
      const requests = await AssetMovementService.getTransferRequests(companyId, status);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  }

  static async approveTransfer(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const { requestId } = req.body;
      const result = await AssetMovementService.approveTransfer(companyId, userId, requestId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async rejectTransfer(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const { requestId } = req.body;
      const result = await AssetMovementService.rejectTransfer(companyId, userId, requestId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Work orders (Maintenance)
  static async createWorkOrder(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.createWorkOrder(companyId, userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getWorkOrders(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const { status } = req.query;
      const wos = await AssetMovementService.getWorkOrders(companyId, status);
      res.json(wos);
    } catch (err) {
      next(err);
    }
  }

  static async updateWorkOrder(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.updateWorkOrder(companyId, userId, req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Reservation & Checkout
  static async reserveAsset(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.reserveAsset(companyId, userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async checkoutAsset(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.checkoutAsset(companyId, userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async checkinAsset(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.checkinAsset(companyId, userId, req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getAssignments(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const result = await AssetMovementService.getAssignments(companyId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Physical Verification
  static async createVerificationSession(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.createVerificationSession(companyId, userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getVerificationSessions(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const result = await AssetMovementService.getVerificationSessions(companyId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getVerificationSessionItems(req, res, next) {
    try {
      const result = await AssetMovementService.getVerificationSessionItems(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async logVerificationItem(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.logVerificationItem(companyId, userId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async completeVerificationSession(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || 1;
      const userId = req.user?.id || 1;
      const result = await AssetMovementService.completeVerificationSession(companyId, userId, req.params.id, req.body.status);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = FixedAssetsController;
