const db = require('../config/db');

class InventoryCostingService {
  /**
   * Retrieves the configured inventory costing policy for a company ('FIFO', 'LIFO', 'AVERAGE')
   */
  static async getCostingMethod(trx, companyId) {
    const settings = await trx('company_accounting_settings')
      .where({ company_id: companyId })
      .first();
    return settings?.inventory_costing_method || 'FIFO';
  }

  /**
   * Records a new acquisition (receipt of inventory).
   * Creates a new purchase layer in inventory_layers and updates the weighted average balance.
   */
  static async recordAcquisition(trx, {
    companyId,
    warehouseId,
    productId,
    quantity,
    unitCost,
    sourceType,
    sourceId,
    sourceDocument,
    receivedAt,
    receivedDate,
    userId
  }) {
    const qty = Number(quantity);
    const cost = Number(unitCost);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Acquisition quantity must be greater than zero.');
    }
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error('Acquisition unit cost is invalid.');
    }

    const effectiveDate = receivedAt || receivedDate || new Date();

    // 1. Insert layer
    await trx('inventory_layers').insert({
      company_id: companyId,
      warehouse_id: warehouseId,
      product_id: productId,
      received_qty: qty,
      remaining_qty: qty,
      unit_cost: cost,
      source_type: sourceType || 'GOODS_RECEIPT',
      source_document: sourceDocument || null,
      received_date: effectiveDate,
      created_by: userId || null,
      created_at: trx.fn.now()
    });

    // 2. Update per-warehouse weighted average cost balance
    await this.updateWeightedAverageBalance(trx, {
      companyId,
      warehouseId,
      productId,
      receivedQty: qty,
      receivedUnitCost: cost
    });
  }

  /**
   * Updates per-warehouse weighted average cost balance in inventory_cost_balances table.
   */
  static async updateWeightedAverageBalance(trx, {
    companyId,
    warehouseId,
    productId,
    receivedQty,
    receivedUnitCost
  }) {
    const balance = await trx('inventory_cost_balances')
      .where({
        company_id: companyId,
        warehouse_id: warehouseId,
        product_id: productId
      })
      .forUpdate()
      .first();

    const oldQty = Number(balance?.quantity_on_hand || 0);
    const oldValue = Number(balance?.inventory_value || 0);

    const receiptValue = receivedQty * receivedUnitCost;
    const newQty = oldQty + receivedQty;
    const newValue = oldValue + receiptValue;
    const newAverage = newQty > 0 ? newValue / newQty : 0;

    if (balance) {
      await trx('inventory_cost_balances')
        .where({ id: balance.id })
        .update({
          quantity_on_hand: newQty,
          inventory_value: newValue,
          average_unit_cost: newAverage,
          updated_at: trx.fn.now()
        });
    } else {
      await trx('inventory_cost_balances').insert({
        company_id: companyId,
        warehouse_id: warehouseId,
        product_id: productId,
        quantity_on_hand: newQty,
        inventory_value: newValue,
        average_unit_cost: newAverage,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });
    }

    // Also update product master cost_price for display / reference
    await trx('products')
      .where({ id: productId, company_id: companyId })
      .update({
        cost_price: parseFloat(newAverage.toFixed(2)),
        updated_at: trx.fn.now()
      });
  }

  /**
   * Consumes inventory layers using FIFO or LIFO strategy.
   */
  static async consumeFifoOrLifo(trx, {
    method,
    companyId,
    warehouseId,
    productId,
    quantity,
    stockLogId,
    documentType,
    documentId,
    documentNumber,
    userId
  }) {
    const orderDirection = method === 'FIFO' ? 'asc' : 'desc';

    const layers = await trx('inventory_layers')
      .where({
        company_id: companyId,
        warehouse_id: warehouseId,
        product_id: productId
      })
      .where('remaining_qty', '>', 0)
      .orderBy('received_date', orderDirection)
      .orderBy('id', orderDirection)
      .forUpdate();

    let qtyNeeded = quantity;
    let totalCost = 0;
    const consumptions = [];

    for (const layer of layers) {
      if (qtyNeeded <= 0) break;

      const layerQty = Number(layer.remaining_qty);
      const consumedQty = Math.min(layerQty, qtyNeeded);
      const unitCost = Number(layer.unit_cost);
      const extendedCost = consumedQty * unitCost;

      totalCost += extendedCost;
      qtyNeeded -= consumedQty;

      await trx('inventory_layers')
        .where({ id: layer.id })
        .update({
          remaining_qty: layerQty - consumedQty
        });

      if (stockLogId) {
        await trx('inventory_layer_consumptions').insert({
          company_id: companyId,
          layer_id: layer.id,
          stock_log_id: stockLogId,
          issued_qty: consumedQty,
          unit_cost: unitCost,
          extended_cost: extendedCost,
          document_type: documentType || null,
          document_number: documentNumber || null,
          created_at: trx.fn.now()
        });
      }

      consumptions.push({
        layerId: layer.id,
        sourceDocument: layer.source_document,
        qty: consumedQty,
        quantity: consumedQty,
        unitCost,
        extendedCost
      });
    }

    // Fallback to product cost_price if layers are insufficient
    if (qtyNeeded > 0) {
      const product = await trx('products')
        .where({ id: productId, company_id: companyId })
        .first();
      const fallbackCost = Number(product?.cost_price || 0);
      const extendedCost = qtyNeeded * fallbackCost;
      totalCost += extendedCost;

      consumptions.push({
        layerId: null,
        sourceDocument: 'Fallback Reference Cost',
        qty: qtyNeeded,
        quantity: qtyNeeded,
        unitCost: fallbackCost,
        extendedCost
      });
    }

    const blendedUnitCost = quantity > 0 ? totalCost / quantity : 0;

    return {
      totalCost,
      totalCOGS: totalCost,
      blendedUnitCost,
      unitCost: blendedUnitCost,
      consumptions
    };
  }

  /**
   * Consumes inventory using Weighted Average Cost strategy.
   */
  static async consumeAverage(trx, {
    companyId,
    warehouseId,
    productId,
    quantity,
    stockLogId,
    documentType,
    documentId,
    documentNumber,
    userId
  }) {
    const balance = await trx('inventory_cost_balances')
      .where({
        company_id: companyId,
        warehouse_id: warehouseId,
        product_id: productId
      })
      .forUpdate()
      .first();

    let averageUnitCost = Number(balance?.average_unit_cost || 0);
    if (!balance || averageUnitCost <= 0) {
      const product = await trx('products')
        .where({ id: productId, company_id: companyId })
        .first();
      averageUnitCost = Number(product?.cost_price || 0);
    }

    const totalCost = quantity * averageUnitCost;
    const oldQty = Number(balance?.quantity_on_hand || 0);
    const newQty = Math.max(0, oldQty - quantity);
    const currentValue = Number(balance?.inventory_value || 0);
    const newValue = Math.max(0, currentValue - totalCost);

    if (balance) {
      await trx('inventory_cost_balances')
        .where({ id: balance.id })
        .update({
          quantity_on_hand: newQty,
          inventory_value: newValue,
          average_unit_cost: newQty > 0 ? averageUnitCost : 0,
          updated_at: trx.fn.now()
        });
    }

    return {
      totalCost,
      totalCOGS: totalCost,
      blendedUnitCost: averageUnitCost,
      unitCost: averageUnitCost,
      consumptions: [
        {
          layerId: null,
          quantity,
          qty: quantity,
          unitCost: averageUnitCost,
          extendedCost: totalCost,
          method: 'AVERAGE'
        }
      ]
    };
  }

  /**
   * Main unified issue method that evaluates the company's valuation policy and consumes stock.
   */
  static async consumeIssue(trx, payload) {
    const method = await this.getCostingMethod(trx, payload.companyId);
    const quantity = Number(payload.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { totalCost: 0, totalCOGS: 0, blendedUnitCost: 0, unitCost: 0, consumptions: [] };
    }

    if (method === 'AVERAGE') {
      return this.consumeAverage(trx, {
        ...payload,
        quantity
      });
    }

    return this.consumeFifoOrLifo(trx, {
      ...payload,
      quantity,
      method
    });
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
