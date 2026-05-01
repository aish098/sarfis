const inventoryModel = require('../models/inventory.model');
const inventoryService = require('../services/inventory.service');

// ─── WAREHOUSES ───────────────────────────────────────────
exports.getWarehouses = async (req, res) => {
  try {
    const data = await inventoryModel.getWarehouses(req.params.companyId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createWarehouse = async (req, res) => {
  try {
    const wh = await inventoryModel.createWarehouse({
      company_id: req.params.companyId,
      ...req.body,
    });
    res.status(201).json(wh);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateWarehouse = async (req, res) => {
  try {
    const wh = await inventoryModel.updateWarehouse(req.params.id, req.params.companyId, req.body);
    if (!wh) return res.status(404).json({ error: 'Warehouse not found' });
    res.json(wh);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteWarehouse = async (req, res) => {
  try {
    await inventoryModel.deleteWarehouse(req.params.id, req.params.companyId);
    res.status(204).end();
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── PRODUCTS ─────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const data = await inventoryModel.getProducts(req.params.companyId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    for (const key in data) {
      if (data[key] === '') data[key] = null;
    }
    const product = await inventoryModel.createProduct({
      company_id: req.params.companyId,
      ...data,
    });
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    for (const key in data) {
      if (data[key] === '') data[key] = null;
    }
    const product = await inventoryModel.updateProduct(req.params.id, req.params.companyId, data);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── STOCK ────────────────────────────────────────────────
exports.getStockSummary = async (req, res) => {
  try {
    const data = await inventoryModel.getStockSummary(req.params.companyId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLowStockAlerts = async (req, res) => {
  try {
    const data = await inventoryModel.getLowStockAlerts(req.params.companyId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getStockByProduct = async (req, res) => {
  try {
    const data = await inventoryModel.getStockByProduct(req.params.productId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getStockLogs = async (req, res) => {
  try {
    const data = await inventoryModel.getStockLogs(req.params.productId, req.query.limit);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── PURCHASE (stock in + journal) ────────────────────────
exports.processPurchase = async (req, res) => {
  try {
    const result = await inventoryService.processPurchase({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body,
    });
    res.status(201).json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── ADJUSTMENT ───────────────────────────────────────────
exports.adjustStock = async (req, res) => {
  try {
    const result = await inventoryService.processAdjustment({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body,
    });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── DASHBOARD ────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const [stats, recentLogs, lowStock] = await Promise.all([
      inventoryModel.getInventoryDashboardStats(req.params.companyId),
      inventoryModel.getRecentStockLogs(req.params.companyId, 10),
      inventoryModel.getLowStockAlerts(req.params.companyId),
    ]);
    res.json({ stats, recentLogs, lowStock });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
