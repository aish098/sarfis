const prService = require('../services/purchase_requisition.service');
const DocumentRevisionService = require('../services/document_revision.service');

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
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message });
  }
};

exports.submitForApproval = async (req, res) => {
  try {
    const requisition = await prService.submitForApproval(req.params.id, req.params.companyId, req.user?.id);
    res.json(requisition);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message });
  }
};

exports.resubmitForApproval = async (req, res) => {
  try {
    const { revisionNotes, expectedVersion } = req.body;
    const requisition = await prService.resubmitForApproval(
      req.params.id,
      req.params.companyId,
      req.user?.id,
      revisionNotes,
      expectedVersion
    );
    res.json(requisition);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message });
  }
};

exports.getRevisions = async (req, res) => {
  try {
    const revisions = await DocumentRevisionService.getRevisions(
      req.params.companyId,
      'PURCHASE_REQUISITION',
      req.params.id
    );
    res.json(revisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
