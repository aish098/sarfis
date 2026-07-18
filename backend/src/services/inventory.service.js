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
    const stockLog = await inventoryModel.insertStockLog(trx, {
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

    // Create cost layer for purchase
    await require('./inventory_costing.service').recordAcquisition(trx, {
      companyId,
      warehouseId,
      productId,
      quantity: parseFloat(quantity),
      unitCost: parseFloat(unitCost),
      sourceDocument: je.entry_number || String(je.id),
      sourceType: 'goods_receipt',
      userId
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
  const AccountModel = require('../models/account.model');
  return db.transaction(async (trx) => {
    let resolvedArAccountId = arAccountId;
    if (!resolvedArAccountId) {
      const SettingsModel = require('../models/settings.model');
      const settings = await SettingsModel.getSettings(companyId);
      resolvedArAccountId = settings.default_ar_account_id || settings.defaultArAccountId;
    }
    if (!resolvedArAccountId) {
      const arAcc = await trx('accounts')
        .where('company_id', companyId)
        .andWhere(function() {
          this.where('code', 'like', '12%').orWhere('name', 'like', '%Receivable%');
        })
        .first();
      if (arAcc) resolvedArAccountId = arAcc.id;
    }
    if (!resolvedArAccountId) {
      throw new Error('Accounts Receivable (AR) account mapping is missing for this company.');
    }

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
      totalRevenue += lineRevenue;

      // Stock deduction
      const newQty = await inventoryModel.upsertInventory(trx, item.product_id, item.warehouse_id, -parseFloat(item.quantity));

      // Insert stock log (with placeholder unit_cost)
      const stockLog = await inventoryModel.insertStockLog(trx, {
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        type: 'SALE',
        quantity_change: -parseFloat(item.quantity),
        quantity_after: newQty,
        unit_cost: 0, // Will update below
        reference_id: deliveryId,
        reference_type: 'delivery',
        created_by: userId,
      });

      // Consume cost layers
      const costingResult = await require('./inventory_costing.service').consumeIssue(trx, {
        companyId,
        warehouseId: item.warehouse_id,
        productId: item.product_id,
        quantity: parseFloat(item.quantity),
        documentType: 'delivery',
        documentNumber: String(deliveryId),
        stockLogId: stockLog.id,
        userId
      });

      const actualUnitCost = costingResult.blendedUnitCost;
      const lineCOGS = costingResult.totalCOGS;
      totalCOGS += lineCOGS;

      // Update stock log with actual cost
      await trx('stock_logs')
        .where({ id: stockLog.id })
        .update({ unit_cost: actualUnitCost });

      // Per-product lines: Dr COGS, Cr Inventory
      jeLines.push(
        { account_id: cogsAccountId, debit: lineCOGS, credit: 0 },
        { account_id: inventoryAccountId, debit: 0, credit: lineCOGS },
      );
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
      { entry_id: je.id, account_id: resolvedArAccountId, debit: totalRevenue, credit: 0 },
      { entry_id: je.id, account_id: firstRevenueAccountId, debit: 0, credit: totalRevenue },
      ...jeLines.map(l => ({ ...l, entry_id: je.id })),
    ]);

    // Update balance cache
    await AccountModel.updateBalance(resolvedArAccountId, companyId, totalRevenue, 0, trx);
    await AccountModel.updateBalance(firstRevenueAccountId, companyId, 0, totalRevenue, trx);
    for (const l of jeLines) {
      await AccountModel.updateBalance(l.account_id, companyId, l.debit, l.credit, trx);
    }

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

    const qty = parseFloat(adjustmentQty);
    let finalAmt = 0;
    let finalUnitCost = parseFloat(product.cost_price || 0);
    let costingResult = null;

    if (qty < 0) {
      // Consume layers for negative adjustment
      costingResult = await require('./inventory_costing.service').consumeIssue(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: Math.abs(qty),
        documentType: 'adjustment',
        documentNumber: 'Adj-Draft',
        stockLogId: null, // Will backfill
        userId
      });
      finalAmt = costingResult.totalCOGS;
      finalUnitCost = costingResult.blendedUnitCost;
    } else {
      finalAmt = qty * finalUnitCost;
    }

    // Call Posting Engine to post the GL entry
    const postingResult = await PostingEngineService.postTransaction({
      type: 'INVENTORY_ADJUSTMENT',
      companyId,
      payload: {
        productId,
        warehouseId,
        quantity: qty,
        amount: finalAmt,
        notes,
        date
      },
      userId
    }, trx);

    const newQty = await inventoryModel.upsertInventory(trx, productId, warehouseId, qty);

    // Create stock log linked to the journal entry generated by the Posting Engine
    const stockLog = await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: warehouseId,
      type: 'ADJUSTMENT',
      quantity_change: qty,
      quantity_after: newQty,
      unit_cost: finalUnitCost,
      reference_id: postingResult.journalEntryId,
      reference_type: 'journal_entry',
      notes,
      created_by: userId,
    });

    if (qty < 0 && costingResult) {
      // Backfill inventory_layer_consumptions with stockLogId
      for (const cons of costingResult.consumptions) {
        if (cons.layerId) {
          await trx('inventory_layer_consumptions').insert({
            company_id: companyId,
            layer_id: cons.layerId,
            stock_log_id: stockLog.id,
            issued_qty: cons.qty,
            unit_cost: cons.unitCost,
            extended_cost: cons.extendedCost,
            document_type: 'adjustment',
            document_number: String(postingResult.journalEntryId),
            created_at: trx.fn.now()
          });
        }
      }
    } else if (qty > 0) {
      // Positive adjustment: record acquisition layer
      await require('./inventory_costing.service').recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: qty,
        unitCost: finalUnitCost,
        sourceDocument: String(postingResult.journalEntryId),
        sourceType: 'adjustment',
        userId
      });
    }

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

    // 5. Generate formatted Transfer Reference
    const nextRefNum = reference || `TRF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // 4. Write stock logs for TRANSFER_OUT and TRANSFER_IN
    const outStockLog = await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: fromWarehouseId,
      type: 'TRANSFER_OUT',
      quantity_change: -qty,
      quantity_after: newSrcQty,
      unit_cost: 0, // Will update below
      reference_type: 'transfer',
      notes: remarks || `Transfer to WH #${toWarehouseId}`,
      created_by: userId
    });

    // Consume cost layers from source warehouse
    const costingResult = await require('./inventory_costing.service').consumeIssue(trx, {
      companyId,
      warehouseId: fromWarehouseId,
      productId,
      quantity: qty,
      documentType: 'transfer',
      documentNumber: nextRefNum,
      stockLogId: outStockLog.id,
      userId
    });

    const blendedCost = costingResult.blendedUnitCost;

    // Update TRANSFER_OUT stock log with actual cost
    await trx('stock_logs')
      .where({ id: outStockLog.id })
      .update({ unit_cost: blendedCost });

    await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: toWarehouseId,
      type: 'TRANSFER_IN',
      quantity_change: qty,
      quantity_after: newDstQty,
      unit_cost: blendedCost,
      reference_type: 'transfer',
      notes: remarks || `Transfer from WH #${fromWarehouseId}`,
      created_by: userId
    });

    // Create matching layers in destination warehouse using source layer cost
    for (const cons of costingResult.consumptions) {
      await require('./inventory_costing.service').recordAcquisition(trx, {
        companyId,
        warehouseId: toWarehouseId,
        productId,
        quantity: cons.qty,
        unitCost: cons.unitCost,
        sourceDocument: nextRefNum,
        sourceType: 'transfer',
        userId
      });
    }

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
