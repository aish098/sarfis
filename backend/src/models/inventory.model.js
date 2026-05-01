const db = require('../config/db'); // your existing knex instance

// ─── WAREHOUSES ───────────────────────────────────────────
const getWarehouses = (companyId) =>
  db('warehouses').where({ company_id: companyId, is_active: true }).orderBy('name');

const createWarehouse = (data) =>
  db('warehouses').insert(data).returning('*').then(r => r[0]);

const updateWarehouse = (id, companyId, data) =>
  db('warehouses').where({ id, company_id: companyId })
    .update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]);

const deleteWarehouse = (id, companyId) =>
  db('warehouses').where({ id, company_id: companyId }).delete();

// ─── PRODUCTS ─────────────────────────────────────────────
const getProducts = (companyId) =>
  db('products').where({ company_id: companyId, is_active: true }).orderBy('sku');

const getProductById = (id, companyId) =>
  db('products').where({ id, company_id: companyId }).first();

const createProduct = (data) =>
  db('products').insert(data).returning('*').then(r => r[0]);

const updateProduct = (id, companyId, data) =>
  db('products').where({ id, company_id: companyId })
    .update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]);

// ─── STOCK SUMMARY ────────────────────────────────────────
const getStockSummary = (companyId) =>
  db('v_stock_summary').where({ company_id: companyId }).orderBy('product_name');

const getLowStockAlerts = (companyId) =>
  db('v_stock_summary').where({ company_id: companyId, low_stock: true });

const getStockByProduct = (productId) =>
  db('inventory as i')
    .join('warehouses as w', 'w.id', 'i.warehouse_id')
    .where('i.product_id', productId)
    .select('i.*', 'w.name as warehouse_name', 'w.location');

// ─── STOCK LOGS ───────────────────────────────────────────
const getStockLogs = (productId, limit = 50) =>
  db('stock_logs as sl')
    .join('warehouses as w', 'w.id', 'sl.warehouse_id')
    .where('sl.product_id', productId)
    .select('sl.*', 'w.name as warehouse_name')
    .orderBy('sl.created_at', 'desc')
    .limit(limit);

const getRecentStockLogs = (companyId, limit = 20) =>
  db('stock_logs as sl')
    .join('products as p', 'p.id', 'sl.product_id')
    .join('warehouses as w', 'w.id', 'sl.warehouse_id')
    .where('p.company_id', companyId)
    .select('sl.*', 'p.name as product_name', 'p.sku', 'w.name as warehouse_name')
    .orderBy('sl.created_at', 'desc')
    .limit(limit);

// ─── INVENTORY ADJUSTMENT (raw DB op — use service for business logic) ────
const upsertInventory = async (trx, productId, warehouseId, quantityDelta) => {
  // Try to update existing record
  const existing = await trx('inventory')
    .where({ product_id: productId, warehouse_id: warehouseId })
    .first();

  if (existing) {
    const newQty = parseFloat(existing.quantity) + quantityDelta;
    if (newQty < 0) throw new Error('Insufficient stock');
    await trx('inventory')
      .where({ product_id: productId, warehouse_id: warehouseId })
      .update({ quantity: newQty, updated_at: trx.fn.now() });
    return newQty;
  } else {
    if (quantityDelta < 0) throw new Error('Insufficient stock');
    await trx('inventory').insert({
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: quantityDelta,
    });
    return quantityDelta;
  }
};

const insertStockLog = (trx, logData) =>
  trx('stock_logs').insert(logData).returning('*').then(r => r[0]);

// ─── DASHBOARD WIDGETS ────────────────────────────────────
const getInventoryDashboardStats = async (companyId) => {
  const [totalProducts] = await db('products').where({ company_id: companyId, is_active: true }).count('* as count');
  const [lowStock] = await db('v_stock_summary').where({ company_id: companyId, low_stock: true }).count('* as count');
  const stockValue = await db('v_stock_summary')
    .where({ company_id: companyId })
    .select(db.raw('SUM(total_qty * cost_price) as value'))
    .first();

  return {
    totalProducts: parseInt(totalProducts.count),
    lowStockCount: parseInt(lowStock.count),
    totalStockValue: parseFloat(stockValue?.value || 0),
  };
};

module.exports = {
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  getProducts, getProductById, createProduct, updateProduct,
  getStockSummary, getLowStockAlerts, getStockByProduct,
  getStockLogs, getRecentStockLogs,
  upsertInventory, insertStockLog,
  getInventoryDashboardStats,
};
