const soService = require('../services/sales_order.service');

exports.getSalesOrders = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      search: req.query.search
    };
    const orders = await soService.getSalesOrders(req.params.companyId, filters);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSalesOrderById = async (req, res) => {
  try {
    const order = await soService.getSalesOrderById(req.params.id, req.params.companyId);
    if (!order) return res.status(404).json({ error: 'Sales Order not found.' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSalesOrder = async (req, res) => {
  try {
    const order = await soService.createSalesOrder({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body
    });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.confirmSalesOrder = async (req, res) => {
  try {
    const order = await soService.confirmSalesOrder(req.params.id, req.params.companyId, req.user?.id);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await soService.updateStatus(req.params.id, req.params.companyId, status, req.user?.id);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.convertToVoucher = async (req, res) => {
  try {
    const result = await soService.convertToVoucher(req.params.id, req.params.companyId, req.user?.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
