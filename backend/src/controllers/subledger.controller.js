const SubledgerService = require('../services/subledger.service');

exports.getSubledgerSummary = async (req, res) => {
  const companyId = req.companyId;
  try {
    const summary = await SubledgerService.getSubledgerSummary(companyId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReceivablesSubledger = async (req, res) => {
  const companyId = req.companyId;
  try {
    const list = await SubledgerService.getReceivablesSubledger(companyId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPayablesSubledger = async (req, res) => {
  const companyId = req.companyId;
  try {
    const list = await SubledgerService.getPayablesSubledger(companyId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAgingAnalysis = async (req, res) => {
  const companyId = req.companyId;
  const { type } = req.params; // 'receivables' or 'payables'
  try {
    const aging = await SubledgerService.getAgingAnalysis(companyId, type);
    res.json(aging);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getIndividualAging = async (req, res) => {
  const companyId = req.companyId;
  const { type, id } = req.params; // type: 'customer' or 'supplier'
  try {
    const aging = await SubledgerService.getIndividualAging(companyId, type, parseInt(id, 10));
    res.json(aging);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSubledgerStatement = async (req, res) => {
  const companyId = req.companyId;
  const { type, id } = req.params; // type: 'customer' or 'supplier'
  try {
    let result;
    if (type === 'customer') {
      result = await SubledgerService.getCustomerStatement(companyId, parseInt(id, 10));
    } else if (type === 'supplier') {
      result = await SubledgerService.getVendorStatement(companyId, parseInt(id, 10));
    } else {
      return res.status(400).json({ message: 'Invalid subledger type. Must be customer or supplier.' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
