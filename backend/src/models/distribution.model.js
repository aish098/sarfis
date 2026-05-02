const db = require('../config/db');

// ─── SECTORS ──────────────────────────────────────────────
const getSectors = (companyId) =>
  db('sectors').where({ company_id: companyId, is_active: true }).orderBy('name');

const createSector = (data) =>
  db('sectors').insert(data).returning('*').then(r => r[0]);

const getSectorRevenue = (companyId) =>
  db('v_sector_revenue').where({ company_id: companyId }).orderBy('total_revenue', 'desc');

// ─── CLIENTS ──────────────────────────────────────────────
const getClients = (companyId) =>
  db('clients as c')
    .leftJoin('sectors as s', 's.id', 'c.sector_id')
    .where('c.company_id', companyId)
    .select('c.*', 's.name as sector_name')
    .orderBy('c.name');

const getClientById = (id, companyId) =>
  db('clients as c')
    .leftJoin('sectors as s', 's.id', 'c.sector_id')
    .where({ 'c.id': id, 'c.company_id': companyId })
    .select('c.*', 's.name as sector_name')
    .first();

const createClient = (data) =>
  db('clients').insert(data).returning('*').then(r => r[0]);

const updateClient = (id, companyId, data) =>
  db('clients').where({ id, company_id: companyId })
    .update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]);

const getClientBalances = (companyId) =>
  db('v_client_balance').where({ company_id: companyId }).orderBy('current_balance', 'desc');

// ─── DELIVERIES ───────────────────────────────────────────
const getDeliveries = (companyId, filters = {}) => {
  let q = db('deliveries as d')
    .join('clients as c', 'c.id', 'd.client_id')
    .leftJoin('sectors as s', 's.id', 'd.sector_id')
    .leftJoin('warehouses as w', 'w.id', 'd.warehouse_id')
    .where('d.company_id', companyId)
    .select(
      'd.*',
      'c.name as client_name',
      's.name as sector_name',
      'w.name as warehouse_name'
    )
    .orderBy('d.delivery_date', 'desc');

  if (filters.status) q = q.where('d.status', filters.status);
  if (filters.client_id) q = q.where('d.client_id', filters.client_id);
  if (filters.sector_id) q = q.where('d.sector_id', filters.sector_id);
  if (filters.from) q = q.where('d.delivery_date', '>=', filters.from);
  if (filters.to) q = q.where('d.delivery_date', '<=', filters.to);

  return q;
};

const getDeliveryById = (id, companyId) =>
  db('deliveries as d')
    .join('clients as c', 'c.id', 'd.client_id')
    .leftJoin('sectors as s', 's.id', 'd.sector_id')
    .join('warehouses as w', 'w.id', 'd.warehouse_id')
    .where({ 'd.id': id, 'd.company_id': companyId })
    .select('d.*', 'c.name as client_name', 's.name as sector_name', 'w.name as warehouse_name')
    .first();

const getDeliveryItems = (deliveryId) =>
  db('delivery_items as di')
    .join('products as p', 'p.id', 'di.product_id')
    .where('di.delivery_id', deliveryId)
    .select('di.*', 'p.name as product_name', 'p.sku', 'p.unit_of_measure');

const createDelivery = (trx, data) =>
  trx('deliveries').insert(data).returning('*').then(r => r[0]);

const createDeliveryItems = (trx, items) =>
  trx('delivery_items').insert(items).returning('*');

const updateDeliveryStatus = (id, companyId, status) =>
  db('deliveries').where({ id, company_id: companyId })
    .update({ status, updated_at: db.fn.now() }).returning('*').then(r => r[0]);

const updateClientBalance = (trx, clientId, amountDelta) =>
  trx('clients')
    .where('id', clientId)
    .increment('current_balance', amountDelta)
    .returning('*');

// ─── ANALYTICS ────────────────────────────────────────────
const getTopClients = (companyId, limit = 5) =>
  db('deliveries as d')
    .join('clients as c', 'c.id', 'd.client_id')
    .where({ 'd.company_id': companyId, 'd.status': 'DELIVERED' })
    .groupBy('c.id', 'c.name', 'c.current_balance', 'c.credit_limit')
    .select(
      'c.id',
      'c.name',
      'c.current_balance',
      'c.credit_limit',
      db.raw('COUNT(d.id) as order_count'),
      db.raw('SUM(d.total_amount) as total_revenue')
    )
    .orderBy('total_revenue', 'desc')
    .limit(limit);

const getDistributionDashboardStats = async (companyId) => {
  const [totalClients] = await db('clients').where({ company_id: companyId, is_active: true }).count('* as count');
  const [pendingOrders] = await db('deliveries').where({ company_id: companyId, status: 'PENDING' }).count('* as count');
  const [blockedClients] = await db('v_client_balance').where({ company_id: companyId, credit_blocked: true }).count('* as count');
  const monthRevenue = await db('deliveries')
    .where({ company_id: companyId, status: 'DELIVERED' })
    .andWhere('delivery_date', '>=', db.raw("CURRENT_DATE - INTERVAL '30 days'"))
    .sum('total_amount as revenue').first();

  console.log(`[STATS] Dashboard for ${companyId}: Clients ${totalClients.count}, Pending ${pendingOrders.count}`);

  return {
    totalClients: parseInt(totalClients.count || 0),
    pendingOrders: parseInt(pendingOrders.count || 0),
    blockedClients: parseInt(blockedClients.count || 0),
    monthRevenue: parseFloat(monthRevenue?.revenue || 0),
  };
};

// Delivery number generator
const getNextDeliveryNumber = async (companyId) => {
  const count = await db('deliveries').where({ company_id: companyId }).count('* as c').first();
  return `DO-${String(parseInt(count.c) + 1).padStart(5, '0')}`;
};

module.exports = {
  getSectors, createSector, getSectorRevenue,
  getClients, getClientById, createClient, updateClient, getClientBalances,
  getDeliveries, getDeliveryById, getDeliveryItems,
  createDelivery, createDeliveryItems, updateDeliveryStatus, updateClientBalance,
  getTopClients, getDistributionDashboardStats, getNextDeliveryNumber,
};
