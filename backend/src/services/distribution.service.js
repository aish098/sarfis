const db = require('../config/db');
const distModel = require('../models/distribution.model');
const inventoryService = require('./inventory.service');

/**
 * CREATE DELIVERY ORDER
 * ─────────────────────
 * 1. Validate client credit limit
 * 2. Validate stock availability
 * 3. Create delivery record
 * 4. Trigger inventory/accounting via inventoryService.processSale
 * 5. Update client balance (AR)
 */
const createDeliveryOrder = async ({
  companyId, clientId, sectorId, warehouseId, items,
  deliveryDate, notes, arAccountId, userId,
}) => {
  // ── Pre-validation ──────────────────────────────────────
  const client = await distModel.getClientById(clientId, companyId);
  if (!client) throw new Error('Client not found');

  const orderTotal = items.reduce((s, i) => s + ((parseFloat(i.quantity) * parseFloat(i.unit_price)) - parseFloat(i.discount || 0)), 0);

  // Enforce Credit Policy Check at Order creation
  const RiskService = require('./risk.service');
  const riskCheck = await RiskService.validateTransaction(companyId, 'SALES', { clientId, amount: orderTotal });
  if (!riskCheck.allowed) {
    throw new Error(riskCheck.message);
  }

  // ── Transaction ─────────────────────────────────────────
  return db.transaction(async (trx) => {
    const deliveryNumber = await distModel.getNextDeliveryNumber(companyId);
    const totalCost = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_cost)), 0);

    // Create delivery header (Starts as PENDING)
    const delivery = await distModel.createDelivery(trx, {
      company_id: companyId,
      client_id: clientId,
      sector_id: sectorId,
      warehouse_id: warehouseId,
      delivery_number: deliveryNumber,
      delivery_date: deliveryDate || new Date(),
      status: 'PENDING',
      total_amount: orderTotal,
      total_cost: totalCost,
      notes,
      created_by: userId,
      ar_account_id: arAccountId // Store for later confirmation
    });

    // Create delivery items
    await distModel.createDeliveryItems(trx, items.map(i => ({
      delivery_id: delivery.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost,
      discount: parseFloat(i.discount || 0.00),
      offer: i.offer || null
    })));

    return delivery;
  });
};

/**
 * CONFIRM DELIVERY (Deducts stock & records sale)
 */
const confirmDelivery = async (deliveryId, companyId, userId) => {
  const delivery = await distModel.getDeliveryById(deliveryId, companyId);
  if (!delivery) throw new Error('Delivery not found');
  if (delivery.status !== 'PENDING') throw new Error('Only pending orders can be confirmed');

  const orderTotal = parseFloat(delivery.total_amount);

  // Enforce Credit Policy Check again at Delivery confirmation
  const RiskService = require('./risk.service');
  const riskCheck = await RiskService.validateTransaction(companyId, 'SALES', { clientId: delivery.client_id, amount: orderTotal });
  if (!riskCheck.allowed) {
    throw new Error(riskCheck.message);
  }

  const items = await distModel.getDeliveryItems(deliveryId);

  // 1. Stock availability check (Before we do anything)
  for (const item of items) {
    const stock = await db('inventory')
      .where({ product_id: item.product_id, warehouse_id: delivery.warehouse_id })
      .first();
    
    const available = parseFloat(stock?.quantity || 0);
    if (available < parseFloat(item.quantity)) {
      const product = await db('products').where('id', item.product_id).first();
      throw new Error(`Insufficient stock for ${product?.name}. Available: ${available}, Requested: ${item.quantity}`);
    }
  }

  return db.transaction(async (trx) => {
    // 2. Update status to CONFIRMED
    await trx('deliveries').where('id', deliveryId).update({ status: 'CONFIRMED', updated_at: trx.fn.now() });

    // 3. Update client balance (increase AR)
    await distModel.updateClientBalance(trx, delivery.client_id, parseFloat(delivery.total_amount));

    // 4. Trigger inventory/accounting
    const saleItems = items.map(i => ({ ...i, warehouse_id: delivery.warehouse_id }));
    const saleResult = await inventoryService.processSale({
      companyId, 
      deliveryId, 
      items: saleItems,
      clientId: delivery.client_id, 
      arAccountId: delivery.ar_account_id, // Ensure this was saved
      userId,
    });

    if (saleResult && saleResult.journalEntry) {
      await trx('deliveries').where('id', deliveryId).update({ journal_entry_id: saleResult.journalEntry.id });
    }

    return { success: true };
  });
};

/**
 * MARK DELIVERY AS DELIVERED
 * On actual delivery completion
 */
const markDelivered = async (deliveryId, companyId) => {
  const delivery = await distModel.getDeliveryById(deliveryId, companyId);
  if (!delivery) throw new Error('Delivery not found');
  if (delivery.status === 'DELIVERED') throw new Error('Already delivered');

  return distModel.updateDeliveryStatus(deliveryId, companyId, 'DELIVERED');
};

/**
 * CANCEL DELIVERY
 * Reverses stock and AR if it was confirmed
 */
const cancelDelivery = async (deliveryId, companyId, userId) => {
  const delivery = await distModel.getDeliveryById(deliveryId, companyId);
  if (!delivery) throw new Error('Delivery not found');
  if (['DELIVERED', 'CANCELLED'].includes(delivery.status))
    throw new Error(`Cannot cancel a ${delivery.status} delivery`);

  return db.transaction(async (trx) => {
    // Reverse client balance
    await distModel.updateClientBalance(trx, delivery.client_id, -parseFloat(delivery.total_amount));

    // Reverse inventory if confirmed
    if (delivery.status === 'CONFIRMED' || delivery.status === 'DISPATCHED') {
      const items = await distModel.getDeliveryItems(deliveryId);
      for (const item of items) {
        const newQty = await require('../models/inventory.model')
          .upsertInventory(trx, item.product_id, delivery.warehouse_id, parseFloat(item.quantity));
        await require('../models/inventory.model').insertStockLog(trx, {
          product_id: item.product_id,
          warehouse_id: delivery.warehouse_id,
          type: 'RETURN',
          quantity_change: parseFloat(item.quantity),
          quantity_after: newQty,
          reference_id: deliveryId,
          reference_type: 'delivery',
          notes: 'Order cancelled — stock returned',
          created_by: userId,
        });
      }
    }

    await trx('deliveries').where('id', deliveryId).update({ status: 'CANCELLED', updated_at: trx.fn.now() });
    return { success: true };
  });
};

module.exports = { createDeliveryOrder, confirmDelivery, markDelivered, cancelDelivery };
