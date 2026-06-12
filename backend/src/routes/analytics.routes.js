const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/analytics.controller");
const { authMiddleware, requirePermission, companyGuard } = require("../middleware/auth.middleware");

// Protect all analytics routes
router.use(authMiddleware);

// ── TREND & ANALYSIS ─────────────────────────────────────
router.get("/trends/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getTrends);
router.get("/ratios/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getRatios);
router.get("/forecast/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getForecast);
router.get("/comparative/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getComparative);
router.get("/vertical/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getVertical);
router.get("/sector-growth/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getSectorGrowth);
router.get("/operational-insights/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getOperationalInsights);

// ── BUDGET ───────────────────────────────────────────────
router.post("/budgets/:companyId", companyGuard, requirePermission('settings.manage'), ctrl.createBudget);
router.get("/budgets/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getBudgets);
router.delete("/budgets/:companyId/:budgetId", companyGuard, requirePermission('settings.manage'), ctrl.deleteBudget);
router.get("/budget-vs-actual/:companyId", companyGuard, requirePermission('analytics.view'), ctrl.getBudgetVsActual);

module.exports = router;
