const db = require('../config/db');
const inventoryModel = require('../models/inventory.model');

/**
 * PURCHASE FLOW
 * ─────────────
 * Inventory ↑ (Debit inventory asset account)
 * Accounts Payable ↑ (Credit AP)
 * Stock log: PURCHASE
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
    // 1. Create journal entry
    const [je] = await trx('journal_entries').insert({
      company_id: companyId,
      entry_date: new Date(),
      description: `Purchase: ${product.name} x${quantity}`,
      created_by: userId,
    }).returning('*');

    // 2. Journal lines: Dr Inventory, Cr AP
    await trx('journal_lines').insert([
      {
        entry_id: je.id,
        account_id: product.inventory_account_id,
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

    for (const item of items) {
      const product = await inventoryModel.getProductById(item.product_id, companyId);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (!product.inventory_account_id || !product.cogs_account_id || !product.revenue_account_id) {
        throw new Error(`Product ${product.name} is missing COA account links`);
      }

      const lineRevenue = parseFloat(item.quantity) * parseFloat(item.unit_price);
      const lineCOGS = parseFloat(item.quantity) * parseFloat(item.unit_cost);
      totalRevenue += lineRevenue;
      totalCOGS += lineCOGS;

      // Stock deduction
      const newQty = await inventoryModel.upsertInventory(trx, item.product_id, item.warehouse_id, -parseFloat(item.quantity));

      // Per-product lines: Dr COGS, Cr Inventory
      jeLines.push(
        { account_id: product.cogs_account_id, debit: lineCOGS, credit: 0 },
        { account_id: product.inventory_account_id, debit: 0, credit: lineCOGS },
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
    const defaultRevenueAccountId = items[0] ? (await inventoryModel.getProductById(items[0].product_id, companyId)).revenue_account_id : null;
    await trx('journal_lines').insert([
      { entry_id: je.id, account_id: arAccountId, debit: totalRevenue, credit: 0 },
      { entry_id: je.id, account_id: defaultRevenueAccountId, debit: 0, credit: totalRevenue },
      ...jeLines.map(l => ({ ...l, entry_id: je.id })),
    ]);

    // Link journal entry to delivery
    // await trx('deliveries').where('id', deliveryId).update({ journal_entry_id: je.id });

    return { journalEntry: je, totalRevenue, totalCOGS };
  });
};

/**
 * STOCK ADJUSTMENT (manual correction)
 */
const processAdjustment = async ({ companyId, productId, warehouseId, adjustmentQty, notes, userId }) => {
  return db.transaction(async (trx) => {
    const newQty = await inventoryModel.upsertInventory(trx, productId, warehouseId, parseFloat(adjustmentQty));
    await inventoryModel.insertStockLog(trx, {
      product_id: productId,
      warehouse_id: warehouseId,
      type: 'ADJUSTMENT',
      quantity_change: parseFloat(adjustmentQty),
      quantity_after: newQty,
      reference_type: 'adjustment',
      notes,
      created_by: userId,
    });
    return { newQuantity: newQty };
  });
};

module.exports = { processPurchase, processSale, processAdjustment };
