import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Activity, PieChart as PieChartIcon, Wallet,
  ArrowUpRight, ArrowDownRight, Plus, FileText, Target, BookOpen
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Area, Cell, PieChart as FinancialPieChart, Pie
} from 'recharts';

// Corrected Path Imports
import Sidebar from './dashboard/Sidebar';
import Header from './dashboard/Header';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const PALETTE = [
  "#3b82f6","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#06b6d4","#14b8a6","#f43f5e",
];

// Page Imports
import AccountsPage from './accounts/AccountsPage.jsx';
import JournalEntryPage from './journal/JournalEntryPage.jsx';
import LedgerPage from './ledger/LedgerPage.jsx';
import ReportsPage from './reports/ReportsPage.jsx';
import AnalyticsDashboard from './AnalyticsDashboard.jsx';

// ERP Page Imports
import InventoryPage from './inventory/InventoryPage.jsx';
import WarehousePage from './inventory/WarehousePage.jsx';
import DistributionPage from './distribution/DistributionPage.jsx';

// ERP Dashboard Widgets
import { LowStockWidget, StockValueWidget, SectorRevenueWidget, TopClientsWidget } from '../components/erp/ERPDashboardWidgets.jsx';

// Animation Constants
const stagger = {
  animate: { transition: { staggerChildren: 0.08 } }
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } },
};

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const chartGrid = { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false };
const axisTick = { fontSize: 11, fill: '#64748b', fontWeight: 600 };

// Internal Tooltip Component
function CustomTooltip({ active, payload, label }) {
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
          <span className="font-mono font-extrabold text-slate-800 text-[11px]">${Number(p.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── DASHBOARD OVERVIEW COMPONENT ───
function DashboardOverview() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  const [metrics, setMetrics] = useState(null);
  const [journals, setJournals] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [ratios, journalRes, forecast] = await Promise.all([
        api.get(`/analytics/ratios/${activeCompany.id}`),
        api.get('/journal'),
        api.get(`/analytics/forecast/${activeCompany.id}`),
      ]);
      setMetrics(ratios.data.metrics);
      setJournals(journalRes.data.slice(0, 8));
      const hist = forecast.data.historical || [];
      const pm = parseFloat(ratios.data.metrics?.profitMargin || 0) / 100;
      setChartData(hist.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        expenses: parseFloat(r.revenue) * (1 - pm),
        cashFlow: parseFloat(r.revenue) * pm,
      })));
    } catch (err) {
      console.error("Dashboard data load error", err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    // Defer to avoid cascading synchronous state updates during render
    Promise.resolve().then(() => load());
  }, [load]);

  const fmt = v => '$' + parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const totalRev = parseFloat(metrics?.revenue || 0);
  const netProfit = parseFloat(metrics?.netIncome || 0);
  const totalExp = totalRev - netProfit;
  const cashBal = parseFloat(metrics?.currentAssets || 0);

  const kpis = [
    {
      label: 'Total Revenue', value: fmt(totalRev), icon: TrendingUp,
      sub: 'Live tracking', positive: true, accent: 'border-emerald-500/20', iconBg: '#d1fae5', iconColor: '#059669',
    },
    {
      label: 'Total Expenses', value: fmt(totalExp), icon: Activity,
      sub: 'Aggregated ledger costs', positive: null, accent: 'border-blue-500/20', iconBg: '#dbeafe', iconColor: '#2563eb',
    },
    {
      label: 'Net Profit', value: fmt(netProfit), icon: PieChartIcon,
      sub: `Margin: ${metrics?.profitMargin || '0'}%`, positive: netProfit >= 0, accent: netProfit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20',
      iconBg: netProfit >= 0 ? '#d1fae5' : '#fee2e2', iconColor: netProfit >= 0 ? '#059669' : '#dc2626',
    },
    {
      label: 'Cash Balance', value: fmt(cashBal), icon: Wallet,
      sub: 'Est. Current Assets', positive: true, accent: 'border-amber-500/20', iconBg: '#fef3c7', iconColor: '#d97706',
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-16">
      {/* KPI Cards */}
      <Motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((kpi, i) => (
          <Motion.div
            key={i} variants={fadeUp}
            whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
            className={`bg-white rounded-3xl border ${kpi.accent} p-6 shadow-sm transition-all cursor-default relative overflow-hidden`}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: kpi.iconBg }}>
                <kpi.icon size={16} style={{ color: kpi.iconColor }} />
              </div>
            </div>
            <p className="font-display text-[24px] font-black text-slate-900 mb-3 leading-tight">
              {isLoading ? "..." : kpi.value}
            </p>
            <div className={`flex items-center gap-1.5 text-[12px] font-bold ${
              kpi.positive === true ? 'text-emerald-600' :
              kpi.positive === false ? 'text-rose-500' : 'text-slate-500'
            }`}>
              {kpi.positive === true && <ArrowUpRight size={13} />}
              {kpi.positive === false && <ArrowDownRight size={13} />}
              {kpi.sub}
            </div>
          </Motion.div>
        ))}
      </Motion.div>

      {/* Charts + Quick actions + Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Charts col */}
        <div className="xl:col-span-2 space-y-5">
          {/* Revenue vs Expenses */}
          <Motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-black text-slate-900 text-[16px]">Financial Breakdown</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Period Overview</p>
            </div>
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              {(() => {
                const totalRev = chartData.reduce((acc, curr) => acc + (curr.revenue || 0), 0);
                const totalExp = chartData.reduce((acc, curr) => acc + (curr.expenses || 0), 0);
                const profit = totalRev - totalExp;
                const pieData = [
                  { name: 'Net Profit', value: Math.max(0, profit), color: '#10b981' },
                  { name: 'Expenses', value: totalExp, color: '#f43f5e' }
                ];
                return (
                  <FinancialPieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="45%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      animationBegin={0}
                      animationDuration={750}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" align="center" layout="horizontal" iconType="circle"
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px', color: '#64748b' }} />
                    <text x="50%" y="41%" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="800" fill="#0f172a">
                      ${Math.max(0, profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </text>
                    <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="#94a3b8" letterSpacing="0.05em" textTransform="uppercase">
                      Net Profit
                    </text>
                  </FinancialPieChart>
                );
              })()}
            </ResponsiveContainer>
          </Motion.div>

          {/* Cash Flow */}
          <Motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <h3 className="font-display font-black text-slate-900 text-[16px] mb-6">Operating Cash Flow</h3>
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <BarChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="barFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#118DFF" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#12239E" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={axisTick} width={55} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                <Bar dataKey="cashFlow" name="Cash Flow" radius={[4, 4, 0, 0]} barSize={20} fill="url(#barFlow)">
                  {chartData.map((entry, i) => (
                    <Cell key={i} style={{ transition: 'opacity 0.2s', outline: 'none' }} className="hover:opacity-85" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Motion.div>

          {/* ERP Expansion Widgets - Left Column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <StockValueWidget />
            <LowStockWidget />
          </div>
          
          <SectorRevenueWidget />
        </div>

        {/* Right col */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <Motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-slate-900 rounded-[2.5rem] p-7 shadow-xl shadow-slate-900/20">
            <h3 className="font-black text-white/40 text-[11px] uppercase tracking-widest mb-6 px-1">Quick Actions</h3>
            <div className="space-y-3">
              {[
                { icon: Plus, label: 'Add Journal Entry', to: '/dashboard/journal', color: '#10b981' },
                { icon: FileText, label: 'View Reports', to: '/dashboard/reports', color: '#3b82f6' },
                { icon: Target, label: 'Manage Budgets', to: '/dashboard/analytics?tab=budget', color: '#f59e0b' },
              ].map(item => (
                <button key={item.label} onClick={() => navigate(item.to)}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[14px] font-bold transition-all bg-white/5 text-white/80 border border-white/5 hover:bg-white/10"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}22` }}>
                    <item.icon size={15} style={{ color: item.color }} />
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </Motion.div>

          {/* Recent Transactions */}
          <Motion.div variants={fadeUp} initial="initial" animate="animate" className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-50">
              <h3 className="font-display font-black text-slate-900 text-[15px]">Recent Transactions</h3>
              <button onClick={() => navigate('/dashboard/ledger')}
                className="text-[12px] font-black text-emerald-600 hover:text-emerald-700">View All</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 font-bold">Loading...</div>
              ) : journals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-5">
                  <BookOpen size={32} className="text-slate-200 mb-3" />
                  <p className="text-[13px] text-slate-400 font-bold">No transactions detected</p>
                </div>
              ) : (
                journals.map((j) => (
                  <div key={j.id} className="flex items-center gap-4 px-7 py-4.5 hover:bg-slate-50/50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-slate-50 text-slate-400">
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-slate-800 truncate">{j.description}</p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {new Date(j.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <p className="font-mono font-black text-[13px] text-slate-900 flex-shrink-0">
                      ${parseFloat(j.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Motion.div>

          {/* ERP Expansion Widgets - Right Column */}
          <TopClientsWidget />
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD SHELL COMPONENT ───
export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const sidebarWidth = collapsed ? 68 : 248;

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header 
        sidebarCollapsed={collapsed} 
        onMenuToggle={() => setCollapsed(!collapsed)} 
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
      />

      <Motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 min-h-screen relative"
        style={{ paddingTop: 60, minWidth: 0 }}
      >
      <AnimatePresence mode="wait">
        <Motion.div
          key="route-content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
            <Routes>
              <Route index element={<DashboardOverview />} />
              <Route path="accounts" element={<AccountsPage globalSearch={globalSearch} />} />
              <Route path="journal" element={<JournalEntryPage />} />
              <Route path="ledger" element={<LedgerPage globalSearch={globalSearch} />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
              
              {/* ERP Expansion Modules */}
              <Route path="inventory" element={<InventoryPage globalSearch={globalSearch} />} />
              <Route path="warehouses" element={<WarehousePage globalSearch={globalSearch} />} />
              <Route path="distribution" element={<DistributionPage globalSearch={globalSearch} />} />
            </Routes>
          </Motion.div>
        </AnimatePresence>
      </Motion.main>
    </div>
  );
}