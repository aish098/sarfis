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

// ─── WAREHOUSE STATISTICS ──────────────────────────────────
exports.getWarehouseStatistics = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const WarehouseStatisticsService = require('../services/warehouse_statistics.service');
    const stats = await WarehouseStatisticsService.getWarehouseStatistics(companyId, id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PRODUCT INQUIRY ───────────────────────────────────────
exports.getProductInquiry = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const ProductInquiryService = require('../services/product_inquiry.service');
    const inquiry = await ProductInquiryService.getProductInquiryDetails(companyId, id);
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── STOCK TRANSFER ─────────────────────────────────────────
exports.transferStock = async (req, res) => {
  try {
    const result = await inventoryService.processTransfer({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── COST LAYERS INQUIRY ─────────────────────────────────────
exports.getCostLayers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { search, status = 'ACTIVE', warehouseId, productId, page = 1, limit = 20 } = req.query;
    const db = require('../config/db');

    const query = db('inventory_layers as il')
      .join('products as p', 'il.product_id', 'p.id')
      .join('warehouses as w', 'il.warehouse_id', 'w.id')
      .leftJoin('product_categories as pc', 'p.category_id', 'pc.id')
      .where('il.company_id', companyId);

    if (warehouseId) {
      query.where('il.warehouse_id', warehouseId);
    }
    if (productId) {
      query.where('il.product_id', productId);
    }
    if (search) {
      query.andWhere(function() {
        this.where('p.name', 'like', `%${search}%`)
            .orWhere('p.sku', 'like', `%${search}%`)
            .orWhere('il.source_document', 'like', `%${search}%`);
      });
    }

    if (status === 'ACTIVE') {
      query.where('il.remaining_qty', '>', 0);
    } else if (status === 'CONSUMED') {
      query.where('il.remaining_qty', '=', 0);
    } else if (status === 'ADJUSTED') {
      query.where('il.source_type', '=', 'adjustment');
    }

    const countQuery = query.clone();
    const [{ count }] = await countQuery.count('* as count');

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const layers = await query
      .select(
        'il.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'w.name as warehouse_name',
        'pc.name as category_name'
      )
      .orderBy('il.received_date', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    const formatted = layers.map(l => {
      let derivedStatus = 'Active';
      const rQty = parseFloat(l.remaining_qty);
      const recQty = parseFloat(l.received_qty);
      if (rQty === 0) derivedStatus = 'Fully Consumed';
      else if (l.source_type === 'adjustment') derivedStatus = 'Adjusted';
      else if (rQty < recQty) derivedStatus = 'Partially Consumed';

      return {
        ...l,
        received_qty: recQty,
        remaining_qty: rQty,
        unit_cost: parseFloat(l.unit_cost),
        remaining_value: rQty * parseFloat(l.unit_cost),
        original_value: recQty * parseFloat(l.unit_cost),
        status: derivedStatus
      };
    });

    res.json({
      data: formatted,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(count) / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── COST LAYER AUDIT & TIMELINE ─────────────────────────────
exports.getLayerAudit = async (req, res) => {
  try {
    const { companyId, layerId } = req.params;
    const db = require('../config/db');

    const layer = await db('inventory_layers as il')
      .join('products as p', 'il.product_id', 'p.id')
      .join('warehouses as w', 'il.warehouse_id', 'w.id')
      .where({ 'il.id': layerId, 'il.company_id': companyId })
      .select(
        'il.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'w.name as warehouse_name'
      )
      .first();

    if (!layer) {
      return res.status(404).json({ error: 'Cost layer not found.' });
    }

    const consumptions = await db('inventory_layer_consumptions as ilc')
      .where('ilc.layer_id', layerId)
      .orderBy('ilc.created_at', 'asc');

    const timeline = [];
    
    timeline.push({
      event: 'Acquisition',
      date: layer.received_date,
      description: `Layer created via ${layer.source_type} (${layer.source_document || 'N/A'}). Quantity: ${parseFloat(layer.received_qty)} @ PKR ${parseFloat(layer.unit_cost).toFixed(2)}`,
      quantity: parseFloat(layer.received_qty),
      docNumber: layer.source_document
    });

    consumptions.forEach(c => {
      timeline.push({
        event: 'Consumption',
        date: c.created_at,
        description: `Consumed ${parseFloat(c.issued_qty)} units via ${c.document_type} (${c.document_number || 'N/A'}). Cost: PKR ${parseFloat(c.extended_cost).toFixed(2)}`,
        quantity: parseFloat(c.issued_qty),
        docNumber: c.document_number
      });
    });

    res.json({
      layer: {
        ...layer,
        received_qty: parseFloat(layer.received_qty),
        remaining_qty: parseFloat(layer.remaining_qty),
        unit_cost: parseFloat(layer.unit_cost),
        remaining_value: parseFloat(layer.remaining_qty) * parseFloat(layer.unit_cost)
      },
      consumptions: consumptions.map(c => ({
        ...c,
        issued_qty: parseFloat(c.issued_qty),
        unit_cost: parseFloat(c.unit_cost),
        extended_cost: parseFloat(c.extended_cost)
      })),
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── COST FLOW DRILL-DOWN (BY STOCK LOG) ──────────────────────
exports.getLayerConsumptions = async (req, res) => {
  try {
    const { companyId, stockLogId } = req.params;
    const db = require('../config/db');

    const consumptions = await db('inventory_layer_consumptions as ilc')
      .join('inventory_layers as il', 'ilc.layer_id', 'il.id')
      .join('products as p', 'il.product_id', 'p.id')
      .where('ilc.stock_log_id', stockLogId)
      .where('ilc.company_id', companyId)
      .select(
        'ilc.*',
        'il.source_document as layer_source_document',
        'il.source_type as layer_source_type',
        'p.name as product_name',
        'p.sku as product_sku'
      );

    res.json(consumptions.map(c => ({
      ...c,
      issued_qty: parseFloat(c.issued_qty),
      unit_cost: parseFloat(c.unit_cost),
      extended_cost: parseFloat(c.extended_cost)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── INVENTORY VALUATION REPORT (SNAPSHOT "AS OF") ────────────
exports.getValuationReport = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { asOfDate, warehouseId, categoryId } = req.query;
    const db = require('../config/db');

    const parsedAsOf = asOfDate ? new Date(asOfDate) : new Date();

    const settings = await db('company_accounting_settings').where({ company_id: companyId }).first();
    const costingMethod = settings?.inventory_costing_method || 'AVERAGE';

    const layersQuery = db('inventory_layers as il')
      .join('products as p', 'il.product_id', 'p.id')
      .join('warehouses as w', 'il.warehouse_id', 'w.id')
      .leftJoin('product_categories as pc', 'p.category_id', 'pc.id')
      .where('il.company_id', companyId)
      .where('il.received_date', '<=', parsedAsOf);

    if (warehouseId) {
      layersQuery.where('il.warehouse_id', warehouseId);
    }
    if (categoryId) {
      layersQuery.where('p.category_id', categoryId);
    }

    const layers = await layersQuery.select(
      'il.*',
      'p.name as product_name',
      'p.sku as product_sku',
      'w.name as warehouse_name',
      'pc.id as category_id',
      'pc.name as category_name'
    );

    const reportData = [];
    let totalValue = 0;
    let activeLayersCount = 0;
    const uniqueProducts = new Set();

    for (const l of layers) {
      const consumptionsSum = await db('inventory_layer_consumptions')
        .where('layer_id', l.id)
        .where('created_at', '<=', parsedAsOf)
        .sum('issued_qty as total_issued')
        .first();

      const issued = parseFloat(consumptionsSum?.total_issued || 0);
      const remainingQty = parseFloat(l.received_qty) - issued;

      if (remainingQty > 0) {
        const val = remainingQty * parseFloat(l.unit_cost);
        totalValue += val;
        activeLayersCount++;
        uniqueProducts.add(l.product_id);

        reportData.push({
          layer_id: l.id,
          product_id: l.product_id,
          product_name: l.product_name,
          product_sku: l.product_sku,
          warehouse_id: l.warehouse_id,
          warehouse_name: l.warehouse_name,
          category_id: l.category_id,
          category_name: l.category_name || 'Unspecified',
          received_qty: parseFloat(l.received_qty),
          remaining_qty: remainingQty,
          unit_cost: parseFloat(l.unit_cost),
          layer_value: val,
          received_date: l.received_date
        });
      }
    }

    res.json({
      summary: {
        totalValue,
        productsCount: uniqueProducts.size,
        activeLayersCount,
        costingMethod
      },
      data: reportData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
