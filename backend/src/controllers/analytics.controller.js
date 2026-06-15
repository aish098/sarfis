/**
 * analytics.controller.js
 * SCAFIS — Trend & Budget API Controllers
 */

const analyticsService = require("../services/analytics.service");

// ── TREND ANALYSIS ──────────────────────────────────────

exports.getTrends = async (req, res) => {
  try {
    const { companyId } = req.params;
    const months = parseInt(req.query.months) || 12;
    const period = req.query.period || null; // optional YYYY-MM end period
    const data = await analyticsService.getTrendAnalysis(companyId, months, period);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getTrends error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRatios = async (req, res) => {
  try {
    const { companyId } = req.params;
    const period = req.query.period || null; // optional YYYY-MM
    const metrics = await analyticsService.getFinancialRatios(companyId, period);
    res.json({ success: true, metrics });
  } catch (err) {
    console.error("getRatios error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getForecast = async (req, res) => {
  try {
    const { companyId } = req.params;
    const monthsAhead = parseInt(req.query.monthsAhead, 10) || 6;
    const data = await analyticsService.getRevenueForecast(companyId, monthsAhead);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("getForecast error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getComparative = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { p1month, p1year, p2month, p2year } = req.query;

    if (!p1month || !p1year || !p2month || !p2year) {
      return res.status(400).json({ success: false, message: "Provide p1month, p1year, p2month, p2year" });
    }

    const data = await analyticsService.getComparativeStatement(
      companyId,
      { month: parseInt(p1month), year: parseInt(p1year) },
      { month: parseInt(p2month), year: parseInt(p2year) }
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("getComparative error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVertical = async (req, res) => {
  try {
    const { companyId } = req.params;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await analyticsService.getVerticalAnalysis(companyId, month, year);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getVertical error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSectorGrowth = async (req, res) => {
  try {
    const { companyId } = req.params;
    const months = parseInt(req.query.months) || 6;
    const data = await analyticsService.getSectorGrowth(companyId, months);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getSectorGrowth error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── BUDGET ──────────────────────────────────────────────

exports.createBudget = async (req, res) => {
  try {
    const { companyId } = req.params;
    const data = await analyticsService.createOrUpdateBudget(companyId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    console.error("createBudget error:", err);
    const isValidationError = err.message.includes("required") ||
                              err.message.includes("Invalid budget period") ||
                              err.message.includes("must be") ||
                              err.message.includes("not found");
    const status = isValidationError ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

exports.getBudgets = async (req, res) => {
  try {
    const { companyId } = req.params;
    let year = parseInt(req.query.year);
    let month = req.query.month ? parseInt(req.query.month) : null;

    if (req.query.period && /^\d{4}-\d{2}$/.test(req.query.period)) {
      const [y, m] = req.query.period.split("-");
      year = parseInt(y);
      month = parseInt(m);
    }

    if (!year || isNaN(year)) {
      year = new Date().getFullYear();
    }

    const data = await analyticsService.getBudgets(companyId, year, month);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getBudgets error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBudget = async (req, res) => {
  try {
    const { companyId, budgetId } = req.params;
    await analyticsService.deleteBudget(companyId, budgetId);
    res.json({ success: true, message: "Budget deleted" });
  } catch (err) {
    console.error("deleteBudget error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBudgetVsActual = async (req, res) => {
  try {
    const { companyId } = req.params;
    let year = parseInt(req.query.year);
    let month = req.query.month ? parseInt(req.query.month) : null;

    if (req.query.period && /^\d{4}-\d{2}$/.test(req.query.period)) {
      const [y, m] = req.query.period.split("-");
      year = parseInt(y);
      month = parseInt(m);
    }

    if (!year || isNaN(year)) {
      year = new Date().getFullYear();
    }

    const data = await analyticsService.getBudgetVsActual(companyId, year, month);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getBudgetVsActual error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOperationalInsights = async (req, res) => {
  try {
    const { companyId } = req.params;
    const data = await analyticsService.getOperationalInsights(companyId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getOperationalInsights error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
