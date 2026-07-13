const distModel = require('../models/distribution.model');
const distService = require('../services/distribution.service');

// ─── SECTORS ──────────────────────────────────────────────
exports.getSectors = async (req, res) => {
  try { res.json(await distModel.getSectors(req.params.companyId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createSector = async (req, res) => {
  try {
    const sector = await distModel.createSector({ company_id: req.params.companyId, ...req.body });
    res.status(201).json(sector);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.getSectorRevenue = async (req, res) => {
  try { res.json(await distModel.getSectorRevenue(req.params.companyId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── CLIENTS ──────────────────────────────────────────────
exports.getClients = async (req, res) => {
  try { res.json(await distModel.getClients(req.params.companyId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getClientById = async (req, res) => {
  try {
    const client = await distModel.getClientById(req.params.id, req.params.companyId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createClient = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.sector_id === '') data.sector_id = null;
    const client = await distModel.createClient({ company_id: req.params.companyId, ...data });
    res.status(201).json(client);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateClient = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.sector_id === '') data.sector_id = null;
    const client = await distModel.updateClient(req.params.id, req.params.companyId, data);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.getClientBalances = async (req, res) => {
  try { res.json(await distModel.getClientBalances(req.params.companyId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── DELIVERIES ───────────────────────────────────────────
exports.getDeliveries = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      client_id: req.query.client_id,
      sector_id: req.query.sector_id,
      from: req.query.from,
      to: req.query.to,
    };
    res.json(await distModel.getDeliveries(req.params.companyId, filters));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDeliveryById = async (req, res) => {
  try {
    const [delivery, items] = await Promise.all([
      distModel.getDeliveryById(req.params.id, req.params.companyId),
      distModel.getDeliveryItems(req.params.id),
    ]);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    let relatedVoucher = null;
    if (delivery.voucher_id) {
      const db = require('../config/db');
      relatedVoucher = await db('vouchers')
        .where({ id: delivery.voucher_id, company_id: req.params.companyId, deleted_at: null })
        .select('id', 'voucher_number', 'status')
        .first();
    }

    res.json({ ...delivery, items, relatedVoucher });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createDelivery = async (req, res) => {
  try {
    const delivery = await distService.createDeliveryOrder({
      companyId: req.params.companyId,
      userId: req.user?.id,
      ...req.body,
    });
    res.status(201).json(delivery);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (status === 'CONFIRMED') {
      res.json(await distService.confirmDelivery(req.params.id, req.params.companyId, req.user?.id));
    } else if (status === 'DELIVERED') {
      res.json(await distService.markDelivered(req.params.id, req.params.companyId));
    } else if (status === 'CANCELLED') {
      res.json(await distService.cancelDelivery(req.params.id, req.params.companyId, req.user?.id));
    } else {
      res.json(await distModel.updateDeliveryStatus(req.params.id, req.params.companyId, status));
    }
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── ANALYTICS / DASHBOARD ────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const [stats, topClients, sectorRevenue] = await Promise.all([
      distModel.getDistributionDashboardStats(req.params.companyId),
      distModel.getTopClients(req.params.companyId, 5),
      distModel.getSectorRevenue(req.params.companyId),
    ]);
    res.json({ stats, topClients, sectorRevenue });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTopClients = async (req, res) => {
  try { res.json(await distModel.getTopClients(req.params.companyId, req.query.limit || 5)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};
