const router = require('express').Router();
const invCtrl = require('../controllers/inventory.controller');
const distCtrl = require('../controllers/distribution.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// ─────────────────────────────────────────────────────────
// INVENTORY ROUTES
// ─────────────────────────────────────────────────────────
// Warehouses
router.get('/warehouses/:companyId',       companyGuard, requirePermission('inventory.view'), invCtrl.getWarehouses);
router.post('/warehouses/:companyId',      companyGuard, requirePermission('warehouse.manage'), invCtrl.createWarehouse);
router.put('/warehouses/:companyId/:id',   companyGuard, requirePermission('warehouse.manage'), invCtrl.updateWarehouse);
router.delete('/warehouses/:companyId/:id', companyGuard, requirePermission('warehouse.manage'), invCtrl.deleteWarehouse);

// Products
router.get('/products/:companyId',         companyGuard, requirePermission('inventory.view'), invCtrl.getProducts);
router.post('/products/:companyId',        companyGuard, requirePermission('product.manage'), invCtrl.createProduct);
router.put('/products/:companyId/:id',     companyGuard, requirePermission('product.manage'), invCtrl.updateProduct);

// Stock
router.get('/stock/:companyId',            companyGuard, requirePermission('inventory.view'), invCtrl.getStockSummary);
router.get('/stock/:companyId/low',        companyGuard, requirePermission('inventory.view'), invCtrl.getLowStockAlerts);
router.get('/stock/product/:productId',    requirePermission('inventory.view'), invCtrl.getStockByProduct);
router.get('/stock/logs/:productId',       requirePermission('inventory.view'), invCtrl.getStockLogs);

// Operations
router.post('/stock/:companyId/purchase',  companyGuard, requirePermission('inventory.edit'), invCtrl.processPurchase);
router.post('/stock/:companyId/adjust',    companyGuard, requirePermission('inventory.edit'), invCtrl.adjustStock);

// Dashboard
router.get('/inventory/:companyId/dashboard', companyGuard, requirePermission('inventory.view'), invCtrl.getDashboardStats);

// ─────────────────────────────────────────────────────────
// DISTRIBUTION ROUTES
// ─────────────────────────────────────────────────────────
// Sectors
router.get('/sectors/:companyId',              companyGuard, requirePermission('analytics.view'), distCtrl.getSectors);
router.post('/sectors/:companyId',             companyGuard, requirePermission('settings.manage'), distCtrl.createSector);
router.get('/sectors/:companyId/revenue',      companyGuard, requirePermission('analytics.view'), distCtrl.getSectorRevenue);

// Clients
router.get('/clients/:companyId',              companyGuard, requirePermission('client.manage'), distCtrl.getClients);
router.get('/clients/:companyId/:id',          companyGuard, requirePermission('client.manage'), distCtrl.getClientById);
router.post('/clients/:companyId',             companyGuard, requirePermission('client.manage'), distCtrl.createClient);
router.put('/clients/:companyId/:id',          companyGuard, requirePermission('client.manage'), distCtrl.updateClient);
router.get('/clients/:companyId/balances',     companyGuard, requirePermission('client.manage'), distCtrl.getClientBalances);

// Deliveries
router.get('/deliveries/:companyId',           companyGuard, requirePermission('inventory.view'), distCtrl.getDeliveries);
router.get('/deliveries/:companyId/:id',       companyGuard, requirePermission('inventory.view'), distCtrl.getDeliveryById);
router.post('/deliveries/:companyId',          companyGuard, requirePermission('inventory.edit'), distCtrl.createDelivery);
router.patch('/deliveries/:companyId/:id/status', companyGuard, requirePermission('inventory.edit'), distCtrl.updateDeliveryStatus);

// Analytics
router.get('/distribution/:companyId/dashboard', companyGuard, requirePermission('analytics.view'), distCtrl.getDashboardStats);
router.get('/distribution/:companyId/top-clients', companyGuard, requirePermission('analytics.view'), distCtrl.getTopClients);

module.exports = router;
