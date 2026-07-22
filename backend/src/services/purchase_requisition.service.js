const db = require('../config/db');
const PurchaseOrderService = require('./purchase_order.service');

class PurchaseRequisitionService {
  /**
   * Generates next Requisition number (e.g., REQ-2026-00001)
   */
  static async generateRequisitionNumber(companyId, trx = db) {
    const prefix = 'REQ';
    const year = new Date().getFullYear();
    const lastReq = await trx('purchase_requisitions')
      .where({ company_id: companyId })
      .orderBy('id', 'desc')
      .first();

    let nextVal = 1;
    if (lastReq && lastReq.requisition_number) {
      const match = lastReq.requisition_number.match(/-(\d+)$/);
      if (match) {
        nextVal = parseInt(match[1]) + 1;
      }
    }
    return `${prefix}-${year}-${String(nextVal).padStart(5, '0')}`;
  }

  /**
   * Creates a new Requisition
   */
  static async createPurchaseRequisition(data, trx = db) {
    const { companyId, requestedBy, department, requiredDate, priority = 'NORMAL', reason, items } = data;
    if (!items || items.length === 0) throw new Error('At least one item is required.');

    const requisitionNumber = await this.generateRequisitionNumber(companyId, trx);

    // Compute estimated total
    let estimatedTotal = 0;
    const itemRows = items.map(item => {
      const qty = parseFloat(item.quantity || 0);
      const price = parseFloat(item.unitPurchasePrice || item.unit_purchase_price || item.estimatedPrice || item.estimated_price || 0);
      const total = qty * price;
      estimatedTotal += total;

      return {
        product_id: item.productId || item.product_id,
        description: item.description || '',
        quantity: qty,
        unit_purchase_price: price,
        estimated_price: price,
        line_total: total
      };
    });

    const [reqId] = await trx('purchase_requisitions')
      .insert({
        company_id: companyId,
        requested_by: requestedBy,
        requisition_number: requisitionNumber,
        department,
        required_date: requiredDate,
        priority: priority.toUpperCase(),
        reason,
        status: 'DRAFT',
        estimated_total: estimatedTotal
      })
      .returning('id');

    const insertedId = typeof reqId === 'object' ? reqId.id : reqId;

    // Insert items
    await trx('purchase_requisition_items').insert(
      itemRows.map(row => ({
        purchase_requisition_id: insertedId,
        ...row
      }))
    );

    // Add audit log
    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'CREATE',
      user_id: requestedBy,
      description: `Created Purchase Requisition Draft ${requisitionNumber}.`
    });

    return await this.getPurchaseRequisitionById(insertedId, companyId, trx);
  }

  /**
   * Updates an existing draft Requisition
   */
  static async updatePurchaseRequisition(id, companyId, data, trx = db) {
    const { department, requiredDate, priority, reason, items } = data;

    const requisition = await trx('purchase_requisitions').where({ id, company_id: companyId }).first();
    if (!requisition) throw new Error('Requisition not found.');
    if (requisition.status !== 'DRAFT' && requisition.status !== 'REJECTED') {
      throw new Error('Only Draft or Rejected requisitions can be updated.');
    }

    let estimatedTotal = requisition.estimated_total;

    if (items) {
      if (items.length === 0) throw new Error('At least one item is required.');

      // Clear old items
      await trx('purchase_requisition_items').where({ purchase_requisition_id: id }).delete();

      // Insert new items
      estimatedTotal = 0;
      const itemRows = items.map(item => {
        const qty = parseFloat(item.quantity || 0);
        const price = parseFloat(item.unitPurchasePrice || item.unit_purchase_price || item.estimatedPrice || item.estimated_price || 0);
        const total = qty * price;
        estimatedTotal += total;

        return {
          purchase_requisition_id: id,
          product_id: item.productId || item.product_id,
          description: item.description || '',
          quantity: qty,
          unit_purchase_price: price,
          estimated_price: price,
          line_total: total
        };
      });

      await trx('purchase_requisition_items').insert(itemRows);
    }

    const updateData = {
      estimated_total: estimatedTotal,
      updated_at: trx.fn.now()
    };
    if (department !== undefined) updateData.department = department;
    if (requiredDate !== undefined) updateData.required_date = requiredDate;
    if (priority !== undefined) updateData.priority = priority.toUpperCase();
    if (reason !== undefined) updateData.reason = reason;

    await trx('purchase_requisitions')
      .where({ id, company_id: companyId })
      .update(updateData);

    return await this.getPurchaseRequisitionById(id, companyId, trx);
  }

  /**
   * Retrieves list of Requisitions
   */
  static async getPurchaseRequisitions(companyId, filters = {}) {
    let query = db('purchase_requisitions as pr')
      .leftJoin('users as u', 'pr.requested_by', 'u.id')
      .where('pr.company_id', companyId)
      .select('pr.id as id', 'pr.*', 'u.name as requested_by_name')
      .orderBy('pr.created_at', 'desc');

    if (filters.status) query = query.where('pr.status', filters.status.toUpperCase());
    if (filters.search) {
      query = query.andWhere(q => {
        q.where('pr.requisition_number', 'like', `%${filters.search}%`)
         .orWhere('pr.department', 'like', `%${filters.search}%`)
         .orWhere('u.name', 'like', `%${filters.search}%`);
      });
    }

    return await query;
  }

  /**
   * Retrieves single Requisition with items
   */
  static async getPurchaseRequisitionById(id, companyId, trx = db) {
    const pr = await trx('purchase_requisitions as pr')
      .leftJoin('users as u', 'pr.requested_by', 'u.id')
      .leftJoin('users as app', 'pr.approved_by', 'app.id')
      .where({ 'pr.id': id, 'pr.company_id': companyId })
      .select('pr.id as id', 'pr.*', 'u.name as requested_by_name', 'app.name as approved_by_name')
      .first();

    if (!pr) return null;

    const items = await trx('purchase_requisition_items as pri')
      .join('products as p', 'pri.product_id', 'p.id')
      .where({ 'pri.purchase_requisition_id': id })
      .select('pri.*', 'p.name as product_name', 'p.sku as product_sku')
      .orderBy('pri.id', 'asc');

    // Fetch linked POs if any
    const relatedPos = await trx('purchase_orders')
      .where({ purchase_requisition_id: id })
      .select('id', 'po_number', 'status', 'created_at');

    const poIds = relatedPos.map(po => po.id);
    let relatedGrns = [];
    let relatedVouchers = [];

    if (poIds.length > 0) {
      relatedGrns = await trx('goods_receipts')
        .whereIn('purchase_order_id', poIds)
        .select('id', 'grn_number', 'status', 'created_at');

      const grnIds = relatedGrns.map(g => g.id);
      let voucherQuery = trx('vouchers').whereIn('purchase_order_id', poIds);
      if (grnIds.length > 0) {
        voucherQuery = voucherQuery.orWhereIn('goods_receipt_id', grnIds);
      }
      relatedVouchers = await voucherQuery.select('id', 'voucher_number', 'status', 'created_at', 'type');
    }

    // Fetch active workflow instance current stage name
    let currentStageName = null;
    if (pr.status === 'PENDING_APPROVAL') {
      const activeWorkflow = await trx('workflow_instances as wi')
        .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
        .where({
          'wi.company_id': companyId,
          'wd.document_type_code': 'PURCHASE_REQUISITION',
          'wi.document_id': id,
          'wi.status': 'PENDING'
        })
        .first();

      if (activeWorkflow) {
        const currentStage = await trx('workflow_stages')
          .where({
            workflow_definition_id: activeWorkflow.workflow_definition_id,
            stage_sequence: activeWorkflow.current_stage_sequence
          })
          .first();
        if (currentStage) {
          currentStageName = currentStage.name;
        }
      }
    }

    return {
      ...pr,
      items,
      relatedPos,
      relatedGrns,
      relatedVouchers,
      currentStageName
    };
  }

  /**
   * Submits Requisition for approval (Unified Workflow integration)
   */
  static async submitForApproval(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const pr = await trx('purchase_requisitions').where({ id, company_id: companyId }).first();
      if (!pr) throw new Error('Requisition not found.');
      if (pr.status !== 'DRAFT' && pr.status !== 'REJECTED') {
        throw new Error('Only Draft or Rejected Requisitions can be submitted for approval.');
      }

      // Check if workflow engine is registered
      const WorkflowEngineService = require('./workflow_engine.service');
      
      // Update PR status to PENDING_APPROVAL
      await trx('purchase_requisitions')
        .where({ id, company_id: companyId })
        .update({ status: 'PENDING_APPROVAL', updated_at: trx.fn.now() });

      // Start the workflow instance
      await WorkflowEngineService.submitToWorkflow(
        companyId,
        'PURCHASE_REQUISITION',
        id,
        pr.estimated_total,
        userId,
        trx
      );

      // Add audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'SUBMIT',
        user_id: userId,
        description: `Submitted Purchase Requisition ${pr.requisition_number} for approval routing.`
      });

      return await this.getPurchaseRequisitionById(id, companyId, trx);
    });
  }

  /**
   * Unified workflow callback (Approves the PR)
   */
  static async approvePurchaseRequisition(id, companyId, userId, trx = db) {
    const pr = await trx('purchase_requisitions').where({ id, company_id: companyId }).first();
    if (pr.status === 'APPROVED' || pr.status === 'CONVERTED_TO_PO') return; // Idempotency

    await trx('purchase_requisitions')
      .where({ id, company_id: companyId })
      .update({
        status: 'APPROVED',
        approved_by: userId,
        approved_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });

    // Add audit log
    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'APPROVE',
      user_id: userId,
      description: `Approved Purchase Requisition ${pr?.requisition_number || id}.`
    });
  }

  /**
   * Unified workflow callback (Rejects the PR)
   */
  static async rejectPurchaseRequisition(id, companyId, userId, trx = db) {
    const pr = await trx('purchase_requisitions').where({ id, company_id: companyId }).first();
    await trx('purchase_requisitions')
      .where({ id, company_id: companyId })
      .update({
        status: 'REJECTED',
        updated_at: trx.fn.now()
      });

    // Add audit log
    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'REJECT',
      user_id: userId,
      description: `Rejected Purchase Requisition ${pr?.requisition_number || id}.`
    });
  }

  /**
   * Converts an approved Requisition into a Purchase Order (one-click conversion)
   */
  static async convertToPurchaseOrder(id, companyId, userId) {
    return await db.transaction(async (trx) => {
      const pr = await this.getPurchaseRequisitionById(id, companyId, trx);
      if (!pr) throw new Error('Requisition not found.');
      if (pr.status !== 'APPROVED') throw new Error('Only approved Requisitions can be converted.');

      // Find standard vendor or fallback (first vendor)
      const firstVendor = await trx('vendors')
        .where({ company_id: companyId, is_active: true })
        .orderBy('id', 'asc')
        .first();
      const vendorId = firstVendor ? firstVendor.id : null;

      // Generate the PO draft
      const poItems = pr.items.map(item => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.estimated_price
      }));

      const po = await PurchaseOrderService.createPurchaseOrder({
        companyId,
        vendorId,
        date: new Date(),
        notes: `Converted from Purchase Requisition ${pr.requisition_number}. Reason: ${pr.reason || ''}`,
        items: poItems,
        userId,
        purchase_requisition_id: id
      }, trx);

      // Set the link on the PO
      await trx('purchase_orders')
        .where({ id: po.id })
        .update({ purchase_requisition_id: id });

      // Update PR status to CONVERTED_TO_PO
      await trx('purchase_requisitions')
        .where({ id, company_id: companyId })
        .update({ status: 'CONVERTED_TO_PO', updated_at: trx.fn.now() });

      // Add audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'GENERATE_PO',
        user_id: userId,
        description: `Generated Purchase Order ${po.po_number} from Purchase Requisition ${pr.requisition_number}.`
      });

      return {
        purchaseOrderId: po.id,
        poNumber: po.po_number
      };
    });
  }
}

module.exports = PurchaseRequisitionService;
