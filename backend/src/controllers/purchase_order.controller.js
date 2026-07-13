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

    res.json({
      ...po,
      relatedVouchers,
      relatedRequisition
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
