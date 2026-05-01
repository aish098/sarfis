const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/analytics.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// Protect all analytics routes
router.use(authMiddleware);

// ── TREND & ANALYSIS ─────────────────────────────────────
// GET /api/analytics/trends/:companyId?months=12
router.get("/trends/:companyId", ctrl.getTrends);
// GET /api/analytics/ratios/:companyId?period=YYYY-MM
router.get("/ratios/:companyId", ctrl.getRatios);
// GET /api/analytics/forecast/:companyId?monthsAhead=6
router.get("/forecast/:companyId", ctrl.getForecast);

// GET /api/analytics/comparative/:companyId?p1month=1&p1year=2024&p2month=2&p2year=2024
router.get("/comparative/:companyId", ctrl.getComparative);

// GET /api/analytics/vertical/:companyId?month=3&year=2024
router.get("/vertical/:companyId", ctrl.getVertical);

// GET /api/analytics/sector-growth/:companyId?months=6
router.get("/sector-growth/:companyId", ctrl.getSectorGrowth);

// GET /api/analytics/operational-insights/:companyId
router.get("/operational-insights/:companyId", ctrl.getOperationalInsights);

// ── BUDGET ───────────────────────────────────────────────
// POST /api/analytics/budgets/:companyId
router.post("/budgets/:companyId", ctrl.createBudget);

// GET /api/analytics/budgets/:companyId?year=2024&month=3 (month optional)
router.get("/budgets/:companyId", ctrl.getBudgets);

// DELETE /api/analytics/budgets/:companyId/:budgetId
router.delete("/budgets/:companyId/:budgetId", ctrl.deleteBudget);

// GET /api/analytics/budget-vs-actual/:companyId?year=2024&month=3
router.get("/budget-vs-actual/:companyId", ctrl.getBudgetVsActual);

module.exports = router;
