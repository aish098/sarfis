const router = require('express').Router();
const invCtrl = require('../controllers/inventory.controller');
const distCtrl = require('../controllers/distribution.controller');
const { authMiddleware, checkRole, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

const ALL_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Inventory Manager', 'Purchasing Agent', 'Viewer'];
const INV_WRITE_ROLES = ['Company Admin', 'Inventory Manager', 'Manager'];
const DIST_WRITE_ROLES = ['Company Admin', 'Manager', 'Accountant'];

// ─────────────────────────────────────────────────────────
// INVENTORY ROUTES
// ─────────────────────────────────────────────────────────
// Warehouses
router.get('/warehouses/:companyId',       companyGuard, checkRole(ALL_ROLES), invCtrl.getWarehouses);
router.post('/warehouses/:companyId',      companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.createWarehouse);
router.put('/warehouses/:companyId/:id',   companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.updateWarehouse);
router.delete('/warehouses/:companyId/:id', companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.deleteWarehouse);

// Products
router.get('/products/:companyId',         companyGuard, checkRole(ALL_ROLES), invCtrl.getProducts);
router.post('/products/:companyId',        companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.createProduct);
router.put('/products/:companyId/:id',     companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.updateProduct);

// Stock
router.get('/stock/:companyId',            companyGuard, checkRole(ALL_ROLES), invCtrl.getStockSummary);
router.get('/stock/:companyId/low',        companyGuard, checkRole(ALL_ROLES), invCtrl.getLowStockAlerts);
router.get('/stock/product/:productId',    checkRole(ALL_ROLES), invCtrl.getStockByProduct);
router.get('/stock/logs/:productId',       checkRole(ALL_ROLES), invCtrl.getStockLogs);

// Operations
router.post('/stock/:companyId/purchase',  companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.processPurchase);
router.post('/stock/:companyId/adjust',    companyGuard, checkRole(INV_WRITE_ROLES), invCtrl.adjustStock);

// Dashboard
router.get('/inventory/:companyId/dashboard', companyGuard, checkRole(ALL_ROLES), invCtrl.getDashboardStats);

// ─────────────────────────────────────────────────────────
// DISTRIBUTION ROUTES
// ─────────────────────────────────────────────────────────
// Sectors
router.get('/sectors/:companyId',              companyGuard, checkRole(ALL_ROLES), distCtrl.getSectors);
router.post('/sectors/:companyId',             companyGuard, checkRole(DIST_WRITE_ROLES), distCtrl.createSector);
router.get('/sectors/:companyId/revenue',      companyGuard, checkRole(ALL_ROLES), distCtrl.getSectorRevenue);

// Clients
router.get('/clients/:companyId',              companyGuard, checkRole(ALL_ROLES), distCtrl.getClients);
router.get('/clients/:companyId/:id',          companyGuard, checkRole(ALL_ROLES), distCtrl.getClientById);
router.post('/clients/:companyId',             companyGuard, checkRole(DIST_WRITE_ROLES), distCtrl.createClient);
router.put('/clients/:companyId/:id',          companyGuard, checkRole(DIST_WRITE_ROLES), distCtrl.updateClient);
router.get('/clients/:companyId/balances',     companyGuard, checkRole(ALL_ROLES), distCtrl.getClientBalances);

// Deliveries
router.get('/deliveries/:companyId',           companyGuard, checkRole(ALL_ROLES), distCtrl.getDeliveries);
router.get('/deliveries/:companyId/:id',       companyGuard, checkRole(ALL_ROLES), distCtrl.getDeliveryById);
router.post('/deliveries/:companyId',          companyGuard, checkRole(DIST_WRITE_ROLES), distCtrl.createDelivery);
router.patch('/deliveries/:companyId/:id/status', companyGuard, checkRole(DIST_WRITE_ROLES), distCtrl.updateDeliveryStatus);

// Analytics
router.get('/distribution/:companyId/dashboard', companyGuard, checkRole(ALL_ROLES), distCtrl.getDashboardStats);
router.get('/distribution/:companyId/top-clients', companyGuard, checkRole(ALL_ROLES), distCtrl.getTopClients);

module.exports = router;
