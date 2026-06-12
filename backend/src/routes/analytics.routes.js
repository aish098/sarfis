const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/analytics.controller");
const { authMiddleware, checkRole, companyGuard } = require("../middleware/auth.middleware");

// Protect all analytics routes
router.use(authMiddleware);

const READ_ROLES = ['Company Admin', 'Accountant', 'Manager', 'Viewer'];
const WRITE_ROLES = ['Company Admin', 'Accountant', 'Manager'];

// ── TREND & ANALYSIS ─────────────────────────────────────
router.get("/trends/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getTrends);
router.get("/ratios/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getRatios);
router.get("/forecast/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getForecast);
router.get("/comparative/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getComparative);
router.get("/vertical/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getVertical);
router.get("/sector-growth/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getSectorGrowth);
router.get("/operational-insights/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getOperationalInsights);

// ── BUDGET ───────────────────────────────────────────────
router.post("/budgets/:companyId", companyGuard, checkRole(WRITE_ROLES), ctrl.createBudget);
router.get("/budgets/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getBudgets);
router.delete("/budgets/:companyId/:budgetId", companyGuard, checkRole(WRITE_ROLES), ctrl.deleteBudget);
router.get("/budget-vs-actual/:companyId", companyGuard, checkRole(READ_ROLES), ctrl.getBudgetVsActual);

module.exports = router;
