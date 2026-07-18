const db = require('../config/db');

class InventoryCostingService {
  /**
   * Records a new acquisition (receipt of inventory).
   * Creates a new layer in inventory_layers.
   */
  static async recordAcquisition(trx, {
    companyId,
    warehouseId,
    productId,
    quantity,
    unitCost,
    sourceDocument,
    sourceType,
    userId,
    receivedDate
  }) {
    if (parseFloat(quantity) <= 0) return;

    await trx('inventory_layers').insert({
      company_id: companyId,
      warehouse_id: warehouseId,
      product_id: productId,
      received_qty: parseFloat(quantity),
      remaining_qty: parseFloat(quantity),
      unit_cost: parseFloat(unitCost),
      source_document: sourceDocument || null,
      source_type: sourceType || null,
      received_date: receivedDate || new Date(),
      created_by: userId || null,
      created_at: trx.fn.now()
    });
  }

  /**
   * Consumes inventory layers for an issue (sale, negative adjustment, transfer out, return to vendor).
   * FIFO/LIFO layer consumption algorithm.
   * Returns { totalCOGS, blendedUnitCost, consumptions }
   */
  static async consumeIssue(trx, {
    companyId,
    warehouseId,
    productId,
    quantity,
    documentType,
    documentNumber,
    stockLogId,
    userId
  }) {
    const qty = parseFloat(quantity);
    if (qty <= 0) {
      return { totalCOGS: 0, blendedUnitCost: 0, consumptions: [] };
    }

    // 1. Get costing policy
    const settings = await trx('company_accounting_settings')
      .where({ company_id: companyId })
      .first();
    const method = settings?.inventory_costing_method || 'AVERAGE';

    if (method === 'AVERAGE') {
      // For average, we do not consume layers; we return WAC cost
      const product = await trx('products')
        .where({ id: productId, company_id: companyId })
        .first();
      const avgCost = parseFloat(product?.cost_price || 0);
      const totalCOGS = qty * avgCost;
      return {
        totalCOGS,
        blendedUnitCost: avgCost,
        consumptions: []
      };
    }

    // For FIFO or LIFO:
    // 2. Fetch available layers with remaining_qty > 0 for this warehouse
    const query = trx('inventory_layers')
      .where({
        company_id: companyId,
        warehouse_id: warehouseId,
        product_id: productId
      })
      .where('remaining_qty', '>', 0);

    if (method === 'FIFO') {
      query.orderBy('received_date', 'asc').orderBy('id', 'asc');
    } else if (method === 'LIFO') {
      query.orderBy('received_date', 'desc').orderBy('id', 'desc');
    }

    const layers = await query;
    let qtyNeeded = qty;
    let totalCOGS = 0;
    const consumptions = [];

    for (const layer of layers) {
      if (qtyNeeded <= 0) break;

      const layerQty = parseFloat(layer.remaining_qty);
      const qtyToConsume = Math.min(layerQty, qtyNeeded);

      const unitCost = parseFloat(layer.unit_cost);
      const extendedCost = qtyToConsume * unitCost;

      totalCOGS += extendedCost;
      qtyNeeded -= qtyToConsume;

      // Update remaining qty of this layer
      const newRemaining = layerQty - qtyToConsume;
      await trx('inventory_layers')
        .where({ id: layer.id })
        .update({
          remaining_qty: newRemaining
        });

      // Insert layer consumption log if stockLogId is provided
      if (stockLogId) {
        await trx('inventory_layer_consumptions').insert({
          company_id: companyId,
          layer_id: layer.id,
          stock_log_id: stockLogId,
          issued_qty: qtyToConsume,
          unit_cost: unitCost,
          extended_cost: extendedCost,
          document_type: documentType || null,
          document_number: documentNumber || null,
          created_at: trx.fn.now()
        });
      }

      consumptions.push({
        layerId: layer.id,
        qty: qtyToConsume,
        unitCost,
        extendedCost,
        sourceDocument: layer.source_document
      });
    }

    if (qtyNeeded > 0) {
      // In case layers don't have enough stock, fall back to product master cost for the remainder
      const product = await trx('products')
        .where({ id: productId, company_id: companyId })
        .first();
      const fallbackCost = parseFloat(product?.cost_price || 0);
      const extendedCost = qtyNeeded * fallbackCost;
      totalCOGS += extendedCost;
      
      consumptions.push({
        layerId: null,
        qty: qtyNeeded,
        unitCost: fallbackCost,
        extendedCost,
        sourceDocument: 'Fallback Cost'
      });
    }

    const blendedUnitCost = totalCOGS / qty;

    return {
      totalCOGS,
      blendedUnitCost,
      consumptions
    };
  }

  /**
   * Retrieves audit logs showing which purchase batches were consumed for a given stock log.
   */
  static async getConsumptionsForLog(trx, stockLogId) {
    return await trx('inventory_layer_consumptions as ilc')
      .join('inventory_layers as il', 'ilc.layer_id', 'il.id')
      .where('ilc.stock_log_id', stockLogId)
      .select(
        'ilc.*',
        'il.source_document as purchase_document',
        'il.source_type as purchase_source_type',
        'il.received_date as purchase_date'
      );
  }
}

module.exports = InventoryCostingService;
