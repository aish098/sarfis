const db = require('../config/db');
const inventoryModel = require('../models/inventory.model');

/**
 * PURCHASE FLOW
 * ─────────────
 * Inventory ↑ (Debit inventory asset account)
 * Accounts Payable ↑ (Credit AP)
 * Stock log: PURCHASE
 * Recalculates WAC using Row-level Locking (preventing race conditions).
 */
const processPurchase = async ({
  companyId, productId, warehouseId, quantity, unitCost,
  apAccountId, userId, reference, notes,
}) => {
  const product = await inventoryModel.getProductById(productId, companyId);
  if (!product) throw new Error('Product not found');
  if (!product.inventory_account_id) throw new Error('Product has no inventory COA account linked');

  const totalCost = parseFloat(quantity) * parseFloat(unitCost);

  return db.transaction(async (trx) => {
    // Lock the product row for cost updates
    const lockedProduct = await trx('products')
      .where({ id: productId, company_id: companyId })
      .forUpdate()
      .first();

    // 1. Create journal entry
    const [je] = await trx('journal_entries').insert({
      company_id: companyId,
      entry_date: new Date(),
      description: `Purchase: ${lockedProduct.name} x${quantity}`,
      created_by: userId,
    }).returning('*');

    // 2. Journal lines: Dr Inventory, Cr AP
    await trx('journal_lines').insert([
      {
        entry_id: je.id,
        account_id: lockedProduct.inventory_account_id,
        debit: totalCost,
        credit: 0,
      },
      {
        entry_id: je.id,
        account_id: apAccountId,
        debit: 0,
        credit: totalCost,
      },
    ]);

    // Calculate WAC
    const stockSummary = await trx('inventory')
      .where('product_id', productId)
      .sum('quantity as total_qty')
      .first();

    const q_curr = parseFloat(stockSummary?.total_qty || 0);
    const c_curr = parseFloat(lockedProduct.cost_price || 0);
    const q_new = parseFloat(quantity);
    const c_new = parseFloat(unitCost);

    let newWAC = c_new;
    if (q_curr + q_new > 0) {
      newWAC = ((q_curr * c_curr) + (q_new * c_new)) / (q_curr + q_new);
    }

    // Update WAC cost price
    await trx('products')
      .where({ id: productId, company_id: companyId })
      .update({ cost_price: newWAC, updated_at: trx.fn.now() });

    // 3. Update inventory
    const newQty = await inventoryModel.upsertInventory(trx, productId, warehouseId, parseFloat(quantity));

    // 4. Stock log
    await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: warehouseId,
      type: 'PURCHASE',
      quantity_change: parseFloat(quantity),
      quantity_after: newQty,
      unit_cost: unitCost,
      reference_id: je.id,
      reference_type: 'journal_entry',
      notes,
      created_by: userId,
    });

    return { journalEntry: je, newQuantity: newQty };
  });
};

/**
 * SALE FLOW (linked to delivery)
 * ──────────────────────────────
 * Accounts Receivable ↑ (Debit)
 * Revenue ↑ (Credit)
 * COGS ↑ (Debit)
 * Inventory ↓ (Credit)
 * Stock log: SALE
 */
const processSale = async ({
  companyId, deliveryId, items, clientId,
  arAccountId, userId,
}) => {
  return db.transaction(async (trx) => {
    let totalRevenue = 0;
    let totalCOGS = 0;
    const jeLines = [];
    let firstRevenueAccountId = null;

    for (const item of items) {
      const product = await inventoryModel.getProductById(item.product_id, companyId);
      if (!product) throw new Error(`Product ${item.product_id} not found`);

      let inventoryAccountId = product.inventory_account_id;
      let cogsAccountId = product.cogs_account_id;
      let revenueAccountId = product.revenue_account_id;

      if (!inventoryAccountId || !cogsAccountId || !revenueAccountId) {
        const SettingsModel = require('../models/settings.model');
        const settings = await SettingsModel.getSettings(companyId);

        if (!inventoryAccountId && settings.default_inventory_account_id) {
          inventoryAccountId = parseInt(settings.default_inventory_account_id);
        }
        if (!cogsAccountId && settings.default_cogs_account_id) {
          cogsAccountId = parseInt(settings.default_cogs_account_id);
        }
        if (!revenueAccountId && settings.default_sales_account_id) {
          revenueAccountId = parseInt(settings.default_sales_account_id);
        }
      }

      if (!inventoryAccountId || !cogsAccountId || !revenueAccountId) {
        throw new Error(`Cannot process sale: Inventory, COGS, or Revenue account is not configured for product "${product.name}" and no company default account exists.`);
      }

      if (!firstRevenueAccountId) {
        firstRevenueAccountId = revenueAccountId;
      }

      const lineRevenue = parseFloat(item.quantity) * parseFloat(item.unit_price);
      const lineCOGS = parseFloat(item.quantity) * parseFloat(item.unit_cost);
      totalRevenue += lineRevenue;
      totalCOGS += lineCOGS;

      // Stock deduction
      const newQty = await inventoryModel.upsertInventory(trx, item.product_id, item.warehouse_id, -parseFloat(item.quantity));

      // Per-product lines: Dr COGS, Cr Inventory
      jeLines.push(
        { account_id: cogsAccountId, debit: lineCOGS, credit: 0 },
        { account_id: inventoryAccountId, debit: 0, credit: lineCOGS },
      );

      await inventoryModel.insertStockLog(trx, {
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        type: 'SALE',
        quantity_change: -parseFloat(item.quantity),
        quantity_after: newQty,
        unit_cost: item.unit_cost,
        reference_id: deliveryId,
        reference_type: 'delivery',
        created_by: userId,
      });
    }

    // Revenue lines
    const [je] = await trx('journal_entries').insert({
      company_id: companyId,
      entry_date: new Date(),
      description: `Sale: Delivery Order #${deliveryId}`,
      created_by: userId,
    }).returning('*');

    // Dr AR, Cr Revenue + Dr COGS, Cr Inventory
    await trx('journal_lines').insert([
      { entry_id: je.id, account_id: arAccountId, debit: totalRevenue, credit: 0 },
      { entry_id: je.id, account_id: firstRevenueAccountId, debit: 0, credit: totalRevenue },
      ...jeLines.map(l => ({ ...l, entry_id: je.id })),
    ]);

    return { journalEntry: je, totalRevenue, totalCOGS };
  });
};

/**
 * STOCK ADJUSTMENT (manual correction)
 * Routes GL posting through PostingEngine to enforce architectural separation.
 */
const processAdjustment = async ({ companyId, productId, warehouseId, adjustmentQty, notes, userId, date }) => {
  const PostingEngineService = require('./posting_engine.service');

  return db.transaction(async (trx) => {
    const product = await trx('products').where({ id: productId, company_id: companyId }).first();
    if (!product) throw new Error('Product not found');

    const newQty = await inventoryModel.upsertInventory(trx, productId, warehouseId, parseFloat(adjustmentQty));
    
    // Call Posting Engine to post the GL entry
    const postingResult = await PostingEngineService.postTransaction({
      type: 'INVENTORY_ADJUSTMENT',
      companyId,
      payload: {
        productId,
        warehouseId,
        quantity: parseFloat(adjustmentQty),
        notes,
        date
      },
      userId
    }, trx);

    // Create stock log linked to the journal entry generated by the Posting Engine
    await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: warehouseId,
      type: 'ADJUSTMENT',
      quantity_change: parseFloat(adjustmentQty),
      quantity_after: newQty,
      unit_cost: parseFloat(product.cost_price || 0),
      reference_id: postingResult.journalEntryId,
      reference_type: 'journal_entry',
      notes,
      created_by: userId,
    });

    return { newQuantity: newQty };
  });
};

/**
 * INTERNAL STOCK TRANSFER
 * Transfers stock between warehouses without impacting the General Ledger.
 * Logs events to inventory_transfers & inventory_transfer_lines.
 * Enforces negative inventory checks and warehouse capacity limits.
 */
const processTransfer = async ({
  companyId, productId, fromWarehouseId, toWarehouseId, quantity, userId, remarks, reference
}) => {
  const qty = parseFloat(quantity);
  if (qty <= 0) throw new Error('Transfer quantity must be positive.');

  return db.transaction(async (trx) => {
    // 1. Validate Product and Availability
    const product = await trx('products').where({ id: productId, company_id: companyId }).first();
    if (!product) throw new Error('Product not found.');

    const sourceStock = await trx('inventory')
      .where({ product_id: productId, warehouse_id: fromWarehouseId })
      .first();

    const available = parseFloat(sourceStock?.quantity || 0);
    if (available < qty) {
      throw new Error(`Insufficient stock in source warehouse. Available: ${available}, Required: ${qty}`);
    }

    // 2. Validate Warehouse Capacity Limits
    const destWh = await trx('warehouses')
      .where({ id: toWarehouseId, company_id: companyId })
      .first();
    if (!destWh) throw new Error('Destination warehouse not found.');

    const currentOccupiedRes = await trx('inventory')
      .where({ warehouse_id: toWarehouseId })
      .sum('quantity as total')
      .first();
    const currentOccupied = parseFloat(currentOccupiedRes?.total || 0);
    const capacityLimit = parseFloat(destWh.capacity_value || 10000);

    if (currentOccupied + qty > capacityLimit) {
      throw new Error(`Destination warehouse capacity exceeded. Limit: ${capacityLimit}, Current: ${currentOccupied}, Incoming: ${qty}`);
    }

    // 3. Decrement source, Increment destination
    const newSrcQty = await inventoryModel.upsertInventory(trx, productId, fromWarehouseId, -qty);
    const newDstQty = await inventoryModel.upsertInventory(trx, productId, toWarehouseId, qty);

    // 4. Write stock logs for TRANSFER_OUT and TRANSFER_IN
    await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: fromWarehouseId,
      type: 'TRANSFER_OUT',
      quantity_change: -qty,
      quantity_after: newSrcQty,
      unit_cost: parseFloat(product.cost_price || 0),
      reference_type: 'transfer',
      notes: remarks || `Transfer to WH #${toWarehouseId}`,
      created_by: userId
    });

    await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: toWarehouseId,
      type: 'TRANSFER_IN',
      quantity_change: qty,
      quantity_after: newDstQty,
      unit_cost: parseFloat(product.cost_price || 0),
      reference_type: 'transfer',
      notes: remarks || `Transfer from WH #${fromWarehouseId}`,
      created_by: userId
    });

    // 5. Generate formatted Transfer Reference
    const nextRefNum = reference || `TRF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // 6. Create tracking records
    const [transfer] = await trx('inventory_transfers').insert({
      company_id: companyId,
      reference: nextRefNum,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      status: 'COMPLETED',
      created_by: userId,
      transfer_date: new Date()
    }).returning('*');

    await trx('inventory_transfer_lines').insert({
      inventory_transfer_id: transfer.id,
      product_id: productId,
      quantity: qty,
      cost: parseFloat(product.cost_price || 0),
      remarks: remarks || 'Internal Transfer'
    });

    return { transferId: transfer.id, reference: nextRefNum, fromQty: newSrcQty, toQty: newDstQty };
  });
};

module.exports = { processPurchase, processSale, processAdjustment, processTransfer };
