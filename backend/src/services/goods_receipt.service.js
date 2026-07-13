const db = require('../config/db');
const inventoryModel = require('../models/inventory.model');
const VoucherService = require('./voucher.service');

class GoodsReceiptService {
  /**
   * Generates next GRN number (e.g. GRN-2026-00001)
   */
  static async generateGrnNumber(companyId, trx = db) {
    const prefix = 'GRN';
    const year = new Date().getFullYear();
    const lastGrn = await trx('goods_receipts')
      .where({ company_id: companyId })
      .orderBy('id', 'desc')
      .first();

    let nextVal = 1;
    if (lastGrn && lastGrn.grn_number) {
      const match = lastGrn.grn_number.match(/-(\d+)$/);
      if (match) {
        nextVal = parseInt(match[1]) + 1;
      }
    }
    return `${prefix}-${year}-${String(nextVal).padStart(5, '0')}`;
  }

  /**
   * Creates a Goods Receipt draft
   */
  static async createGoodsReceipt(data, trx = db) {
    const { companyId, purchaseOrderId, vendorId, warehouseId, receivedDate, supplierReference, notes, items, userId } = data;
    if (!items || items.length === 0) throw new Error('At least one item is required.');

    const grnNumber = await this.generateGrnNumber(companyId, trx);

    const [grnId] = await trx('goods_receipts')
      .insert({
        company_id: companyId,
        purchase_order_id: purchaseOrderId || null,
        grn_number: grnNumber,
        vendor_id: vendorId,
        warehouse_id: warehouseId,
        received_date: receivedDate,
        received_by: userId,
        status: 'DRAFT',
        supplier_reference: supplierReference || null,
        notes: notes || null
      })
      .returning('id');

    const insertedId = typeof grnId === 'object' ? grnId.id : grnId;

    const itemRows = items.map(item => ({
      goods_receipt_id: insertedId,
      product_id: item.productId || item.product_id,
      quantity_ordered: parseFloat(item.quantityOrdered || item.quantity_ordered || 0),
      quantity_received: parseFloat(item.quantityReceived || item.quantity_received || 0),
      quantity_rejected: parseFloat(item.quantityRejected || item.quantity_rejected || 0),
      notes: item.notes || null
    }));

    await trx('goods_receipt_items').insert(itemRows);

    return await this.getGoodsReceiptById(insertedId, companyId, trx);
  }

  /**
   * Confirms / Receives the Goods (updates stock, updates PO status)
   */
  static async postGoodsReceipt(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const grn = await trx('goods_receipts').where({ id, company_id: companyId }).first();
      if (!grn) throw new Error('Goods Receipt not found.');
      if (grn.status !== 'DRAFT') throw new Error('Only draft Goods Receipts can be processed.');

      const items = await trx('goods_receipt_items as gri')
        .join('products as p', 'gri.product_id', 'p.id')
        .where('gri.goods_receipt_id', id)
        .select('gri.*', 'p.cost_price', 'p.name', 'p.sku');

      // 1. Replenish physical stock & WAC calculation for each item
      for (const item of items) {
        const qty = parseFloat(item.quantity_received);
        if (qty <= 0) continue;

        // Sum current stock across all warehouses for the product
        const stockSummary = await trx('inventory')
          .where('product_id', item.product_id)
          .sum('quantity as total_qty')
          .first();

        const q_curr = parseFloat(stockSummary?.total_qty || 0);
        const c_curr = parseFloat(item.cost_price || 0);
        const q_new = qty;
        const c_new = c_curr; // Using current cost price as default purchase cost if not provided

        let newWAC = c_new;
        if (q_curr + q_new > 0) {
          newWAC = ((q_curr * c_curr) + (q_new * c_new)) / (q_curr + q_new);
        }

        // Update WAC on product
        await trx('products')
          .where({ id: item.product_id, company_id: companyId })
          .update({ cost_price: newWAC, updated_at: trx.fn.now() });

        // Upsert stock in target warehouse
        const newQty = await inventoryModel.upsertInventory(trx, item.product_id, grn.warehouse_id, qty);

        // Record Stock Log with reference_type='goods_receipt'
        await inventoryModel.insertStockLog(trx, {
          product_id: item.product_id,
          warehouse_id: grn.warehouse_id,
          type: 'PURCHASE',
          quantity_change: qty,
          quantity_after: newQty,
          unit_cost: c_curr,
          reference_id: id,
          reference_type: 'goods_receipt',
          notes: `Received via ${grn.grn_number}. Ref: ${grn.supplier_reference || ''}`,
          created_by: userId
        });
      }

      // 2. Update status of the GRN
      await trx('goods_receipts')
        .where({ id, company_id: companyId })
        .update({ status: 'RECEIVED', updated_at: trx.fn.now() });

      // 3. Update status of the linked Purchase Order
      if (grn.purchase_order_id) {
        const poItems = await trx('purchase_order_items').where({ purchase_order_id: grn.purchase_order_id });
        
        // Sum received quantities across all posted GRNs for this PO
        const allGrnsForPo = await trx('goods_receipts')
          .where({ purchase_order_id: grn.purchase_order_id, status: 'RECEIVED' })
          .select('id');
        const grnIds = allGrnsForPo.map(g => g.id);

        const receivedSums = await trx('goods_receipt_items')
          .whereIn('goods_receipt_id', grnIds)
          .groupBy('product_id')
          .select('product_id')
          .sum('quantity_received as total_received');

        const receivedMap = {};
        receivedSums.forEach(r => {
          receivedMap[r.product_id] = parseFloat(r.total_received || 0);
        });

        let allReceived = true;
        let anyReceived = false;

        for (const poItem of poItems) {
          const received = receivedMap[poItem.product_id] || 0;
          const ordered = parseFloat(poItem.quantity);

          if (received < ordered) {
            allReceived = false;
          }
          if (received > 0) {
            anyReceived = true;
          }
        }

        let newPoStatus = 'APPROVED';
        if (allReceived) {
          newPoStatus = 'GOODS_RECEIVED';
        } else if (anyReceived) {
          newPoStatus = 'PARTIALLY_RECEIVED';
        }

        await trx('purchase_orders')
          .where({ id: grn.purchase_order_id })
          .update({ status: newPoStatus, updated_at: trx.fn.now() });
      }

      return await this.getGoodsReceiptById(id, companyId, trx);
    });
  }

  /**
   * Retrieves list of Goods Receipts
   */
  static async getGoodsReceipts(companyId, filters = {}) {
    let query = db('goods_receipts as gr')
      .join('vendors as v', 'gr.vendor_id', 'v.id')
      .join('warehouses as w', 'gr.warehouse_id', 'w.id')
      .leftJoin('users as u', 'gr.received_by', 'u.id')
      .where('gr.company_id', companyId)
      .select(
        'gr.*',
        'v.name as vendor_name',
        'w.name as warehouse_name',
        'u.name as received_by_name'
      )
      .orderBy('gr.created_at', 'desc');

    if (filters.status) query = query.where('gr.status', filters.status.toUpperCase());
    if (filters.search) {
      query = query.andWhere(q => {
        q.where('gr.grn_number', 'like', `%${filters.search}%`)
         .orWhere('v.name', 'like', `%${filters.search}%`)
         .orWhere('gr.supplier_reference', 'like', `%${filters.search}%`);
      });
    }

    return await query;
  }

  /**
   * Retrieves a single Goods Receipt with items
   */
  static async getGoodsReceiptById(id, companyId, trx = db) {
    const gr = await trx('goods_receipts as gr')
      .join('vendors as v', 'gr.vendor_id', 'v.id')
      .join('warehouses as w', 'gr.warehouse_id', 'w.id')
      .leftJoin('users as u', 'gr.received_by', 'u.id')
      .where({ 'gr.id': id, 'gr.company_id': companyId })
      .select(
        'gr.id as id',
        'gr.*',
        'v.name as vendor_name',
        'w.name as warehouse_name',
        'u.name as received_by_name'
      )
      .first();

    if (!gr) return null;

    const items = await trx('goods_receipt_items as gri')
      .join('products as p', 'gri.product_id', 'p.id')
      .where({ 'gri.goods_receipt_id': id })
      .select('gri.*', 'p.name as product_name', 'p.sku as product_sku', 'p.cost_price')
      .orderBy('gri.id', 'asc');

    // Fetch linked PO details if any
    let relatedPo = null;
    if (gr.purchase_order_id) {
      relatedPo = await trx('purchase_orders as po')
        .leftJoin('users as u', 'po.created_by', 'u.id')
        .where({ 'po.id': gr.purchase_order_id })
        .select('po.id', 'po.po_number', 'po.status', 'po.created_at', 'po.purchase_requisition_id', 'u.name as creator_name')
        .first();
    }

    // Fetch linked Purchase Voucher if any
    const relatedVoucher = await trx('vouchers as v')
      .leftJoin('users as u', 'v.created_by', 'u.id')
      .where({ 'v.goods_receipt_id': id, 'v.deleted_at': null })
      .select('v.id', 'v.voucher_number', 'v.status', 'v.created_at', 'u.name as creator_name')
      .first();

    return {
      ...gr,
      items,
      relatedPo,
      relatedVoucher
    };
  }

  /**
   * Converts Received Goods Receipt into a Purchase Voucher Draft
   */
  static async convertToVoucher(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const grn = await this.getGoodsReceiptById(id, companyId, trx);
      if (!grn) throw new Error('Goods Receipt not found.');
      if (grn.status !== 'RECEIVED') throw new Error('Only received Goods Receipts can be invoiced.');

      // Check if already invoiced
      const existingVoucher = await trx('vouchers')
        .where({ goods_receipt_id: id, company_id: companyId, deleted_at: null })
        .first();
      if (existingVoucher) {
        throw new Error(`This Goods Receipt is already linked to Purchase Voucher ${existingVoucher.voucher_number}.`);
      }

      // Default AP account mapping from accounting settings
      const settings = await trx('company_accounting_settings').where({ company_id: companyId }).first();
      const apAccount = settings?.default_ap_account_id || null;

      // Compute total cost based on WAC cost price in system
      let totalAmount = 0;
      const voucherItems = grn.items.map(item => {
        const qty = parseFloat(item.quantity_received);
        const cost = parseFloat(item.cost_price || 0);
        const total = qty * cost;
        totalAmount += total;

        return {
          productId: item.product_id,
          quantity: qty,
          unitCost: cost
        };
      });

      // Construct voucher payload
      const voucherPayload = {
        vendorId: grn.vendor_id,
        warehouseId: grn.warehouse_id,
        notes: `Invoiced from Goods Receipt ${grn.grn_number}. Ref: ${grn.supplier_reference || ''}`,
        ap_account_id: apAccount,
        taxAmount: 0.00,
        items: voucherItems
      };

      const voucher = await VoucherService.createDraft({
        companyId,
        type: 'PURCHASE',
        date: new Date(),
        payload: voucherPayload,
        totalAmount,
        taxAmount: 0.00,
        userId
      }, trx);

      // Set links on the created voucher
      await trx('vouchers')
        .where({ id: voucher.id })
        .update({
          goods_receipt_id: id,
          purchase_order_id: grn.purchase_order_id || null
        });

      return {
        voucherId: voucher.id,
        voucherNumber: voucher.voucher_number
      };
    });
  }
}

module.exports = GoodsReceiptService;
