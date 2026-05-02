const router = require('express').Router();
const invCtrl = require('../controllers/inventory.controller');
const distCtrl = require('../controllers/distribution.controller');
const { authMiddleware, checkRole, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// ─────────────────────────────────────────────────────────
// INVENTORY ROUTES
// ─────────────────────────────────────────────────────────
// Warehouses
router.get('/warehouses/:companyId',       companyGuard, invCtrl.getWarehouses);
router.post('/warehouses/:companyId',      companyGuard, checkRole(['Company Admin', 'Inventory Manager']), invCtrl.createWarehouse);
router.put('/warehouses/:companyId/:id',   companyGuard, checkRole(['Company Admin', 'Inventory Manager']), invCtrl.updateWarehouse);
router.delete('/warehouses/:companyId/:id', companyGuard, checkRole(['Company Admin', 'Inventory Manager']), invCtrl.deleteWarehouse);

// Products
router.get('/products/:companyId',         invCtrl.getProducts);
router.post('/products/:companyId',        invCtrl.createProduct);
router.put('/products/:companyId/:id',     invCtrl.updateProduct);

// Stock
router.get('/stock/:companyId',            invCtrl.getStockSummary);
router.get('/stock/:companyId/low',        invCtrl.getLowStockAlerts);
router.get('/stock/product/:productId',    invCtrl.getStockByProduct);
router.get('/stock/logs/:productId',       invCtrl.getStockLogs);

// Operations
router.post('/stock/:companyId/purchase',  invCtrl.processPurchase);
router.post('/stock/:companyId/adjust',    invCtrl.adjustStock);

// Dashboard
router.get('/inventory/:companyId/dashboard', invCtrl.getDashboardStats);

// ─────────────────────────────────────────────────────────
// DISTRIBUTION ROUTES
// ─────────────────────────────────────────────────────────
// Sectors
router.get('/sectors/:companyId',              distCtrl.getSectors);
router.post('/sectors/:companyId',             distCtrl.createSector);
router.get('/sectors/:companyId/revenue',      distCtrl.getSectorRevenue);

// Clients
router.get('/clients/:companyId',              distCtrl.getClients);
router.get('/clients/:companyId/:id',          distCtrl.getClientById);
router.post('/clients/:companyId',             distCtrl.createClient);
router.put('/clients/:companyId/:id',          distCtrl.updateClient);
router.get('/clients/:companyId/balances',     distCtrl.getClientBalances);

// Deliveries
router.get('/deliveries/:companyId',           distCtrl.getDeliveries);
router.get('/deliveries/:companyId/:id',       distCtrl.getDeliveryById);
router.post('/deliveries/:companyId',          distCtrl.createDelivery);
router.patch('/deliveries/:companyId/:id/status', distCtrl.updateDeliveryStatus);

// Analytics
router.get('/distribution/:companyId/dashboard', distCtrl.getDashboardStats);
router.get('/distribution/:companyId/top-clients', distCtrl.getTopClients);

module.exports = router;
