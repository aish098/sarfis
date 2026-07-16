const poService = require('../services/purchase_order.service');

exports.getPurchaseOrders = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      vendorId: req.query.vendorId,
      search: req.query.search
    };
    const pos = await poService.getPurchaseOrders(req.params.companyId, filters);
    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPurchaseOrderById = async (req, res) => {
  try {
    const po = await poService.getPurchaseOrderById(req.params.id, req.params.companyId);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found.' });

    // Fetch related vouchers
    const db = require('../config/db');
    const relatedVouchers = await db('vouchers as v')
      .leftJoin('users as u', 'v.created_by', 'u.id')
      .where({ 'v.purchase_order_id': req.params.id, 'v.company_id': req.params.companyId, 'v.deleted_at': null })
      .select('v.id', 'v.voucher_number', 'v.status', 'v.created_at', 'u.name as creator_name');

    // Fetch related requisition if linked
    let relatedRequisition = null;
    if (po.purchase_requisition_id) {
      relatedRequisition = await db('purchase_requisitions as pr')
        .leftJoin('users as u', 'pr.requested_by', 'u.id')
        .where({ 'pr.id': po.purchase_requisition_id, 'pr.company_id': req.params.companyId })
        .select('pr.id', 'pr.requisition_number', 'pr.status', 'pr.created_at', 'u.name as creator_name')
        .first();
    }

    // Fetch related goods receipts
    const relatedGrns = await db('goods_receipts as gr')
      .leftJoin('users as u', 'gr.received_by', 'u.id')
      .where({ 'gr.purchase_order_id': req.params.id, 'gr.company_id': req.params.companyId })
      .select('gr.id', 'gr.grn_number', 'gr.status', 'gr.created_at', 'u.name as creator_name');

    // Fetch active workflow instance current stage name
    let currentStageName = null;
    if (po.status === 'PENDING_APPROVAL') {
      const activeWorkflow = await db('workflow_instances as wi')
        .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
        .where({
          'wi.company_id': req.params.companyId,
          'wd.document_type_code': 'PURCHASE_ORDER',
          'wi.document_id': req.params.id,
          'wi.status': 'PENDING'
        })
        .first();

      if (activeWorkflow) {
        const currentStage = await db('workflow_stages')
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

    res.json({
      ...po,
      relatedVouchers,
      relatedRequisition,
      relatedGrns,
      currentStageName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPurchaseOrder = async (req, res) => {
  try {
    const po = await poService.createPurchaseOrder({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body
    });
    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updatePurchaseOrder = async (req, res) => {
  try {
    const po = await poService.updatePurchaseOrder(req.params.id, req.params.companyId, {
      userId: req.user?.id,
      ...req.body
    });
    res.json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.submitForApproval = async (req, res) => {
  try {
    const po = await poService.submitForApproval(req.params.id, req.params.companyId, req.user?.id);
    res.json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.convertToVoucher = async (req, res) => {
  try {
    const voucher = await poService.convertToVoucher(req.params.id, req.params.companyId, req.user?.id);
    res.json({ success: true, voucher });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getProcurementCounts = async (req, res) => {
  try {
    const db = require('../config/db');
    const { companyId } = req.params;

    const reqPending = await db('purchase_requisitions')
      .where({ company_id: companyId, status: 'PENDING_APPROVAL' })
      .count('id as count')
      .first();

    const poPending = await db('purchase_orders')
      .where({ company_id: companyId, status: 'PENDING_APPROVAL' })
      .count('id as count')
      .first();

    const grPending = await db('purchase_orders')
      .where({ company_id: companyId })
      .whereIn('status', ['APPROVED', 'PARTIALLY_RECEIVED'])
      .count('id as count')
      .first();

    const grnIdsWithVoucher = db('vouchers')
      .whereNotNull('goods_receipt_id')
      .andWhere({ company_id: companyId, deleted_at: null })
      .select('goods_receipt_id');
    const pvPending = await db('goods_receipts')
      .where({ company_id: companyId, status: 'RECEIVED' })
      .whereNotIn('id', grnIdsWithVoucher)
      .count('id as count')
      .first();

    const payPending = await db('vouchers')
      .where({ company_id: companyId, type: 'PURCHASE', status: 'POSTED', deleted_at: null })
      .count('id as count')
      .first();

    res.json({
      requisitionsPending: parseInt(reqPending?.count || 0, 10),
      posPending: parseInt(poPending?.count || 0, 10),
      receiptsPending: parseInt(grPending?.count || 0, 10),
      vouchersPending: parseInt(pvPending?.count || 0, 10),
      paymentsPending: parseInt(payPending?.count || 0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProcurementLineage = async (req, res) => {
  try {
    const lineageService = require('../services/procurement_lineage.service');
    const docs = await lineageService.getLineage(req.params.type, req.params.id, req.params.companyId);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
