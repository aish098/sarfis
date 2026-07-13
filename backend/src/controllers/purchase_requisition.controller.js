const prService = require('../services/purchase_requisition.service');

exports.getPurchaseRequisitions = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      search: req.query.search
    };
    const requisitions = await prService.getPurchaseRequisitions(req.params.companyId, filters);
    res.json(requisitions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPurchaseRequisitionById = async (req, res) => {
  try {
    const requisition = await prService.getPurchaseRequisitionById(req.params.id, req.params.companyId);
    if (!requisition) return res.status(404).json({ error: 'Purchase Requisition not found.' });
    res.json(requisition);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPurchaseRequisition = async (req, res) => {
  try {
    const requisition = await prService.createPurchaseRequisition({
      companyId: req.params.companyId,
      requestedBy: req.user?.id,
      ...req.body
    });
    res.status(201).json(requisition);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updatePurchaseRequisition = async (req, res) => {
  try {
    const requisition = await prService.updatePurchaseRequisition(req.params.id, req.params.companyId, {
      ...req.body
    });
    res.json(requisition);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.submitForApproval = async (req, res) => {
  try {
    const requisition = await prService.submitForApproval(req.params.id, req.params.companyId, req.user?.id);
    res.json(requisition);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.convertToPurchaseOrder = async (req, res) => {
  try {
    const result = await prService.convertToPurchaseOrder(req.params.id, req.params.companyId, req.user?.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
