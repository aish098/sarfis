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

  let newQty = 0;
  if (existing) {
    newQty = parseFloat(existing.quantity) + quantityDelta;
    if (newQty < 0) throw new Error('Insufficient stock');
    await trx('inventory')
      .where({ product_id: productId, warehouse_id: warehouseId })
      .update({ quantity: newQty, updated_at: trx.fn.now() });
  } else {
    if (quantityDelta < 0) throw new Error('Insufficient stock');
    await trx('inventory').insert({
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: quantityDelta,
    });
    newQty = quantityDelta;
  }

  // Hook for low stock check & auto-creation of Draft PO
  try {
    const product = await trx('products').where({ id: productId }).first();
    if (product && product.reorder_level > 0) {
      // Sum total stock of this product across all warehouses
      const sumRes = await trx('inventory')
        .where({ product_id: productId })
        .sum('quantity as total')
        .first();
      const totalStock = parseFloat(sumRes?.total || 0);

      if (totalStock <= product.reorder_level) {
        // Check if there is already a draft or pending PO for this product
        const existingPO = await trx('purchase_order_items as poi')
          .join('purchase_orders as po', 'poi.purchase_order_id', 'po.id')
          .where('poi.product_id', productId)
          .whereIn('po.status', ['DRAFT', 'PENDING_APPROVAL'])
          .first();

        if (!existingPO) {
          const poService = require('../services/purchase_order.service');
          const NotificationService = require('../services/notification.service');

          // Find the last vendor this product was purchased from (via stock_logs)
          const lastPurchase = await trx('stock_logs')
            .where({ product_id: productId, type: 'PURCHASE' })
            .orderBy('created_at', 'desc')
            .first();

          let vendorId = null;
          if (lastPurchase && lastPurchase.reference_id && lastPurchase.reference_type === 'voucher') {
            const voucher = await trx('vouchers').where({ id: lastPurchase.reference_id }).first();
            if (voucher && voucher.payload && voucher.payload.vendorId) {
              vendorId = voucher.payload.vendorId;
            }
          }

          // If no last vendor, fallback to first active vendor in company
          if (!vendorId) {
            const firstVendor = await trx('vendors')
              .where({ company_id: product.company_id, is_active: true })
              .orderBy('id', 'asc')
              .first();
            vendorId = firstVendor ? firstVendor.id : null;
          }

          // Find first user (usually admin/creator)
          const firstUser = await trx('users')
            .where({ company_id: product.company_id })
            .orderBy('id', 'asc')
            .first();
          const creatorId = firstUser ? firstUser.id : null;

          // Standard restock qty
          const reorderQty = Math.max(10, product.reorder_level * 2);

          // Create the PO draft
          const po = await poService.createPurchaseOrder({
            companyId: product.company_id,
            vendorId,
            date: new Date(),
            notes: `Auto-generated Draft PO due to low stock level.`,
            items: [{ productId, quantity: reorderQty, unitPrice: product.cost_price }],
            userId: creatorId
          });

          // Send low stock notification
          await NotificationService.notifyUsersWithPermission({
            companyId: product.company_id,
            permissionCode: 'voucher.view',
            title: 'Low Stock Detected',
            message: `Low stock detected for "${product.name}" (SKU: ${product.sku}). Draft Purchase Order ${po.po_number} has been created.`,
            type: 'system',
            priority: 'HIGH'
          });
        }
      }
    }
  } catch (err) {
    console.error('[LOW STOCK PO AUTO-CREATION ERROR]', err);
  }

  return newQty;
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
