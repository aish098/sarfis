/**
 * analytics.service.js
 * SCAFIS — Trend Analysis & Budget Planning Service
 * All calculations sourced from aggregated ledger/reports (NOT raw entries)
 */

const db = require("../config/db"); // your knex instance

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function growthPercent(oldVal, newVal) {
  if (!oldVal || oldVal === 0) return newVal > 0 ? 100 : 0;
  return parseFloat((((newVal - oldVal) / Math.abs(oldVal)) * 100).toFixed(2));
}

function monthLabel(month, year) {
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[month - 1]} ${year}`;
}

function buildMonthRange(startYear, startMonth, endYear, endMonth) {
  const range = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    range.push({
      label: monthLabel(m, y),
      year: y,
      month: m,
      revenue: 0,
      expenses: 0,
      assets: 0,
      liabilities: 0,
      equity: 0,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return range;
}

/**
 * Core aggregator: monthly debit/credit totals per account from journal_entries → ledger
 * Uses your existing journal_entries table (debit/credit columns)
 */
async function getMonthlyAccountTotals(companyId, startYear, startMonth, endYear, endMonth) {
  // Build date range
  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const endDate = new Date(endYear, endMonth, 0); // last day of endMonth
  const endDateStr = endDate.toISOString().split("T")[0];

  const rows = await db("journal_entries as je")
    .join("journal_lines as jel", "je.id", "jel.entry_id")
    .join("accounts as a", "jel.account_id", "a.id")
    .where("je.company_id", companyId)
    .whereBetween("je.entry_date", [startDate, endDateStr])
    .select(
      db.raw("EXTRACT(MONTH FROM je.entry_date)::int as period_month"),
      db.raw("EXTRACT(YEAR FROM je.entry_date)::int as period_year"),
      "jel.account_id",
      "a.name as account_name",
      "a.category as account_type",
      db.raw("SUM(jel.debit) as total_debit"),
      db.raw("SUM(jel.credit) as total_credit")
    )
    .groupBy(
      "period_month", "period_year",
      "jel.account_id", "a.name", "a.category"
    )
    .orderBy(["period_year", "period_month"]);

  return rows;
}

// ─────────────────────────────────────────────
// 1. COMPARATIVE STATEMENTS (Month vs Month / Year vs Year)
// ─────────────────────────────────────────────

async function getComparativeStatement(companyId, period1, period2) {
  /**
   * period = { month: 1-12, year: YYYY }
   * Returns side-by-side income statement / balance sheet data
   */
  const [p1Rows, p2Rows] = await Promise.all([
    getMonthlyAccountTotals(companyId, period1.year, period1.month, period1.year, period1.month),
    getMonthlyAccountTotals(companyId, period2.year, period2.month, period2.year, period2.month),
  ]);

  // Index by account_id
  const p1Map = {};
  for (const r of p1Rows) p1Map[r.account_id] = r;

  const p2Map = {};
  for (const r of p2Rows) p2Map[r.account_id] = r;

  // Merge all account ids
  const allAccIds = [...new Set([...Object.keys(p1Map), ...Object.keys(p2Map)])];

  const result = allAccIds.map((accId) => {
    const a = p1Map[accId] || {};
    const b = p2Map[accId] || {};

    const net1 = parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0);
    const net2 = parseFloat(b.total_credit || 0) - parseFloat(b.total_debit || 0);

    return {
      account_id: accId,
      account_name: a.account_name || b.account_name,
      account_type: a.account_type || b.account_type,
      account_category: a.account_category || b.account_category,
      period1: { label: monthLabel(period1.month, period1.year), net: net1 },
      period2: { label: monthLabel(period2.month, period2.year), net: net2 },
      variance: parseFloat((net2 - net1).toFixed(2)),
      variance_pct: growthPercent(net1, net2),
    };
  });

  return groupByType(result);
}

function groupByType(rows) {
  const groups = {};
  for (const r of rows) {
    const key = r.account_type || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

// ─────────────────────────────────────────────
// 2. TREND ANALYSIS (Time Series)
// ─────────────────────────────────────────────

async function getTrendAnalysis(companyId, months = 12, endPeriod = null) {
  /**
   * Returns monthly revenue, expense, profit trends for past N months
   */
  const now = new Date();
  let endMonth = now.getMonth() + 1;
  let endYear = now.getFullYear();

  if (endPeriod && /^\d{4}-\d{2}$/.test(endPeriod)) {
    const [y, m] = endPeriod.split("-");
    endYear = parseInt(y, 10);
    endMonth = parseInt(m, 10);
  }

  // Calculate start date
  let startMonth = endMonth - months + 1;
  let startYear = endYear;
  while (startMonth <= 0) { startMonth += 12; startYear--; }

  const rows = await getMonthlyAccountTotals(companyId, startYear, startMonth, endYear, endMonth);

  // Build monthly buckets
  const monthBuckets = {};
  for (const r of rows) {
    const key = `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;
    if (!monthBuckets[key]) {
      monthBuckets[key] = {
        label: monthLabel(r.period_month, r.period_year),
        year: r.period_year,
        month: r.period_month,
        revenue: 0,
        expenses: 0,
        assets: 0,
        liabilities: 0,
        equity: 0,
      };
    }

    const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
    const type = (r.account_type || "").toLowerCase();

    if (type === "revenue" || type === "income") {
      monthBuckets[key].revenue += net;
    } else if (type === "expense" || type === "cost") {
      monthBuckets[key].expenses += Math.abs(net);
    } else if (type === "asset") {
      monthBuckets[key].assets += net;
    } else if (type === "liability") {
      monthBuckets[key].liabilities += Math.abs(net);
    } else if (type === "equity") {
      monthBuckets[key].equity += net;
    }
  }

  const sorted = buildMonthRange(startYear, startMonth, endYear, endMonth).map((base) => {
    const key = `${base.year}-${String(base.month).padStart(2, "0")}`;
    return monthBuckets[key] ? { ...base, ...monthBuckets[key] } : base;
  });

  // Calculate profit and growth
  const trend = sorted.map((m, i) => {
    const prev = sorted[i - 1];
    return {
      ...m,
      profit: parseFloat((m.revenue - m.expenses).toFixed(2)),
      revenue: parseFloat(m.revenue.toFixed(2)),
      expenses: parseFloat(m.expenses.toFixed(2)),
      revenue_growth: prev ? growthPercent(prev.revenue, m.revenue) : 0,
      expense_growth: prev ? growthPercent(prev.expenses, m.expenses) : 0,
      profit_growth: prev ? growthPercent(prev.revenue - prev.expenses, m.revenue - m.expenses) : 0,
    };
  });

  return trend;
}

// ─────────────────────────────────────────────
// 3. VERTICAL ANALYSIS
// ─────────────────────────────────────────────

async function getVerticalAnalysis(companyId, month, year) {
  const rows = await getMonthlyAccountTotals(companyId, year, month, year, month);

  const incomeTypes = ["revenue", "income"];
  const expenseTypes = ["expense", "cost"];
  const assetTypes = ["asset"];
  const liabilityTypes = ["liability"];

  let totalRevenue = 0;
  let totalAssets = 0;

  // First pass: get totals
  for (const r of rows) {
    const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
    const type = (r.account_type || "").toLowerCase();
    if (incomeTypes.includes(type)) totalRevenue += net;
    if (assetTypes.includes(type)) totalAssets += net;
  }

  // Second pass: calculate %
  const incomeStatement = [];
  const balanceSheet = [];

  for (const r of rows) {
    const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
    const type = (r.account_type || "").toLowerCase();
    const absNet = Math.abs(net);

    if (incomeTypes.includes(type) || expenseTypes.includes(type)) {
      incomeStatement.push({
        account_id: r.account_id,
        account_name: r.account_name,
        account_type: r.account_type,
        amount: parseFloat(net.toFixed(2)),
        percentage: totalRevenue !== 0
          ? parseFloat((absNet / Math.abs(totalRevenue) * 100).toFixed(2))
          : 0,
      });
    }

    if (assetTypes.includes(type) || liabilityTypes.includes(type)) {
      balanceSheet.push({
        account_id: r.account_id,
        account_name: r.account_name,
        account_type: r.account_type,
        amount: parseFloat(net.toFixed(2)),
        percentage: totalAssets !== 0
          ? parseFloat((absNet / Math.abs(totalAssets) * 100).toFixed(2))
          : 0,
      });
    }
  }

  return {
    period: monthLabel(month, year),
    income_statement: { total_revenue: parseFloat(totalRevenue.toFixed(2)), items: incomeStatement },
    balance_sheet: { total_assets: parseFloat(totalAssets.toFixed(2)), items: balanceSheet },
  };
}

// ─────────────────────────────────────────────
// 4. SECTOR-WISE GROWTH
// ─────────────────────────────────────────────

async function getSectorGrowth(companyId, months = 6) {
  /**
   * Assumes you have a sales/invoices table with sector_id and amount
   * Adjust table/column names to match your schema
   */
  const now = new Date();
  let startMonth = now.getMonth() + 2 - months;
  let startYear = now.getFullYear();
  while (startMonth <= 0) { startMonth += 12; startYear--; }
  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;

  // Primary source: deliveries + sectors
  let rows = [];
  try {
    rows = await db("deliveries as d")
      .leftJoin("sectors as s", "d.sector_id", "s.id")
      .where("d.company_id", companyId)
      .where("d.delivery_date", ">=", startDate)
      .where("d.status", "DELIVERED")
      .select(
        "s.name as sector",
        db.raw("EXTRACT(MONTH FROM d.delivery_date)::int as period_month"),
        db.raw("EXTRACT(YEAR FROM d.delivery_date)::int as period_year"),
        db.raw("SUM(d.total_amount) as sector_revenue")
      )
      .groupBy("s.name", "period_month", "period_year")
      .orderBy(["period_year", "period_month"]);
  } catch (e) {
    console.warn("Sector growth error:", e.message);
    rows = [];
  }

  // Fallback source: derive "sector-like" streams from ledger account types.
  // This keeps Analytics & Planning useful even when deliveries/sectors are not populated.
  if (!rows.length) {
    const endMonth = now.getMonth() + 1;
    const endYear = now.getFullYear();
    const ledgerRows = await getMonthlyAccountTotals(
      companyId,
      startYear,
      startMonth,
      endYear,
      endMonth
    );

    const fallbackBuckets = {};
    for (const r of ledgerRows) {
      const rawType = (r.account_type || "Uncategorized").toLowerCase();
      let sector = "Uncategorized";
      if (rawType === "revenue" || rawType === "income") sector = "Revenue";
      else if (rawType === "expense" || rawType === "cost") sector = "Expenses";
      else if (rawType === "asset") sector = "Assets";
      else if (rawType === "liability") sector = "Liabilities";
      else if (rawType === "equity") sector = "Equity";

      const key = `${sector}-${r.period_year}-${r.period_month}`;
      const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
      const amount = Math.abs(net);

      if (!fallbackBuckets[key]) {
        fallbackBuckets[key] = {
          sector,
          period_month: r.period_month,
          period_year: r.period_year,
          sector_revenue: 0,
        };
      }
      fallbackBuckets[key].sector_revenue += amount;
    }

    rows = Object.values(fallbackBuckets);
  }

  // Group by sector
  const sectorMap = {};
  for (const r of rows) {
    const sector = r.sector || "Uncategorized";
    if (!sectorMap[sector]) sectorMap[sector] = [];
    sectorMap[sector].push({
      label: monthLabel(r.period_month, r.period_year),
      month: r.period_month,
      year: r.period_year,
      revenue: parseFloat(r.sector_revenue || 0),
    });
  }

  // Calculate growth per sector
  const result = Object.entries(sectorMap).map(([sector, periods]) => {
    const sorted = periods.sort((a, b) => a.year - b.year || a.month - b.month);
    const withGrowth = sorted.map((p, i) => ({
      ...p,
      growth_pct: i > 0 ? growthPercent(sorted[i - 1].revenue, p.revenue) : 0,
    }));
    const latestTwo = sorted.slice(-2);
    const overallGrowth = latestTwo.length === 2
      ? growthPercent(latestTwo[0].revenue, latestTwo[1].revenue)
      : 0;

    return { sector, periods: withGrowth, overall_growth_pct: overallGrowth };
  });

  return result;
}

// ─────────────────────────────────────────────
// 5. BUDGET CRUD
// ─────────────────────────────────────────────

async function createOrUpdateBudget(companyId, budgetData) {
  let { account_id, sector_id, budget_type, period_month, period_year, budget_amount, notes, currency } = budgetData;

  // 1. SMART LOOKUP: If account_id is provided, check if it's a primary key or a code
  if (account_id && budget_type === "account") {
    const acc = await db("accounts")
      .where({ company_id: companyId })
      .where(function() {
        this.where("id", isNaN(parseInt(account_id)) ? -1 : parseInt(account_id))
            .orWhere("code", String(account_id));
      })
      .first();
    
    if (!acc) {
      throw new Error(`Account "${account_id}" not found for this company.`);
    }
    account_id = acc.id; // Resolve to internal primary key
  }

  // 2. UPSERT LOGIC
  const existing = await db("budgets")
    .where({ 
      company_id: companyId, 
      account_id: account_id || null, 
      sector_id: sector_id || null, 
      period_month, 
      period_year, 
      budget_type 
    })
    .first();

  if (existing) {
    await db("budgets").where("id", existing.id).update({
      budget_amount: parseFloat(budget_amount) || 0,
      notes,
      currency: currency || "PKR",
      updated_at: db.fn.now(),
    });
    return { ...existing, budget_amount, updated: true };
  }

  const [res] = await db("budgets").insert({
    company_id: companyId,
    account_id: account_id || null,
    sector_id: sector_id || null,
    budget_type: budget_type || "account",
    period_month,
    period_year,
    budget_amount: parseFloat(budget_amount) || 0,
    notes,
    currency: currency || "PKR",
  }).returning("*");

  return { ...res, created: true };
}

async function getBudgets(companyId, year, month = null) {
  try {
    const q = db("budgets as b")
      .leftJoin("accounts as a", "b.account_id", "a.id")
      .where("b.company_id", companyId)
      .where("b.period_year", year);

    if (month) q.where("b.period_month", month);

    return q.select(
      "b.*",
      "a.name as account_name",
      "a.code as account_code",
      "a.category as account_type"
    ).orderBy(["b.period_month", "a.name", "b.id"]);
  } catch (e) {
    // Graceful fallback for environments where budget schema isn't ready yet
    // or where DB shape differs across local setups.
    console.warn("getBudgets fallback:", e.message);
    return [];
  }
}

async function deleteBudget(companyId, budgetId) {
  return db("budgets").where({ id: budgetId, company_id: companyId }).delete();
}

// ─────────────────────────────────────────────
// 6. BUDGET VS ACTUAL
// ─────────────────────────────────────────────

async function getBudgetVsActual(companyId, year, month = null) {
  let budgets = [];
  try {
    budgets = await getBudgets(companyId, year, month);
  } catch (e) {
    console.warn("getBudgetVsActual fallback:", e.message);
    return { items: [], summary: {} };
  }

  if (!budgets.length) return { budgets: [], summary: {} };

  // Get actual data for same period(s)
  const months = month ? [month] : [...new Set(budgets.map((b) => b.period_month))];

  const actuals = {};
  for (const m of months) {
    const rows = await getMonthlyAccountTotals(companyId, year, m, year, m);
    for (const r of rows) {
      const key = `${r.account_id}-${m}`;
      const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
      actuals[key] = net;
    }
  }

  let totalBudget = 0;
  let totalActual = 0;

  const result = budgets.map((b) => {
    const key = `${b.account_id}-${b.period_month}`;
    const actual = actuals[key] || 0;
    const budgetAmt = parseFloat(b.budget_amount || 0);
    const variance = parseFloat((actual - budgetAmt).toFixed(2));
    const variancePct = growthPercent(budgetAmt, actual);

    totalBudget += budgetAmt;
    totalActual += actual;

    return {
      ...b,
      actual_amount: parseFloat(actual.toFixed(2)),
      variance,
      variance_pct: variancePct,
      status: variance >= 0 ? "favorable" : "unfavorable",
    };
  });

  return {
    items: result,
    summary: {
      total_budget: parseFloat(totalBudget.toFixed(2)),
      total_actual: parseFloat(totalActual.toFixed(2)),
      total_variance: parseFloat((totalActual - totalBudget).toFixed(2)),
      total_variance_pct: growthPercent(totalBudget, totalActual),
    },
  };
}

// ─────────────────────────────────────────────
// 7. FINANCIAL RATIOS + FORECAST (Dashboard compatibility)
// ─────────────────────────────────────────────
async function getFinancialRatios(companyId, period = null) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    year = parseInt(y, 10);
    month = parseInt(m, 10);
  } else {
    // If no explicit period is requested, use the latest month that actually
    // has journal activity for this company (instead of blindly using current month).
    const latest = await db("journal_entries")
      .where("company_id", companyId)
      .max("entry_date as latest_entry_date")
      .first();

    if (latest?.latest_entry_date) {
      const d = new Date(latest.latest_entry_date);
      if (!Number.isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth() + 1;
      }
    }
  }

  const rows = await getMonthlyAccountTotals(companyId, year, month, year, month);

  let revenue = 0;
  let expenses = 0;
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let inventory = 0;
  let currentAssets = 0;
  let currentLiabilities = 0;

  for (const r of rows) {
    const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
    const type = String(r.account_type || "").toLowerCase();
    const accountName = String(r.account_name || "").toLowerCase();

    if (type === "revenue" || type === "income") revenue += net;
    if (type === "expense" || type === "cost") expenses += Math.abs(net);
    if (type === "asset") assets += net;
    if (type === "liability") liabilities += Math.abs(net);
    if (type === "equity") equity += net;

    if (type === "asset") {
      if (accountName.includes("inventory") || accountName.includes("stock")) inventory += Math.abs(net);
      if (
        accountName.includes("cash") ||
        accountName.includes("bank") ||
        accountName.includes("receivable") ||
        accountName.includes("inventory") ||
        accountName.includes("current")
      ) {
        currentAssets += Math.abs(net);
      }
    }

    if (type === "liability") {
      if (
        accountName.includes("payable") ||
        accountName.includes("accrued") ||
        accountName.includes("short") ||
        accountName.includes("current")
      ) {
        currentLiabilities += Math.abs(net);
      }
    }
  }

  // Fallback if account naming isn't standardized
  if (currentAssets === 0) currentAssets = Math.abs(assets);
  if (currentLiabilities === 0) currentLiabilities = Math.abs(liabilities);

  const netIncome = revenue - expenses;
  const quickAssets = Math.max(currentAssets - inventory, 0);

  return {
    revenue: parseFloat(revenue.toFixed(2)),
    netIncome: parseFloat(netIncome.toFixed(2)),
    equity: parseFloat(equity.toFixed(2)),
    inventory: parseFloat(inventory.toFixed(2)),
    currentAssets: parseFloat(currentAssets.toFixed(2)),
    currentLiabilities: parseFloat(currentLiabilities.toFixed(2)),
    currentRatio: currentLiabilities > 0 ? parseFloat((currentAssets / currentLiabilities).toFixed(2)) : 0,
    quickRatio: currentLiabilities > 0 ? parseFloat((quickAssets / currentLiabilities).toFixed(2)) : 0,
    profitMargin: revenue !== 0 ? parseFloat(((netIncome / revenue) * 100).toFixed(2)) : 0,
    roe: equity !== 0 ? parseFloat(((netIncome / equity) * 100).toFixed(2)) : 0,
    assetTurnover: assets !== 0 ? parseFloat((revenue / Math.abs(assets)).toFixed(2)) : 0,
  };
}

async function getRevenueForecast(companyId, monthsAhead = 6) {
  const trend = await getTrendAnalysis(companyId, 12);
  const historical = trend.map((r) => ({
    month: r.label,
    revenue: parseFloat(r.revenue || 0),
  }));

  if (historical.length === 0) return { historical: [], forecast: [] };

  // Simple linear regression on index vs revenue
  const n = historical.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = parseFloat(historical[i].revenue || 0);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = n !== 0 ? (sumY - slope * sumX) / n : 0;

  const lastDate = new Date();
  const forecast = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const x = n + i;
    const forecastRevenue = Math.max(intercept + slope * x, 0);
    const d = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
    forecast.push({
      month: monthLabel(d.getMonth() + 1, d.getFullYear()),
      forecast_revenue: parseFloat(forecastRevenue.toFixed(2)),
    });
  }

  return { historical, forecast };
}

// ─────────────────────────────────────────────
// 8. OPERATIONAL INSIGHTS (Inventory + Distribution + Warehouses)
// ─────────────────────────────────────────────
async function getOperationalInsights(companyId) {
  const payload = {
    summary: {
      total_skus: 0,
      low_stock_skus: 0,
      inventory_value: 0,
      warehouse_count: 0,
      delivered_revenue: 0,
      delivered_count: 0,
    },
    top_products: [],
    warehouse_load: [],
    sector_profitability: [],
  };

  // Inventory and stock status from pre-aggregated view
  try {
    const stockRows = await db("v_stock_summary")
      .where("company_id", companyId)
      .select(
        "product_id",
        "sku",
        "product_name",
        "total_qty",
        "unit_price",
        "cost_price",
        "reorder_level",
        "low_stock"
      );

    payload.summary.total_skus = stockRows.length;
    payload.summary.low_stock_skus = stockRows.filter((r) => r.low_stock).length;
    payload.summary.inventory_value = stockRows.reduce(
      (sum, r) => sum + (parseFloat(r.total_qty || 0) * parseFloat(r.cost_price || 0)),
      0
    );

    payload.top_products = stockRows
      .map((r) => ({
        product_id: r.product_id,
        sku: r.sku,
        product_name: r.product_name,
        qty: parseFloat(r.total_qty || 0),
        reorder_level: parseFloat(r.reorder_level || 0),
        unit_price: parseFloat(r.unit_price || 0),
        stock_value: parseFloat(r.total_qty || 0) * parseFloat(r.cost_price || 0),
      }))
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 8);
  } catch (e) {
    console.warn("Operational insights stock summary error:", e.message);
  }

  // Warehouse utilization by quantity and estimated value
  try {
    const warehouseRows = await db("inventory as i")
      .join("warehouses as w", "i.warehouse_id", "w.id")
      .join("products as p", "i.product_id", "p.id")
      .where("w.company_id", companyId)
      .groupBy("w.id", "w.name")
      .select(
        "w.id as warehouse_id",
        "w.name as warehouse_name",
        db.raw("COALESCE(SUM(i.quantity), 0) as total_qty"),
        db.raw("COALESCE(SUM(i.quantity * p.cost_price), 0) as estimated_value")
      )
      .orderBy("estimated_value", "desc");

    payload.summary.warehouse_count = warehouseRows.length;
    payload.warehouse_load = warehouseRows.map((r) => ({
      warehouse_id: r.warehouse_id,
      warehouse_name: r.warehouse_name,
      total_qty: parseFloat(r.total_qty || 0),
      estimated_value: parseFloat(r.estimated_value || 0),
    }));
  } catch (e) {
    console.warn("Operational insights warehouse summary error:", e.message);
  }

  // Sector revenue/profit from pre-aggregated view
  try {
    const sectorRows = await db("v_sector_revenue")
      .where("company_id", companyId)
      .select("sector_id", "sector_name", "delivery_count", "total_revenue", "total_cost", "gross_profit")
      .orderBy("total_revenue", "desc");

    payload.sector_profitability = sectorRows.map((r) => ({
      sector_id: r.sector_id,
      sector_name: r.sector_name,
      delivery_count: parseInt(r.delivery_count || 0, 10),
      total_revenue: parseFloat(r.total_revenue || 0),
      total_cost: parseFloat(r.total_cost || 0),
      gross_profit: parseFloat(r.gross_profit || 0),
      margin_pct: parseFloat(r.total_revenue || 0) > 0
        ? parseFloat((((parseFloat(r.gross_profit || 0)) / parseFloat(r.total_revenue || 0)) * 100).toFixed(2))
        : 0,
    }));

    payload.summary.delivered_revenue = payload.sector_profitability.reduce((sum, r) => sum + r.total_revenue, 0);
    payload.summary.delivered_count = payload.sector_profitability.reduce((sum, r) => sum + r.delivery_count, 0);
  } catch (e) {
    console.warn("Operational insights sector summary error:", e.message);
  }

  // Keep currency-like figures stable
  payload.summary.inventory_value = parseFloat(payload.summary.inventory_value.toFixed(2));
  payload.summary.delivered_revenue = parseFloat(payload.summary.delivered_revenue.toFixed(2));

  return payload;
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  getComparativeStatement,
  getTrendAnalysis,
  getVerticalAnalysis,
  getSectorGrowth,
  getFinancialRatios,
  getRevenueForecast,
  createOrUpdateBudget,
  getBudgets,
  deleteBudget,
  getBudgetVsActual,
  getOperationalInsights,
};
