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

  // Calculate order total
  const orderTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0);

  // Credit limit check
  if (client.credit_limit > 0) {
    const newBalance = parseFloat(client.current_balance) + orderTotal;
    if (newBalance > parseFloat(client.credit_limit)) {
      throw new Error(
        `Credit limit exceeded. Limit: $${client.credit_limit}, ` +
        `Current: $${client.current_balance}, ` +
        `This order: $${orderTotal.toFixed(2)}`
      );
    }
  }

  // Stock availability check
  for (const item of items) {
    const stock = await db('inventory')
      .where({ product_id: item.product_id, warehouse_id: warehouseId })
      .first();
    const available = parseFloat(stock?.quantity || 0);
    if (available < parseFloat(item.quantity)) {
      const product = await db('products').where('id', item.product_id).first();
      throw new Error(
        `Insufficient stock for ${product?.name || item.product_id}. ` +
        `Available: ${available}, Requested: ${item.quantity}`
      );
    }
  }

  // ── Transaction ─────────────────────────────────────────
  return db.transaction(async (trx) => {
    const deliveryNumber = await distModel.getNextDeliveryNumber(companyId);

    const totalCost = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_cost)), 0);

    // Create delivery header
    const delivery = await distModel.createDelivery(trx, {
      company_id: companyId,
      client_id: clientId,
      sector_id: sectorId,
      warehouse_id: warehouseId,
      delivery_number: deliveryNumber,
      delivery_date: deliveryDate || new Date(),
      status: 'CONFIRMED',
      total_amount: orderTotal,
      total_cost: totalCost,
      notes,
      created_by: userId,
    });

    // Create delivery items
    await distModel.createDeliveryItems(trx, items.map(i => ({
      delivery_id: delivery.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost,
    })));

    // Update client balance (increase AR)
    await distModel.updateClientBalance(trx, clientId, orderTotal);

    // Commit inventory + accounting outside this trx
    // (processSale opens its own transaction; pass items with warehouseId)
    const saleItems = items.map(i => ({ ...i, warehouse_id: warehouseId }));
    await inventoryService.processSale({
      companyId, deliveryId: delivery.id, items: saleItems,
      clientId, arAccountId, userId,
    });

    return delivery;
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

module.exports = { createDeliveryOrder, markDelivered, cancelDelivery };
