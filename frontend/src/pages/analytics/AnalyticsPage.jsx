import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Activity, Target, TrendingUp, AlertCircle, CheckCircle2, BarChart2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const TABS = [
  { id: 'ratios', label: 'Financial Ratios', icon: Activity },
  { id: 'budget', label: 'Budget vs Actual', icon: Target },
  { id: 'forecast', label: 'AI Forecasting', icon: TrendingUp },
];

const fmt = v => '$' + parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100/80 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xl shadow-slate-900/5 min-w-[150px]">
      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.payload?.fill }} />
            <span className="text-[11px] font-bold text-slate-500">{p.name}</span>
          </div>
          <span className="font-mono font-extrabold text-slate-800 text-[11px]">${parseFloat(p.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { activeCompany } = useAuthStore();
  const [tab, setTab] = useState('ratios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ratios, setRatios] = useState(null);
  const [budgets, setBudgets] = useState({ data: [], period: new Date().toISOString().substring(0, 7) });
  const [forecast, setForecast] = useState(null);
  const [budgetTarget, setBudgetTarget] = useState({ accountId: '', amount: '' });

  const loadAll = useCallback(async () => {
    if (!activeCompany) return;

    // Defer state updates to avoid synchronous setState in effect warnings
    await Promise.resolve();

    setLoading(true); setError('');
    try {
      const [bRes, fRes] = await Promise.all([
        api.get(`/analytics/budgets/${activeCompany.id}?period=${budgets.period}`),
        api.get(`/analytics/forecast/${activeCompany.id}`),
      ]);
      setBudgets(prev => ({ ...prev, data: bRes.data.data || [] }));
      setForecast(fRes.data);
    } catch (err) {
      console.error("[Analytics] loadAll failed:", err);
    }
    setLoading(false);
  }, [activeCompany, budgets.period]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) loadAll();
    });
    return () => { ignore = true; };
  }, [loadAll]);

  useEffect(() => {
    if (!activeCompany) return;
    api.get(`/analytics/ratios/${activeCompany.id}?period=${budgets.period}`)
      .then(r => setRatios(r.data.metrics))
      .catch(err => console.error("[Analytics] ratios load failed:", err));
  }, [activeCompany, budgets.period]);

  const saveBudget = async (accountId, amount) => {
    const amt = parseFloat(amount);
    if (isNaN(amt)) return;
    try {
      await api.post('/analytics/budgets', { company_id: activeCompany.id, account_id: accountId, period: budgets.period, amount: amt });
      const res = await api.get(`/analytics/budgets/${activeCompany.id}?period=${budgets.period}`);
      setBudgets(prev => ({ ...prev, data: res.data.data || [] }));
      setBudgetTarget({ accountId: '', amount: '' });
    } catch (err) {
      console.error("[Analytics] saveBudget failed:", err);
    }
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <BarChart2 size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Financial Intelligence</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">AI Forecasting</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              Advanced analytics, budgeting & predictive forecasting.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 md:mt-0 flex-wrap sm:ml-auto">
          <div className="tab-bar bg-white border border-slate-100 rounded-xl p-1 flex">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`tab-item px-3 py-1.5 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all ${tab === t.id ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-amber-50 border border-amber-100 mb-5">
            <AlertCircle size={15} className="text-amber-500" />
            <p className="text-[13px] text-amber-700 font-medium">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            {tab === 'ratios' && <RatiosDashboard ratios={ratios} loading={loading} />}
            {tab === 'budget' && <BudgetVariance budgets={budgets} setBudgets={setBudgets} budgetTarget={budgetTarget} setBudgetTarget={setBudgetTarget} saveBudget={saveBudget} activeCompany={activeCompany} loading={loading} />}
            {tab === 'forecast' && <AIForecast forecast={forecast} loading={loading} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Ratios Dashboard ─── */
function RatiosDashboard({ ratios, loading }) {
  if (loading || !ratios) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
    </div>
  );

  const getColor = (v, thresholds) => {
    const n = parseFloat(v);
    if (n >= thresholds.green) return { text: '#059669', bg: '#f0fdf4', border: '#bbf7d0' };
    if (n <= thresholds.red) return { text: '#dc2626', bg: '#fff1f2', border: '#fecaca' };
    return { text: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  };

  const kpis = [
    { title: 'Current Ratio', val: ratios.currentRatio, desc: 'Current Assets / Current Liabilities', thresholds: { green: 1.5, red: 1.0 } },
    { title: 'Quick Ratio', val: ratios.quickRatio, desc: '(Current Assets − Inv) / Liabilities', thresholds: { green: 1.0, red: 0.8 } },
    { title: 'Net Profit Margin', val: ratios.profitMargin + '%', desc: '(Net Income / Revenue) × 100', thresholds: { green: 10, red: 0 } },
    { title: 'ROE', val: ratios.roe + '%', desc: '(Net Income / Equity) × 100', thresholds: { green: 15, red: 0 } },
    { title: 'Asset Turnover', val: ratios.assetTurnover, desc: 'Revenue / Total Assets', thresholds: { green: 0.5, red: 0.1 } },
  ];

  return (
    <div>
      <h2 className="font-display font-extrabold text-[16px] text-slate-900 mb-5">Master Key Performance Indicators</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi, i) => {
          const c = getColor(parseFloat(kpi.val), kpi.thresholds);
          return (
            <motion.div key={i} variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }}
              initial="initial" animate="animate" transition={{ delay: i * 0.07 }}
              whileHover={{ y: -3 }}
              className="ratio-card p-5" style={{ background: c.bg, borderColor: c.border }}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest mb-2" style={{ color: c.text, opacity: 0.7 }}>{kpi.title}</p>
              <p className="ratio-value mb-3" style={{ color: c.text }}>{kpi.val}</p>
              <div className="h-px mb-3" style={{ background: c.border }} />
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.text, opacity: 0.5 }}>{kpi.desc}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Matrix cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6">
          <h3 className="font-display font-bold text-[13px] uppercase tracking-widest text-slate-600 mb-4 pb-3 border-b border-slate-100">Liquidity Matrix</h3>
          {[
            ['Current Assets', fmt(ratios.currentAssets)],
            ['Inventory', fmt(ratios.inventory)],
            ['Current Liabilities', fmt(ratios.currentLiabilities)],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
              <span className="text-[13px] text-slate-600">{l}</span>
              <span className="font-mono font-semibold text-[14px] text-slate-900">{v}</span>
            </div>
          ))}
        </div>
        <div className="card p-6">
          <h3 className="font-display font-bold text-[13px] uppercase tracking-widest text-slate-600 mb-4 pb-3 border-b border-slate-100">Profitability Matrix</h3>
          {[
            { label: 'Total Revenue', value: fmt(ratios.revenue), color: '#059669', bg: '#f0fdf4' },
            { label: 'Total Equity', value: fmt(ratios.equity), color: '#2563eb', bg: '#eff6ff' },
            { label: 'Net Income', value: fmt(ratios.netIncome), dark: true },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center py-2.5 px-3 rounded-xl mb-2 last:mb-0"
              style={{ background: s.dark ? 'var(--blue-900)' : s.bg, border: s.dark ? 'none' : `1px solid ${s.color}22` }}>
              <span className={`text-[13px] font-semibold ${s.dark ? 'text-white/80' : ''}`} style={{ color: s.dark ? undefined : s.color }}>{s.label}</span>
              <span className={`font-mono font-extrabold text-[14px] ${s.dark ? 'text-emerald-400' : ''}`} style={{ color: s.dark ? undefined : s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Budget vs Actual ─── */
function BudgetVariance({ budgets, setBudgets, budgetTarget, setBudgetTarget, saveBudget, activeCompany, loading }) {
  const rows = (budgets.data || []).map(r => {
    const act = parseFloat(r.actual_amount), bud = parseFloat(r.budgeted_amount);
    const variance = bud === 0 ? (act > 0 ? 100 : 0) : ((act - bud) / Math.abs(bud)) * 100;
    const isGood = r.type === 'Expense' ? act <= bud : act >= bud;
    return { ...r, act, bud, variance, isGood };
  });

  return (
    <div>
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          <div>
            <h2 className="font-display font-bold text-[15px] text-slate-900">Budget vs. Actual Variance</h2>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">Manage operational thresholds</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Period</span>
            <input type="month" value={budgets.period}
              onChange={async e => {
                const p = e.target.value;
                setBudgets(prev => ({ ...prev, period: p }));
                if (activeCompany) {
                  const r = await api.get(`/analytics/budgets/${activeCompany.id}?period=${p}`);
                  setBudgets({ data: r.data.data || [], period: p });
                }
              }}
              className="input-enterprise py-2 px-3 text-[13px]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 680 }}>
            <thead>
              <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Account Name</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right">Budget Limit</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right" style={{ background: '#f8fafc' }}>Actual Tracked</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right">Variance %</th>
                <th style={{ width: 48 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE8]">
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="skeleton h-4 w-full my-1" /></td></tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-[13px] text-slate-400">No budget accounts found for this period.</td></tr>
              ) : rows.map(r => (
                <motion.tr key={r.account_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{r.code}</span>
                      <span className="font-medium text-[13.5px]">{r.account_name}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3">
                    {budgetTarget.accountId === r.account_id ? (
                      <input autoFocus type="number"
                        className="input-enterprise text-right text-[13px] font-mono py-1.5 w-32 ml-auto"
                        value={budgetTarget.amount}
                        onChange={e => setBudgetTarget({ ...budgetTarget, amount: e.target.value })}
                        onBlur={() => saveBudget(r.account_id, budgetTarget.amount)}
                        onKeyDown={e => e.key === 'Enter' && saveBudget(r.account_id, budgetTarget.amount)} />
                    ) : (
                      <span
                        className="font-mono text-[13px] font-semibold text-slate-700 cursor-pointer hover:text-emerald-600 hover:underline decoration-emerald-500 underline-offset-2"
                        onClick={() => setBudgetTarget({ accountId: r.account_id, amount: r.bud.toString() })}
                        title="Click to set budget">
                        ${r.bud.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </td>
                  <td className="text-right px-4 py-3" style={{ background: 'rgba(248,250,252,0.5)' }}>
                    <span className="font-mono font-semibold text-[13px] text-slate-900">
                      ${r.act.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3">
                    <span className={`badge ${r.isGood ? 'var-good' : 'var-bad'} ${r.variance === 0 ? 'var-neutral' : ''}`}>
                      {r.variance > 0 ? '+' : ''}{r.variance.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    {r.isGood
                      ? <CheckCircle2 size={15} className="text-emerald-500 mx-auto" />
                      : <AlertCircle size={15} className="text-red-500 mx-auto" />}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── AI Forecasting ─── */
function AIForecast({ forecast, loading }) {
  if (loading || !forecast) return (
    <div className="space-y-4">
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );

  const { historical = [], forecast: predicted = [] } = forecast;
  const chartData = [
    ...historical.map(h => ({ month: h.month, actualRevenue: parseFloat(h.revenue) })),
    ...predicted.map(p => ({ month: p.month, forecastRevenue: parseFloat(p.forecast_revenue) })),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* AI engine card */}
        <div className="rounded-2xl p-7 relative overflow-hidden" style={{ background: 'var(--blue-800)' }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', filter: 'blur(40px)', transform: 'translate(30%, -30%)' }} />
          <BarChart2 size={28} className="text-violet-400 mb-4" />
          <h3 className="font-display font-extrabold text-[20px] text-white mb-3">AI Linear Regression Engine</h3>
          <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            SARFIS algorithmically digests historical operating revenue to map trajectory using statistical linear regression, predicting absolute operational cash potential for the upcoming 6 fiscal months.
          </p>
        </div>
        {/* Regression vector table */}
        <div className="card p-5">
          <h4 className="font-bold text-[11px] uppercase tracking-widest text-slate-400 mb-3">Regression Vector Table</h4>
          <div className="overflow-auto max-h-44 rounded-xl border border-slate-100">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Month</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right">Predicted Line</th>
                </tr>
              </thead>
              <tbody>
                {predicted.map(p => (
                  <tr key={p.month} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{p.month}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-violet-600">
                      ${parseFloat(p.forecast_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h4 className="font-display font-bold text-[13px] uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-3 mb-5">Historical vs Forecast Timeline</h4>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={50} />
            <Tooltip content={<ChartTooltip />} />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingBottom: 16 }} />
            <Line type="monotone" dataKey="actualRevenue" name="Historical Actuals" stroke="#12239E" strokeWidth={3.5} dot={{ r: 4, fill: '#12239E', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 6, fill: '#12239E', stroke: '#fff', strokeWidth: 2 }} connectNulls />
            <Line type="monotone" dataKey="forecastRevenue" name="AI Target Projection" stroke="#E66C37" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 4, fill: '#E66C37', stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 6, fill: '#E66C37', stroke: '#fff', strokeWidth: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
