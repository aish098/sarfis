const db = require('../config/db');
const VoucherService = require('./voucher.service');

class PurchaseOrderService {
  /**
   * Generates next PO number
   */
  static async generatePONumber(companyId, trx = db) {
    const prefix = 'PO';
    // Get last PO number for the company
    const lastPO = await trx('purchase_orders')
      .where({ company_id: companyId })
      .orderBy('id', 'desc')
      .first();

    let nextVal = 1;
    if (lastPO && lastPO.po_number) {
      const match = lastPO.po_number.match(/-(\d+)$/);
      if (match) {
        nextVal = parseInt(match[1]) + 1;
      }
    }
    return `${prefix}-${new Date().getFullYear()}-${String(nextVal).padStart(5, '0')}`;
  }

  /**
   * Retrieves list of POs
   */
  static async getPurchaseOrders(companyId, filters = {}) {
    let query = db('purchase_orders as po')
      .leftJoin('vendors as v', 'po.vendor_id', 'v.id')
      .where('po.company_id', companyId)
      .select('po.*', 'v.name as vendor_name')
      .orderBy('po.created_at', 'desc');

    if (filters.status) query = query.where('po.status', filters.status.toUpperCase());
    if (filters.vendorId) query = query.where('po.vendor_id', filters.vendorId);
    if (filters.search) {
      query = query.andWhere(q => {
        q.where('po.po_number', 'like', `%${filters.search}%`)
         .orWhere('v.name', 'like', `%${filters.search}%`);
      });
    }

    return await query;
  }

  /**
   * Retrieves single PO with items
   */
  static async getPurchaseOrderById(id, companyId, trx = db) {
    const po = await trx('purchase_orders as po')
      .leftJoin('vendors as v', 'po.vendor_id', 'v.id')
      .where({ 'po.id': id, 'po.company_id': companyId })
      .select('po.*', 'v.name as vendor_name')
      .first();

    if (!po) return null;

    const items = await trx('purchase_order_items as poi')
      .join('products as p', 'poi.product_id', 'p.id')
      .where('poi.purchase_order_id', id)
      .select('poi.*', 'p.sku as product_sku', 'p.name as product_name', 'p.unit_of_measure');

    return { ...po, items };
  }

  /**
   * Creates a draft PO
   */
  static async createPurchaseOrder({ companyId, vendorId, date, notes, items, userId }) {
    if (!companyId) throw new Error('Company context required.');
    if (!items || items.length === 0) throw new Error('PO must contain at least one item.');

    return await db.transaction(async (trx) => {
      const poNumber = await this.generatePONumber(companyId, trx);
      
      let totalAmount = 0;
      const itemRows = [];

      for (const item of items) {
        const product = await trx('products').where({ id: item.productId, company_id: companyId }).first();
        if (!product) throw new Error(`Product ID ${item.productId} not found.`);

        const qty = parseFloat(item.quantity || 0);
        const price = parseFloat(item.unitPrice || product.cost_price || 0);
        const lineTotal = qty * price;
        totalAmount += lineTotal;

        itemRows.push({
          product_id: item.productId,
          quantity: qty,
          unit_price: price,
          line_total: lineTotal
        });
      }

      const [po] = await trx('purchase_orders')
        .insert({
          company_id: companyId,
          vendor_id: vendorId ? parseInt(vendorId) : null,
          po_number: poNumber,
          date: date || new Date(),
          status: 'DRAFT',
          total_amount: totalAmount,
          tax_amount: 0.00,
          created_by: userId,
          notes
        })
        .returning('*');

      await trx('purchase_order_items').insert(
        itemRows.map(row => ({ ...row, purchase_order_id: po.id }))
      );

      return po;
    });
  }

  /**
   * Updates a draft PO
   */
  static async updatePurchaseOrder(id, companyId, { vendorId, date, notes, items, userId }) {
    return await db.transaction(async (trx) => {
      const po = await trx('purchase_orders')
        .where({ id, company_id: companyId })
        .first();

      if (!po) throw new Error('Purchase Order not found.');
      if (po.status !== 'DRAFT') throw new Error('Only draft POs can be edited.');

      let totalAmount = 0;
      const itemRows = [];

      for (const item of items) {
        const product = await trx('products').where({ id: item.productId, company_id: companyId }).first();
        if (!product) throw new Error(`Product ID ${item.productId} not found.`);

        const qty = parseFloat(item.quantity || 0);
        const price = parseFloat(item.unitPrice || product.cost_price || 0);
        const lineTotal = qty * price;
        totalAmount += lineTotal;

        itemRows.push({
          product_id: item.productId,
          quantity: qty,
          unit_price: price,
          line_total: lineTotal
        });
      }

      await trx('purchase_orders')
        .where({ id, company_id: companyId })
        .update({
          vendor_id: vendorId ? parseInt(vendorId) : null,
          date: date || po.date,
          notes: notes !== undefined ? notes : po.notes,
          total_amount: totalAmount,
          updated_at: trx.fn.now()
        });

      // Clear and recreate items
      await trx('purchase_order_items').where({ purchase_order_id: id }).delete();
      await trx('purchase_order_items').insert(
        itemRows.map(row => ({ ...row, purchase_order_id: id }))
      );

      return await this.getPurchaseOrderById(id, companyId, trx);
    });
  }

  /**
   * Submits a PO for approval
   */
  static async submitForApproval(id, companyId, userId) {
    const WorkflowEngineService = require('./workflow_engine.service');

    return await db.transaction(async (trx) => {
      const po = await trx('purchase_orders').where({ id, company_id: companyId }).first();
      if (!po) throw new Error('Purchase Order not found.');
      if (po.status !== 'DRAFT') throw new Error('Only draft POs can be submitted.');

      const res = await WorkflowEngineService.submitToWorkflow(
        companyId,
        'PURCHASE_ORDER',
        id,
        parseFloat(po.total_amount || 0),
        userId,
        trx
      );

      let status = 'PENDING_APPROVAL';
      if (res.status === 'APPROVED') {
        status = 'APPROVED';
      }

      await trx('purchase_orders')
        .where({ id, company_id: companyId })
        .update({ status, updated_at: trx.fn.now() });

      return await this.getPurchaseOrderById(id, companyId, trx);
    });
  }

  /**
   * Unified workflow callback method (approves the PO)
   */
  static async approvePurchaseOrder(id, companyId, userId, trx = db) {
    await trx('purchase_orders')
      .where({ id, company_id: companyId })
      .update({ status: 'APPROVED', approved_by: userId, updated_at: trx.fn.now() });
  }

  /**
   * Rejects the PO (invoked via generic approval or custom endpoint)
   */
  static async rejectPurchaseOrder(id, companyId, userId, trx = db) {
    await trx('purchase_orders')
      .where({ id, company_id: companyId })
      .update({ status: 'REJECTED', updated_at: trx.fn.now() });
  }

  /**
   * Converts approved PO to a Purchase Voucher
   */
  static async convertToVoucher(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const po = await trx('purchase_orders').where({ id, company_id: companyId }).first();
      if (!po) throw new Error('Purchase Order not found.');
      if (po.status !== 'APPROVED') throw new Error('Only approved POs can be converted to vouchers.');

      const items = await trx('purchase_order_items').where({ purchase_order_id: id });
      if (items.length === 0) throw new Error('Purchase Order has no items.');

      // Find first active warehouse for default fallback
      const warehouse = await trx('warehouses').where({ company_id: companyId, is_active: true }).first();
      if (!warehouse) throw new Error('No active warehouse found to assign items.');

      // Default AP account mapping from accounting settings
      const settings = await trx('company_accounting_settings').where({ company_id: companyId }).first();
      const apAccount = settings?.default_ap_account_id || null;

      // Construct voucher payload
      const voucherPayload = {
        vendorId: po.vendor_id,
        warehouseId: warehouse.id,
        notes: `Converted from PO #${po.po_number}. Notes: ${po.notes || ''}`,
        ap_account_id: apAccount,
        taxAmount: 0.00,
        items: items.map(item => ({
          productId: item.product_id,
          quantity: parseFloat(item.quantity),
          unitCost: parseFloat(item.unit_price)
        }))
      };

      // Create draft purchase voucher
      const voucher = await VoucherService.createDraft({
        companyId,
        type: 'PURCHASE',
        date: new Date(),
        payload: voucherPayload,
        totalAmount: po.total_amount,
        taxAmount: 0.00,
        userId
      });

      // Update PO status to converted
      await trx('purchase_orders')
        .where({ id, company_id: companyId })
        .update({ status: 'CONVERTED', updated_at: trx.fn.now() });

      // Link voucher to PO
      await trx('vouchers')
        .where({ id: voucher.id })
        .update({ purchase_order_id: id });

      return voucher;
    });
  }
}

module.exports = PurchaseOrderService;
