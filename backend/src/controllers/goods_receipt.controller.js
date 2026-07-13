const grService = require('../services/goods_receipt.service');

exports.getGoodsReceipts = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      search: req.query.search
    };
    const receipts = await grService.getGoodsReceipts(req.params.companyId, filters);
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getGoodsReceiptById = async (req, res) => {
  try {
    const receipt = await grService.getGoodsReceiptById(req.params.id, req.params.companyId);
    if (!receipt) return res.status(404).json({ error: 'Goods Receipt not found.' });
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createGoodsReceipt = async (req, res) => {
  try {
    const receipt = await grService.createGoodsReceipt({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body
    });
    res.status(201).json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.postGoodsReceipt = async (req, res) => {
  try {
    const receipt = await grService.postGoodsReceipt(req.params.id, req.params.companyId, req.user?.id);
    res.json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.convertToVoucher = async (req, res) => {
  try {
    const result = await grService.convertToVoucher(req.params.id, req.params.companyId, req.user?.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
