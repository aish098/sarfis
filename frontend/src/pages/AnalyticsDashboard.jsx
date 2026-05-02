/**
 * AnalyticsDashboard.jsx
 * SARFIS — Trend Analysis & Budget Planning Dashboard
 * Place in: src/pages/AnalyticsDashboard.jsx
 * 
 * Dependencies (add to package.json):
 *   npm install recharts
 */

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import { analyticsApi } from "../services/analyticsApi";
import useAuthStore from "../store/authStore";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#2563eb", "#f59e0b", "#f43f5e", "#14b8a6"];

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

const chartGrid = { stroke: "#f1f5f9", strokeDasharray: "3 3", vertical: false };
const axisTick = { fill: "#64748b", fontSize: 11, fontWeight: 600 };

function PowerTooltip({ active, payload, label, currency = "PKR" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border-none bg-white/95 backdrop-blur px-4 py-3 shadow-xl shadow-slate-900/10 min-w-[140px]">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            <span className="text-[12px] font-semibold text-slate-600">{p.name}</span>
          </div>
          <span className="font-mono font-bold text-slate-800 text-[12px]">
            {currency} {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function badge(val) {
  if (val > 0) return <span className="badge var-good">▲ {val}%</span>;
  if (val < 0) return <span className="badge var-bad">▼ {Math.abs(val)}%</span>;
  return <span className="badge var-neutral">—</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`card p-5 rounded-2xl ${className}`}>
      {title && <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>}
      {children}
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "trends", label: "📈 Trends" },
  { id: "comparative", label: "📊 Comparative" },
  { id: "vertical", label: "🔢 Vertical" },
  { id: "sectors", label: "🏭 Sectors" },
  { id: "operations", label: "📦 Operations" },
  { id: "budget", label: "🎯 Budget" },
  { id: "variance", label: "📉 Variance" },
];

// ─── TREND TAB ────────────────────────────────────────────────────────────────
function TrendTab({ companyId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(12);



  useEffect(() => {
    let ignore = false;

    // Set loading state in a microtask to avoid "cascading renders" warning
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getTrends(companyId, months)
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId, months]);

  if (loading && !data.length) return <Spinner />;

  const latest = data[data.length - 1] || {};

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Revenue", val: latest.revenue, growth: latest.revenue_growth, color: "text-emerald-600" },
          { label: "Expenses", val: latest.expenses, growth: latest.expense_growth, color: "text-rose-500" },
          { label: "Net Profit", val: latest.profit, growth: latest.profit_growth, color: "text-indigo-600" },
        ].map((k) => (
          <Card key={k.label}>
            <p className="text-xs text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold font-mono ${k.color}`}>PKR {fmt(k.val)}</p>
            <div className="mt-1">{badge(k.growth)}</div>
          </Card>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {[3, 6, 12].map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
              months === m
                ? "bg-emerald-600 text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {m}M
          </button>
        ))}
      </div>

      <Card title="Revenue · Expenses · Profit">
        <ResponsiveContainer width="100%" height={280} minWidth={0}>
          <LineChart data={data}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={axisTick} tickFormatter={fmt} axisLine={false} tickLine={false} />
            <Tooltip content={<PowerTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px', fontWeight: 'bold' }} />
            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} name="Revenue" />
            <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} name="Expenses" />
            <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} name="Profit" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Monthly Profit Bar">
        <ResponsiveContainer width="100%" height={200} minWidth={0}>
          <BarChart data={data}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={axisTick} tickFormatter={fmt} axisLine={false} tickLine={false} />
            <Tooltip content={<PowerTooltip />} cursor={{ fill: '#f8fafc', radius: 12 }} />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]} name="Profit" barSize={25}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── COMPARATIVE TAB ──────────────────────────────────────────────────────────
function ComparativeTab({ companyId }) {
  const now = new Date();
  const [p1, setP1] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [p2, setP2] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getComparative(companyId, p1, p2)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId, p1, p2]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getComparative(companyId, p1, p2)
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId, p1, p2]);

  return (
    <div className="space-y-5">
      {/* Period Pickers */}
      <div className="grid grid-cols-2 gap-4">
        {[["Period 1", p1, setP1], ["Period 2", p2, setP2]].map(([label, val, setter]) => (
          <Card key={label} title={label}>
            <div className="flex gap-2">
              <select
                value={val.month}
                onChange={(e) => setter((v) => ({ ...v, month: +e.target.value }))}
                className="input-enterprise text-sm"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input
                type="number"
                value={val.year}
                onChange={(e) => setter((v) => ({ ...v, year: +e.target.value }))}
                className="input-enterprise w-24 text-sm"
              />
            </div>
          </Card>
        ))}
      </div>
      <button
        onClick={load}
        className="btn btn-primary btn-sm px-4"
      >
        Compare →
      </button>

      {loading && <Spinner />}

      {!loading && data && Object.entries(data).map(([type, rows]) => (
        <Card key={type} title={type}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">Period 1</th>
                  <th className="text-right">Period 2</th>
                  <th className="text-right">Variance</th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.account_id} className="hover:bg-slate-50 transition-colors">
                    <td className="text-slate-700">{r.account_name}</td>
                    <td className="text-right font-mono text-slate-500">{fmt(r.period1.net)}</td>
                    <td className="text-right font-mono text-slate-700">{fmt(r.period2.net)}</td>
                    <td className={`py-2 text-right font-mono ${r.variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(r.variance)}</td>
                    <td className="py-2 text-right">{badge(r.variance_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── VERTICAL ANALYSIS TAB ────────────────────────────────────────────────────
function VerticalTab({ companyId }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getVertical(companyId, month, year)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, month, year]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getVertical(companyId, month, year)
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId, month, year]);

  const renderSection = (title, items, total) => (
    <Card title={title}>
      <div className="mb-3 text-xs text-slate-500">Total: <span className="text-slate-900 font-mono">{fmt(total)}</span></div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.account_id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-700">{item.account_name}</span>
              <span className="text-slate-500 font-mono">{fmt(item.amount)} <span className="text-slate-400">({item.percentage}%)</span></span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(item.percentage, 100)}%`,
                  backgroundColor: item.account_type?.toLowerCase().includes("expense") ? "#f43f5e" : "#6366f1",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
            className="input-enterprise text-sm"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="input-enterprise w-24 text-sm"
          />
        </div>
        <button onClick={load} className="btn btn-primary btn-sm px-4">
          Analyze
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {renderSection(
            "Income Statement (% of Revenue)",
            data.income_statement?.items || [],
            data.income_statement?.total_revenue
          )}
          {renderSection(
            "Balance Sheet (% of Total Assets)",
            data.balance_sheet?.items || [],
            data.balance_sheet?.total_assets
          )}
        </div>
      )}
    </div>
  );
}

// ─── SECTOR GROWTH TAB ────────────────────────────────────────────────────────
function SectorTab({ companyId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);



  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getSectorGrowth(companyId, 6)
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId]);

  if (loading && !data.length) return <Spinner />;

  return (
    <div className="space-y-5">
      {!loading && data.length === 0 && (
        <Card title="Sector Revenue Comparison">
          <p className="text-sm text-slate-500">
            No sector records were found. Add delivered sector transactions, or use ledger activity so fallback sector analytics can populate.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((sector) => (
          <Card key={sector.sector}>
            <div className="flex justify-between items-start mb-3">
              <p className="font-semibold text-slate-900">{sector.sector}</p>
              {badge(sector.overall_growth_pct)}
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={sector.periods}>
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                <Tooltip content={<PowerTooltip />} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-2">
              Latest: <span className="text-slate-900 font-mono">{fmt(sector.periods[sector.periods.length - 1]?.revenue)}</span>
            </p>
          </Card>
        ))}
      </div>

      {data.length > 0 && (
        <Card title="Sector Revenue Comparison">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.map((s) => ({
              name: s.sector,
              revenue: s.periods.reduce((a, p) => a + p.revenue, 0),
              growth: s.overall_growth_pct,
            }))}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={axisTick} tickFormatter={fmt} axisLine={false} tickLine={false} />
              <Tooltip content={<PowerTooltip />} cursor={{ fill: '#f8fafc', radius: 12 }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} name="Total Revenue" barSize={25}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─── BUDGET TAB ───────────────────────────────────────────────────────────────
function BudgetTab({ companyId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    budget_type: "account",
    account_id: "",
    sector_id: "",
    period_month: now.getMonth() + 1,
    period_year: now.getFullYear(),
    budget_amount: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getBudgets(companyId, year, month)
      .then(setBudgets).catch(console.error).finally(() => setLoading(false));
  }, [companyId, year, month]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getBudgets(companyId, year, month)
      .then((res) => {
        if (!ignore) setBudgets(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId, year, month]);

  const save = async () => {
    if (!form.budget_amount) return;
    setSaving(true);
    try {
      await analyticsApi.createBudget(companyId, form);
      load();
      setForm((f) => ({ ...f, budget_amount: "", notes: "" }));
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete budget?")) return;
    await analyticsApi.deleteBudget(companyId, id);
    load();
  };

  return (
    <div className="space-y-5">
      {/* Add Budget Form */}
      <Card title="Add / Update Budget">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Type</label>
            <select
              value={form.budget_type}
              onChange={(e) => setForm((f) => ({ ...f, budget_type: e.target.value }))}
              className="input-enterprise text-sm"
            >
              <option value="account">Account</option>
              <option value="sector">Sector</option>
            </select>
          </div>
          {form.budget_type === "account" ? (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Account ID</label>
              <input
                value={form.account_id}
                onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                placeholder="e.g. 42"
                className="input-enterprise text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sector</label>
              <input
                value={form.sector_id}
                onChange={(e) => setForm((f) => ({ ...f, sector_id: e.target.value }))}
                placeholder="e.g. Textile"
                className="input-enterprise text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Month</label>
            <select
              value={form.period_month}
              onChange={(e) => setForm((f) => ({ ...f, period_month: +e.target.value }))}
              className="input-enterprise text-sm"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Year</label>
            <input
              type="number"
              value={form.period_year}
              onChange={(e) => setForm((f) => ({ ...f, period_year: +e.target.value }))}
              className="input-enterprise text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Budget Amount (PKR)</label>
            <input
              type="number"
              value={form.budget_amount}
              onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value }))}
              placeholder="0"
              className="input-enterprise text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
              className="input-enterprise text-sm"
            />
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 btn btn-primary btn-sm px-5 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Budget"}
        </button>
      </Card>

      {/* Filter */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Filter Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
            className="input-enterprise text-sm"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="input-enterprise w-24 text-sm"
          />
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm px-4">
          Filter
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && (
        <Card title={`Budgets — ${MONTHS[month - 1]} ${year}`}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account / Sector</th>
                  <th>Type</th>
                  <th className="text-right">Budget</th>
                  <th className="text-right">Period</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {budgets.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-600">No budgets for this period</td></tr>
                )}
                {budgets.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="text-slate-700">
                      {b.account_name || (b.account_id ? `Account #${b.account_id}` : b.sector_id) || "—"}
                    </td>
                    <td className="text-slate-500">{b.budget_type}</td>
                    <td className="text-right font-mono text-slate-900">PKR {fmt(b.budget_amount)}</td>
                    <td className="text-right text-slate-500">{MONTHS[b.period_month - 1]} {b.period_year}</td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => remove(b.id)}
                        className="text-xs text-rose-500 hover:text-rose-600 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── VARIANCE TAB ─────────────────────────────────────────────────────────────
function VarianceTab({ companyId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getBudgetVsActual(companyId, year, month)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, year, month]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getBudgetVsActual(companyId, year, month)
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId, year, month]);

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
            className="input-enterprise text-sm"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Year</label>
          <input type="number" value={year} onChange={(e) => setYear(+e.target.value)}
            className="input-enterprise w-24 text-sm" />
        </div>
        <button onClick={load} className="btn btn-primary btn-sm px-4">
          Load
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Budget", val: data.summary?.total_budget, color: "text-indigo-600" },
              { label: "Total Actual", val: data.summary?.total_actual, color: "text-slate-900" },
              { label: "Variance", val: data.summary?.total_variance, color: data.summary?.total_variance >= 0 ? "text-emerald-600" : "text-rose-500" },
            ].map((k) => (
              <Card key={k.label}>
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${k.color}`}>PKR {fmt(k.val)}</p>
                {k.label === "Variance" && <div className="mt-1">{badge(data.summary?.total_variance_pct)}</div>}
              </Card>
            ))}
          </div>

          {/* Redesigned Variance Chart as a Premium Doughnut */}
          {data.items?.length > 0 && (
            <Card title="Expenditure Breakdown & Budget Utilization">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={data.items}
                        dataKey="actual_amount"
                        nameKey="account_name"
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        stroke="none"
                      >
                        {data.items.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white p-4 shadow-xl rounded-2xl border border-slate-100 min-w-[180px]">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{d.account_name}</p>
                              <div className="flex justify-between items-end gap-4">
                                <div>
                                  <p className="text-[14px] font-extrabold text-slate-800">PKR {fmt(d.actual_amount)}</p>
                                  <p className="text-[10px] text-slate-500">Budget: {fmt(d.budget_amount)}</p>
                                </div>
                                <div className="text-right">
                                  {badge(d.variance_pct)}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Central Label */}
                  <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Actual</p>
                    <p className="text-[20px] font-extrabold text-emerald-600 font-mono">
                      {fmt(data.summary?.total_actual)}
                    </p>
                  </div>
                </div>

                {/* Side Legend */}
                <div className="flex-1 w-full space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Account Breakdown</h4>
                  {data.items.map((item, idx) => (
                    <div key={item.account_id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                        <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{item.account_name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-mono font-bold text-slate-800">{fmt(item.actual_amount)}</p>
                        <p className="text-[10px] text-slate-400">{((item.actual_amount / (data.summary?.total_actual || 1)) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Table */}
          <Card title="Variance Detail">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {["Account", "Budget", "Actual", "Variance", "%", "Status"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="text-slate-700">{row.account_name || row.sector_id}</td>
                      <td className="font-mono text-slate-500">{fmt(row.budget_amount)}</td>
                      <td className="font-mono text-slate-900">{fmt(row.actual_amount)}</td>
                      <td className={`py-2 font-mono ${row.variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(row.variance)}</td>
                      <td className="py-2">{badge(row.variance_pct)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.status === "favorable" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function OperationsTab({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
    });

    analyticsApi.getOperationalInsights(companyId)
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId]);

  if (loading && !data) return <Spinner />;

  const summary = data?.summary || {};
  const products = data?.top_products || [];
  const warehouses = data?.warehouse_load || [];
  const sectors = data?.sector_profitability || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="SKU Count"><p className="text-2xl font-black text-slate-900">{summary.total_skus || 0}</p></Card>
        <Card title="Low Stock SKUs"><p className="text-2xl font-black text-rose-500">{summary.low_stock_skus || 0}</p></Card>
        <Card title="Inventory Value"><p className="text-2xl font-black text-emerald-600">PKR {fmt(summary.inventory_value || 0)}</p></Card>
        <Card title="Warehouses"><p className="text-2xl font-black text-indigo-600">{summary.warehouse_count || 0}</p></Card>
        <Card title="Delivered Revenue"><p className="text-2xl font-black text-slate-900">PKR {fmt(summary.delivered_revenue || 0)}</p></Card>
        <Card title="Delivered Orders"><p className="text-2xl font-black text-cyan-600">{summary.delivered_count || 0}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Top Inventory Products (by Value)">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-slate-500">No product inventory data</td></tr>
                ) : products.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50 transition-colors">
                    <td className="text-slate-700">{p.product_name} <span className="text-slate-400 text-xs">({p.sku})</span></td>
                    <td className="text-right font-mono text-slate-700">{p.qty}</td>
                    <td className="text-right font-mono text-slate-900">PKR {fmt(p.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Warehouse Load">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={warehouses}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="warehouse_name" tick={axisTick} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={axisTick} tickFormatter={fmt} axisLine={false} tickLine={false} />
              <Tooltip content={<PowerTooltip />} cursor={{ fill: '#f8fafc', radius: 12 }} />
              <Bar dataKey="estimated_value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Inventory Value" barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Sector Profitability (Distribution)">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th className="text-right">Deliveries</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Gross Profit</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {sectors.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500">No sector distribution data</td></tr>
              ) : sectors.map((s) => (
                <tr key={s.sector_id} className="hover:bg-slate-50 transition-colors">
                  <td className="text-slate-700">{s.sector_name}</td>
                  <td className="text-right font-mono text-slate-700">{s.delivery_count}</td>
                  <td className="text-right font-mono text-slate-900">PKR {fmt(s.total_revenue)}</td>
                  <td className={`text-right font-mono ${s.gross_profit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>PKR {fmt(s.gross_profit)}</td>
                  <td className="text-right">{badge(s.margin_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard({ companyId }) {
  const [activeTab, setActiveTab] = useState("trends");
  const { activeCompany } = useAuthStore();

  // Resolve companyId: prop → auth store → localStorage fallback
  const cid = companyId || activeCompany?.id || localStorage.getItem("activeCompanyId") || "1";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-black tracking-tight">Analytics & Planning</h1>
        <p className="text-sm text-slate-500 mt-1">Trends · Budgets · Variance — sourced from Ledger</p>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-6 overflow-x-auto pb-1 w-fit max-w-full">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item whitespace-nowrap ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "trends" && <TrendTab companyId={cid} />}
        {activeTab === "comparative" && <ComparativeTab companyId={cid} />}
        {activeTab === "vertical" && <VerticalTab companyId={cid} />}
        {activeTab === "sectors" && <SectorTab companyId={cid} />}
        {activeTab === "operations" && <OperationsTab companyId={cid} />}
        {activeTab === "budget" && <BudgetTab companyId={cid} />}
        {activeTab === "variance" && <VarianceTab companyId={cid} />}
      </div>
    </div>
  );
}