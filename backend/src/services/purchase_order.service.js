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
      .leftJoin('users as u', 'po.created_by', 'u.id')
      .leftJoin('purchase_requisitions as pr', 'po.purchase_requisition_id', 'pr.id')
      .where({ 'po.id': id, 'po.company_id': companyId })
      .select('po.*', 'v.name as vendor_name', 'u.name as creator_name', 'pr.requisition_number as source_requisition_number')
      .first();

    if (!po) return null;

    const items = await trx('purchase_order_items as poi')
      .join('products as p', 'poi.product_id', 'p.id')
      .where('poi.purchase_order_id', id)
      .select('poi.*', 'p.sku as product_sku', 'p.name as product_name', 'p.unit_of_measure');

    return { ...po, items };
  }

  /**
   * Creates a Purchase Order draft
   */
  static async createPurchaseOrder({ companyId, vendorId, date, notes, items, userId, purchase_requisition_id }, externalTrx = null) {
    if (!companyId) throw new Error('Company context required.');
    if (!items || items.length === 0) throw new Error('PO must contain at least one item.');

    const action = async (trx) => {
      const SettingsModel = require('../models/settings.model');
      const settings = await SettingsModel.getSettings(companyId);
      const policy = settings.procurementPolicy || 'REQUISITION_REQUIRED';

      if (policy === 'REQUISITION_REQUIRED' && !purchase_requisition_id) {
        throw new Error('Purchase Orders must be generated from an approved Purchase Requisition. Please complete the requisition approval process first.');
      }

      if (purchase_requisition_id) {
        const pr = await trx('purchase_requisitions').where({ id: purchase_requisition_id, company_id: companyId }).first();
        if (!pr || pr.status !== 'APPROVED') {
          throw new Error('Purchase Orders must be generated from an approved Purchase Requisition. Please complete the requisition approval process first.');
        }
      }

      const poNumber = await this.generatePONumber(companyId, trx);
      
      let totalAmount = 0;
      const itemRows = [];

      for (const item of items) {
        const product = await trx('products').where({ id: item.productId, company_id: companyId }).first();
        if (!product) throw new Error(`Product ID ${item.productId} not found.`);

        const qty = parseFloat(item.quantity || 0);
        const price = parseFloat(item.unitPrice || item.unit_price || item.unitPurchasePrice || item.unit_purchase_price || product.cost_price || 0);
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
          purchase_requisition_id: purchase_requisition_id || null,
          notes
        })
        .returning('*');

      await trx('purchase_order_items').insert(
        itemRows.map(row => ({ ...row, purchase_order_id: po.id }))
      );

      // Add audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'CREATE',
        user_id: userId,
        description: `Created Purchase Order Draft ${poNumber}.`
      });

      return po;
    };

    if (externalTrx) {
      return await action(externalTrx);
    } else {
      return await db.transaction(action);
    }
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

      // Add audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'UPDATE',
        user_id: userId,
        description: `Updated Purchase Order Draft ${po.po_number}.`
      });

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

      // Add audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'SUBMIT',
        user_id: userId,
        description: `Submitted Purchase Order ${po.po_number} for approval routing.`
      });

      return await this.getPurchaseOrderById(id, companyId, trx);
    });
  }

  /**
   * Unified workflow callback method (approves the PO)
   */
  static async approvePurchaseOrder(id, companyId, userId, trx = db) {
    const po = await trx('purchase_orders').where({ id, company_id: companyId }).first();
    await trx('purchase_orders')
      .where({ id, company_id: companyId })
      .update({ status: 'APPROVED', approved_by: userId, updated_at: trx.fn.now() });

    // Add audit log
    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'APPROVE',
      user_id: userId,
      description: `Approved Purchase Order ${po?.po_number || id}.`
    });
  }

  /**
   * Rejects the PO (invoked via generic approval or custom endpoint)
   */
  static async rejectPurchaseOrder(id, companyId, userId, trx = db) {
    const po = await trx('purchase_orders').where({ id, company_id: companyId }).first();
    await trx('purchase_orders')
      .where({ id, company_id: companyId })
      .update({ status: 'REJECTED', updated_at: trx.fn.now() });

    // Add audit log
    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'REJECT',
      user_id: userId,
      description: `Rejected Purchase Order ${po?.po_number || id}.`
    });
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

      // Add audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'CREATE_VOUCHER',
        user_id: userId,
        description: `Generated Purchase Voucher ${voucher.voucher_number} from PO ${po.po_number}.`
      });

      return voucher;
    });
  }
}

module.exports = PurchaseOrderService;
