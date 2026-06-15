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

  const sorted = Object.values(monthBuckets).sort(
    (a, b) => a.year - b.year || a.month - b.month
  );

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
  let { account_id, sector_id, budget_type, period_month, period_year, budget_amount, notes, currency, period, amount } = budgetData;

  // Fallbacks
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-');
    period_year = parseInt(y);
    period_month = parseInt(m);
  }
  if (budget_amount === undefined || budget_amount === null || budget_amount === "") {
    budget_amount = amount;
  }

  // Parse & Validate Year & Month
  period_month = parseInt(period_month);
  period_year = parseInt(period_year);
  if (isNaN(period_month) || period_month < 1 || period_month > 12) {
    throw new Error("Invalid budget period: month must be between 1 and 12.");
  }
  if (isNaN(period_year) || period_year < 1900 || period_year > 2100) {
    throw new Error("Invalid budget period: year is required and must be a valid year.");
  }

  // Validate Amount
  const parsedAmount = parseFloat(budget_amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    throw new Error("Invalid budget amount: amount must be a numeric value greater than or equal to zero.");
  }
  budget_amount = parsedAmount;

  budget_type = budget_type || "account";
  if (account_id === "") account_id = null;
  if (sector_id === "") sector_id = null;

  if (budget_type === "account" && !account_id) {
    throw new Error("Account ID is required for account budgets.");
  }
  if (budget_type === "sector" && !sector_id) {
    throw new Error("Sector name/ID is required for sector budgets.");
  }

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
      budget_amount,
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
    budget_type,
    period_month,
    period_year,
    budget_amount,
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

    const result = await q.select(
      "b.*",
      "a.name as account_name",
      "a.code as account_code",
      "a.category as account_type"
    ).orderBy(["b.period_month", "a.name", "b.id"]);
    
    return result;
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

async function getBudgetVsActual(companyId, selectedYear = null, selectedMonth = null, mode = "all") {
  // Fetch all budgets for this company to determine available periods
  const budgets = await db("budgets as b")
    .leftJoin("accounts as a", "b.account_id", "a.id")
    .where("b.company_id", companyId)
    .select(
      "b.*",
      "a.name as account_name",
      "a.code as account_code",
      "a.category as account_type"
    )
    .orderBy(["b.period_year", "b.period_month", "a.name", "b.id"]);

  if (!budgets.length) {
    const curYear = selectedYear || new Date().getFullYear();
    const curMonth = selectedMonth || new Date().getMonth() + 1;
    return {
      mode,
      availablePeriods: [],
      latestPeriod: { year: curYear, month: curMonth, label: monthLabel(curMonth, curYear) },
      trend: [],
      detailItems: [],
      summary: {
        total_budget: 0,
        total_actual: 0,
        total_variance: 0,
        total_variance_pct: 0
      }
    };
  }

  // Generate a list of chronological months with budget entries
  const availablePeriodsMap = {};
  for (const b of budgets) {
    const key = `${b.period_year}-${String(b.period_month).padStart(2, "0")}`;
    if (!availablePeriodsMap[key]) {
      availablePeriodsMap[key] = {
        year: b.period_year,
        month: b.period_month,
        label: monthLabel(b.period_month, b.period_year)
      };
    }
  }
  const availablePeriods = Object.values(availablePeriodsMap).sort(
    (a, b) => a.year - b.year || a.month - b.month
  );

  const latestPeriod = availablePeriods[availablePeriods.length - 1];

  let activeYear = parseInt(selectedYear);
  let activeMonth = parseInt(selectedMonth);

  if (!activeYear || isNaN(activeYear)) {
    activeYear = latestPeriod.year;
  }
  if (!activeMonth || isNaN(activeMonth)) {
    activeMonth = latestPeriod.month;
  }

  // Calculate range of dates to pull actuals for (encompass available periods and activeYear)
  let minYear = Math.min(activeYear, availablePeriods[0].year);
  let minMonth = minYear === activeYear ? 1 : availablePeriods[0].month;
  let maxYear = Math.max(activeYear, latestPeriod.year);
  let maxMonth = maxYear === activeYear ? 12 : latestPeriod.month;

  const actualRows = await getMonthlyAccountTotals(
    companyId,
    minYear,
    minMonth,
    maxYear,
    maxMonth
  );

  const actualsMap = {}; // key: `${account_id}-${year}-${month}`
  for (const r of actualRows) {
    const key = `${r.account_id}-${r.period_year}-${r.period_month}`;
    const net = parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0);
    actualsMap[key] = (actualsMap[key] || 0) + net;
  }

  // Fetch actual sector revenues
  const startDate = `${minYear}-${String(minMonth).padStart(2, "0")}-01`;
  const endDate = new Date(maxYear, maxMonth, 0);
  const endDateStr = endDate.toISOString().split("T")[0];

  let sectorActuals = [];
  try {
    sectorActuals = await db("deliveries as d")
      .leftJoin("sectors as s", "d.sector_id", "s.id")
      .where("d.company_id", companyId)
      .where("d.status", "DELIVERED")
      .whereBetween("d.delivery_date", [startDate, endDateStr])
      .select(
        "s.name as sector_name",
        db.raw("EXTRACT(MONTH FROM d.delivery_date)::int as period_month"),
        db.raw("EXTRACT(YEAR FROM d.delivery_date)::int as period_year"),
        db.raw("SUM(d.total_amount) as total_revenue")
      )
      .groupBy("s.name", "period_month", "period_year");
  } catch (e) {
    console.warn("getBudgetVsActual sector actuals fetch failed:", e.message);
  }

  const sectorActualsMap = {}; // key: `${sector_name}-${year}-${month}`
  for (const sa of sectorActuals) {
    const key = `${sa.sector_name}-${sa.period_year}-${sa.period_month}`;
    sectorActualsMap[key] = parseFloat(sa.total_revenue || 0);
  }

  // Map budgets to actuals
  const mappedBudgets = budgets.map((b) => {
    const actual = b.budget_type === "sector"
      ? (sectorActualsMap[`${b.sector_id}-${b.period_year}-${b.period_month}`] || 0)
      : (actualsMap[`${b.account_id}-${b.period_year}-${b.period_month}`] || 0);
    const budgetAmt = parseFloat(b.budget_amount || 0);
    const variance = parseFloat((actual - budgetAmt).toFixed(2));
    const variancePct = growthPercent(budgetAmt, actual);

    return {
      ...b,
      actual_amount: parseFloat(actual.toFixed(2)),
      budget_amount: budgetAmt,
      variance,
      variance_pct: variancePct,
      status: variance >= 0 ? "favorable" : "unfavorable"
    };
  });

  // Calculate unique budgeted accounts/sectors for all_periods mode
  const budgetedAccountIds = [...new Set(budgets.filter(b => b.budget_type === 'account' && b.account_id).map(b => b.account_id))];
  const budgetedSectorIds = [...new Set(budgets.filter(b => b.budget_type === 'sector' && b.sector_id).map(b => b.sector_id))];

  // Group trend depending on mode
  let trend = [];

  if (mode === "all" || mode === "month") {
    // Only months with budget entries
    const trendMap = {};
    for (const p of availablePeriods) {
      const key = `${p.year}-${p.month}`;
      trendMap[key] = {
        period: p.label,
        year: p.year,
        month: p.month,
        budget_amount: 0,
        actual_amount: 0,
        variance: 0,
        variance_pct: 0
      };
    }
    for (const mb of mappedBudgets) {
      const key = `${mb.period_year}-${mb.period_month}`;
      if (trendMap[key]) {
        trendMap[key].budget_amount += mb.budget_amount;
        trendMap[key].actual_amount += mb.actual_amount;
      }
    }
    trend = Object.values(trendMap).sort((a, b) => a.year - b.year || a.month - b.month);

  } else if (mode === "all_periods") {
    // Every month in the fiscal year (Jan-Dec) of activeYear, even if budget = 0
    for (let m = 1; m <= 12; m++) {
      const label = monthLabel(m, activeYear);
      const budgetsForMonth = mappedBudgets.filter(
        (mb) => mb.period_year === activeYear && mb.period_month === m
      );
      const budgetAmt = budgetsForMonth.reduce((sum, mb) => sum + mb.budget_amount, 0);

      let actualAmt = 0;
      for (const accId of budgetedAccountIds) {
        actualAmt += actualsMap[`${accId}-${activeYear}-${m}`] || 0;
      }
      for (const secId of budgetedSectorIds) {
        actualAmt += sectorActualsMap[`${secId}-${activeYear}-${m}`] || 0;
      }

      trend.push({
        period: label,
        year: activeYear,
        month: m,
        budget_amount: budgetAmt,
        actual_amount: actualAmt,
        variance: 0,
        variance_pct: 0
      });
    }

  } else if (mode === "quarter") {
    // Grouped by quarter chronologically
    const trendMap = {};
    for (const p of availablePeriods) {
      const quarter = Math.ceil(p.month / 3);
      const key = `${p.year}-Q${quarter}`;
      if (!trendMap[key]) {
        trendMap[key] = {
          period: `Q${quarter} ${p.year}`,
          year: p.year,
          quarter,
          budget_amount: 0,
          actual_amount: 0,
          variance: 0,
          variance_pct: 0
        };
      }
    }
    for (const mb of mappedBudgets) {
      const quarter = Math.ceil(mb.period_month / 3);
      const key = `${mb.period_year}-Q${quarter}`;
      if (trendMap[key]) {
        trendMap[key].budget_amount += mb.budget_amount;
        trendMap[key].actual_amount += mb.actual_amount;
      }
    }
    trend = Object.values(trendMap).sort((a, b) => a.year - b.year || a.quarter - b.quarter);

  } else if (mode === "year") {
    // Grouped by year chronologically
    const trendMap = {};
    for (const p of availablePeriods) {
      const key = `${p.year}`;
      if (!trendMap[key]) {
        trendMap[key] = {
          period: `${p.year}`,
          year: p.year,
          budget_amount: 0,
          actual_amount: 0,
          variance: 0,
          variance_pct: 0
        };
      }
    }
    for (const mb of mappedBudgets) {
      const key = `${mb.period_year}`;
      if (trendMap[key]) {
        trendMap[key].budget_amount += mb.budget_amount;
        trendMap[key].actual_amount += mb.actual_amount;
      }
    }
    trend = Object.values(trendMap).sort((a, b) => a.year - b.year);
  }

  // Calculate variance and variance % for trend items
  for (const t of trend) {
    t.variance = parseFloat((t.actual_amount - t.budget_amount).toFixed(2));
    t.variance_pct = growthPercent(t.budget_amount, t.actual_amount);
    t.budget_amount = parseFloat(t.budget_amount.toFixed(2));
    t.actual_amount = parseFloat(t.actual_amount.toFixed(2));
  }

  // Account/sector level breakdown for the selected single month
  const detailItems = mappedBudgets.filter(
    (b) => b.period_year === activeYear && b.period_month === activeMonth
  );

  // Summary totals for current view
  let totalBudget = 0;
  let totalActual = 0;

  if (mode === "month") {
    for (const b of detailItems) {
      totalBudget += b.budget_amount;
      totalActual += b.actual_amount;
    }
  } else {
    for (const t of trend) {
      totalBudget += t.budget_amount;
      totalActual += t.actual_amount;
    }
  }

  const totalVariance = parseFloat((totalActual - totalBudget).toFixed(2));
  const totalVariancePct = growthPercent(totalBudget, totalActual);

  return {
    mode,
    availablePeriods,
    latestPeriod: {
      year: latestPeriod.year,
      month: latestPeriod.month,
      label: latestPeriod.label
    },
    trend,
    detailItems,
    summary: {
      total_budget: parseFloat(totalBudget.toFixed(2)),
      total_actual: parseFloat(totalActual.toFixed(2)),
      total_variance: totalVariance,
      total_variance_pct: totalVariancePct
    }
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
