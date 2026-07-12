import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Activity, PieChart as PieChartIcon, Wallet,
  Plus, FileText, Target, BookOpen, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts';

import Sidebar from './dashboard/Sidebar';
import Header from './dashboard/Header';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import usePeriodStore, { MONTHS } from '../store/periodStore';
import {
  computeChartLayout, buildChartMargins, AdaptiveChartFrame, DynamicXTick,
  yAxisProps, PBI, pbiGridProps, ChartTooltip,
} from '../components/charts/chartEngine';
import { PowerBIDonut } from '../components/charts/PowerBIDonut';
import { PowerBICard, PowerBIKpi, PowerBIHeader } from '../components/charts/PBIDashboardPrimitives';
import { pbiStagger } from '../components/charts/pbiAnimations';

import AccountsPage from './accounts/AccountsPage.jsx';
import JournalEntryPage from './journal/JournalEntryPage.jsx';
import LedgerPage from './ledger/LedgerPage.jsx';
import ReportsPage from './reports/ReportsPage.jsx';
import AnalyticsDashboard from './AnalyticsDashboard.jsx';
import InventoryPage from './inventory/InventoryPage.jsx';
import WarehousePage from './inventory/WarehousePage.jsx';
import DistributionPage from './distribution/DistributionPage.jsx';
import VouchersPage from './vouchers/VouchersPage.jsx';
import PurchaseOrdersPage from './vouchers/PurchaseOrdersPage.jsx';
import OrderTrackingPage from './distribution/OrderTrackingPage.jsx';
import VendorsPage from './vendors/VendorsPage.jsx';
import SettingsPage from './settings/SettingsPage.jsx';
import AdminPage from './admin/AdminPage.jsx';
import PayrollPage from './payroll/PayrollPage.jsx';
import NotificationCenterPage from './notifications/NotificationCenterPage.jsx';
import EmployeeLeavePage from './notifications/EmployeeLeavePage.jsx';
import EmployeeDocumentsPage from './notifications/EmployeeDocumentsPage.jsx';
import EmployeeMessagesPage from './notifications/EmployeeMessagesPage.jsx';
import RiskDashboard from './analytics/RiskDashboard.jsx';
import EmailCenterPage from './admin/EmailCenterPage.jsx';
import FixedAssetsDashboard from './fixed-assets/FixedAssetsDashboard.jsx';
import AssetRegister from './fixed-assets/AssetRegister.jsx';
import AssetCategories from './fixed-assets/AssetCategories.jsx';
import DepreciationWizard from './fixed-assets/DepreciationWizard.jsx';
import MonthEndCloseWizard from './finance/MonthEndCloseWizard.jsx';
import ApprovalsInboxPage from './admin/ApprovalsInboxPage.jsx';
import WorkflowConfigPage from './admin/WorkflowConfigPage.jsx';
import BudgetRegisterPage from './finance/BudgetRegisterPage.jsx';
import BudgetVsActualReport from './finance/BudgetVsActualReport.jsx';
import BudgetDashboard from './finance/BudgetDashboard.jsx';

function ModuleProtectedRoute({ moduleKey, fallbackDefault = true, children }) {
  const { settings } = useAuthStore();
  const val = settings[moduleKey];
  const isEnabled = val === undefined ? fallbackDefault : !!val;

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Activity size={32} />
        </div>
        <h3 className="text-[18px] font-bold text-slate-800">Module Disabled</h3>
        <p className="text-[13px] text-slate-500 max-w-sm mt-2">
          This feature module is currently disabled in your organization settings. An administrator can enable it from the Settings page.
        </p>
      </div>
    );
  }
  return children;
}
import { LowStockWidget, StockValueWidget, SectorRevenueWidget, TopClientsWidget } from '../components/erp/ERPDashboardWidgets.jsx';

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const fmt = (v) => `PKR ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function DashboardOverview() {
  const navigate = useNavigate();
  const { activeCompany, user } = useAuthStore();
  const { month, year } = usePeriodStore();
  const [metrics, setMetrics] = useState(null);
  const [journals, setJournals] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const periodParam = `${year}-${String(month).padStart(2, '0')}`;
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  const isEmployee = activeCompany?.user_role === 'Employee';
  const [empStats, setEmpStats] = useState({
    leaveBalance: 0,
    lastNetPay: 0,
    unreadMsgs: 0,
    recentLeaves: [],
    recentMsgs: []
  });

  const loadEmployeeData = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [msgRes, leavesRes, balRes] = await Promise.all([
        api.get(`/communications/employee/${activeCompany.id}`),
        api.get(`/communications/ess/${activeCompany.id}/leaves`),
        api.get(`/communications/ess/${activeCompany.id}/leave-balances`)
      ]);
      const unread = msgRes.data.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      
      let lastNetPay = 0;
      try {
        const profRes = await api.get(`/communications/ess/${activeCompany.id}/profile`);
        lastNetPay = profRes.data?.salary || 0;
      } catch (e) {}

      setEmpStats({
        leaveBalance: balRes.data?.remaining || 0,
        lastNetPay,
        unreadMsgs: unread,
        recentLeaves: (leavesRes.data || []).slice(0, 5),
        recentMsgs: (msgRes.data || []).slice(0, 5)
      });
    } catch (err) {
      console.error("Employee dashboard data load error", err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [ratios, journalRes, trends] = await Promise.all([
        api.get(`/analytics/ratios/${activeCompany.id}?period=${periodParam}`),
        api.get('/journal'),
        api.get(`/analytics/trends/${activeCompany.id}?months=12&period=${periodParam}`),
      ]);
      setMetrics(ratios.data.metrics);
      setJournals(
        journalRes.data
          .filter((entry) => {
            const d = new Date(entry.entry_date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          })
          .slice(0, 8)
      );
      const hist = trends.data?.data || [];
      setChartData(hist.map(r => ({
        month: r.label,
        revenue: parseFloat(r.revenue || 0),
        expenses: parseFloat(r.expenses || 0),
        cashFlow: parseFloat(r.profit || 0),
      })));
    } catch (err) {
      console.error("Dashboard data load error", err);
    }
    setIsLoading(false);
  }, [activeCompany, month, periodParam, year]);

  useEffect(() => {
    if (isEmployee) {
      loadEmployeeData();
    } else {
      load();
    }
  }, [isEmployee, load, loadEmployeeData]);

  if (isEmployee) {
    return (
      <div className="p-5 lg:p-7 space-y-6 pb-16 min-h-full" style={{ background: '#faf9f8' }}>
        <PowerBIHeader
          title={`Welcome back, ${user?.name || 'Employee'}!`}
          subtitle={activeCompany?.name ? `${activeCompany.name} - Employee Self-Service Workspace` : 'Employee Self-Service Workspace'}
          meta={periodLabel}
        />

        {/* Employee KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-3xs">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Leave Balance</span>
            <span className="text-[20px] font-black text-emerald-600 mt-2">{empStats.leaveBalance} Days Remaining</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-3xs">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Base Salary</span>
            <span className="text-[20px] font-black text-indigo-600 mt-2">PKR {parseFloat(empStats.lastNetPay).toLocaleString()}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-3xs">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">New Communications</span>
            <span className="text-[20px] font-black text-blue-600 mt-2">{empStats.unreadMsgs} Messages</span>
          </div>
        </div>

        {/* Content columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Communications */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-[13px] text-slate-900 uppercase tracking-wide">Recent Messages</h3>
              <button onClick={() => navigate('/dashboard/messages')} className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold transition cursor-pointer">
                View All
              </button>
            </div>

            {empStats.recentMsgs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">No recent messages.</div>
            ) : (
              <div className="space-y-3">
                {empStats.recentMsgs.map(m => (
                  <div key={m.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-emerald-500/20 cursor-pointer transition" onClick={() => navigate('/dashboard/messages')}>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[12px] text-slate-800">{m.subject}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">{m.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Leave Requests */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-[13px] text-slate-900 uppercase tracking-wide">Leave Requests</h3>
              <button onClick={() => navigate('/dashboard/leave')} className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold transition cursor-pointer">
                View All
              </button>
            </div>

            {empStats.recentLeaves.length === 0 ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">No leave history.</div>
            ) : (
              <div className="space-y-3">
                {empStats.recentLeaves.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <span className="font-extrabold text-[12px] text-slate-800">{l.leave_type} Leave</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</span>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                      l.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : l.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cashLabels = chartData.map(d => d.month);
  const cashLayout = computeChartLayout(cashLabels, { valueMagnitudes: chartData.map(d => d.cashFlow), minHeight: 220 });
  const trendLayout = computeChartLayout(cashLabels, { valueMagnitudes: chartData.flatMap(d => [d.revenue, d.expenses]), minHeight: 220 });

  const totalRev = parseFloat(metrics?.revenue || 0);
  const netProfit = parseFloat(metrics?.netIncome || 0);
  const totalExp = totalRev - netProfit;
  const cashBal = parseFloat(metrics?.currentAssets || 0);
  const profitMargin = metrics?.profitMargin || '0';

  const pieProfit = Math.max(0, chartData.reduce((a, c) => a + (c.revenue || 0), 0) - chartData.reduce((a, c) => a + (c.expenses || 0), 0));

  return (
    <div className="p-5 lg:p-7 space-y-5 pb-16 min-h-full" style={{ background: '#faf9f8' }}>
      <PowerBIHeader
        title={user?.name ? `Welcome back, ${user.name}! (${activeCompany?.user_role || user?.role || 'Member'})` : "Executive Dashboard"}
        subtitle={activeCompany?.name ? `${activeCompany.name} - financial & operations overview` : 'Financial & operations overview'}
        meta={periodLabel}
      />

      {/* KPI row — Power BI callout cards */}
      <Motion.div variants={pbiStagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <PowerBIKpi label="Total Revenue" value={fmt(totalRev)} sub={periodLabel} icon={TrendingUp} accent={PBI.revenue} loading={isLoading} />
        <PowerBIKpi label="Total Expenses" value={fmt(totalExp)} sub={periodLabel} icon={Activity} accent="#744EC2" loading={isLoading} />
        <PowerBIKpi label="Net Profit" value={fmt(netProfit)} sub={`Margin ${profitMargin}%`} icon={PieChartIcon} accent={netProfit >= 0 ? PBI.positive : PBI.negative} loading={isLoading} />
        <PowerBIKpi label="Cash Balance" value={fmt(cashBal)} sub={`As of ${periodLabel}`} icon={Wallet} accent="#E66C37" loading={isLoading} />
      </Motion.div>

      {/* Primary visuals — 2-column Power BI grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PowerBICard title="Financial Breakdown" subtitle="Profit vs expense share">
          <PowerBIDonut
            data={[
              { name: 'Net Profit', value: pieProfit },
              { name: 'Expenses', value: chartData.reduce((a, c) => a + (c.expenses || 0), 0) },
            ]}
            colors={[PBI.positive, PBI.negative]}
            centerLabel="Net Profit"
            centerValue={fmt(pieProfit).replace('PKR ', '')}
            height={240}
            currency="PKR"
          />
        </PowerBICard>

        <PowerBICard title="Revenue Trend" subtitle={`12 months ending ${periodLabel}`}>
          <AdaptiveChartFrame layout={trendLayout} fallbackHeight={220}>
            <AreaChart data={chartData} margin={buildChartMargins(trendLayout)}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#118DFF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#118DFF" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E81123" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#E81123" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...pbiGridProps} />
              <XAxis dataKey="month" interval={trendLayout.tickInterval} height={trendLayout.bottomMargin}
                tick={(p) => <DynamicXTick {...p} layout={trendLayout} lookup={chartData.map(d => ({ name: d.month, fullName: d.month }))} />} axisLine={false} tickLine={false} />
              <YAxis {...yAxisProps(trendLayout, v => `PKR ${(v / 1000).toFixed(0)}k`)} />
              <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={p.label} formatter={(v) => fmt(v)} />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={PBI.revenue} strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke={PBI.negative} strokeWidth={2} fill="url(#expGrad)" dot={false} />
            </AreaChart>
          </AdaptiveChartFrame>
        </PowerBICard>
      </div>

      {/* Cash flow — full width */}
      <PowerBICard title="Operating Cash Flow" subtitle={`Monthly contribution through ${periodLabel}`}>
        <AdaptiveChartFrame layout={cashLayout} fallbackHeight={220}>
          <BarChart data={chartData} margin={buildChartMargins(cashLayout)}>
            <defs>
              <linearGradient id="barFlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#118DFF" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#12239E" stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid {...pbiGridProps} />
            <XAxis dataKey="month" interval={cashLayout.tickInterval} height={cashLayout.bottomMargin}
              tick={(p) => <DynamicXTick {...p} layout={cashLayout} lookup={chartData.map(d => ({ name: d.month, fullName: d.month }))} />} axisLine={false} tickLine={false} />
            <YAxis {...yAxisProps(cashLayout, v => `PKR ${(v / 1000).toFixed(0)}k`)} />
            <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={p.label} formatter={(v) => fmt(v)} />} cursor={{ fill: 'rgba(17,141,255,0.06)' }} />
            <Bar dataKey="cashFlow" name="Cash Flow" radius={[4, 4, 0, 0]} maxBarSize={cashLayout.maxBarSize} fill="url(#barFlow)">
              {chartData.map((_, i) => <Cell key={i} style={{ outline: 'none' }} />)}
            </Bar>
          </BarChart>
        </AdaptiveChartFrame>
      </PowerBICard>

      {/* Operations row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StockValueWidget />
            <LowStockWidget />
          </div>
          <SectorRevenueWidget />
        </div>

        <div className="space-y-4">
          <PowerBICard title="Quick Actions" subtitle="Common tasks">
            <div className="space-y-2">
              {[
                { icon: Plus, label: 'Add Journal Entry', to: '/dashboard/journal', color: PBI.positive },
                { icon: FileText, label: 'View Reports', to: '/dashboard/reports', color: PBI.revenue },
                { icon: Target, label: 'Analytics & Budgets', to: '/dashboard/analytics', color: '#E66C37' },
                { icon: BarChart3, label: 'Distribution', to: '/dashboard/distribution', color: PBI.accent },
              ].map(item => (
                <button key={item.label} onClick={() => navigate(item.to)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-semibold transition-colors bg-[#f3f2f1] text-[#252423] border border-[#edebe9] hover:bg-[#edebe9]"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}18` }}>
                    <item.icon size={14} style={{ color: item.color }} />
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </PowerBICard>

          <PowerBICard
            title="Recent Transactions"
            subtitle={periodLabel}
            action={
              <button onClick={() => navigate('/dashboard/ledger')} className="text-[11px] font-semibold text-[#118DFF] hover:underline shrink-0">
                View all
              </button>
            }
            className="!p-0"
          >
            <div className="divide-y divide-[#f3f2f1] max-h-[340px] overflow-y-auto hide-scrollbar">
              {isLoading ? (
                <p className="p-6 text-center text-[12px] text-[#8a8886]">Loading…</p>
              ) : journals.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center px-4">
                  <BookOpen size={28} className="text-[#edebe9] mb-2" />
                  <p className="text-[12px] text-[#8a8886]">No transactions yet</p>
                </div>
              ) : (
                journals.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#faf9f8] transition-colors">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-[#f3f2f1] text-[#605e5c]">
                      <FileText size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#252423] truncate">{j.description}</p>
                      <p className="text-[10px] text-[#8a8886] mt-0.5">
                        {new Date(j.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-[12px] text-[#252423] flex-shrink-0">
                      {fmt(j.total_amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PowerBICard>

          <TopClientsWidget />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidth = isMobile ? 0 : (collapsed ? 68 : 248);

  return (
    <div className="flex min-h-screen" style={{ background: '#faf9f8' }}>
      <Sidebar collapsed={collapsed} isMobile={isMobile} onToggle={() => setCollapsed(!collapsed)} />
      <Header
        sidebarCollapsed={collapsed}
        isMobile={isMobile}
        onMenuToggle={() => setCollapsed(!collapsed)}
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
      />

      <Motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 min-h-screen relative"
        style={{ paddingTop: 60, minWidth: 0, background: '#faf9f8' }}
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
              <Route path="analytics" element={
                <ModuleProtectedRoute moduleKey="budgetingEnabled">
                  <AnalyticsDashboard />
                </ModuleProtectedRoute>
              } />
              <Route path="inventory" element={
                <ModuleProtectedRoute moduleKey="inventoryEnabled">
                  <InventoryPage globalSearch={globalSearch} />
                </ModuleProtectedRoute>
              } />
              <Route path="warehouses" element={
                <ModuleProtectedRoute moduleKey="warehousingEnabled">
                  <WarehousePage globalSearch={globalSearch} />
                </ModuleProtectedRoute>
              } />
              <Route path="distribution" element={
                <ModuleProtectedRoute moduleKey="inventoryEnabled">
                  <DistributionPage globalSearch={globalSearch} />
                </ModuleProtectedRoute>
              } />
              <Route path="payroll" element={
                <ModuleProtectedRoute moduleKey="payrollEnabled" fallbackDefault={false}>
                  <PayrollPage />
                </ModuleProtectedRoute>
              } />
              <Route path="vouchers/*" element={<VouchersPage />} />
              <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="order-tracking" element={<OrderTrackingPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="email-center" element={<EmailCenterPage />} />
              <Route path="notifications" element={<NotificationCenterPage />} />
              <Route path="leave" element={<EmployeeLeavePage />} />
              <Route path="documents" element={<EmployeeDocumentsPage />} />
              <Route path="messages" element={<EmployeeMessagesPage />} />
              <Route path="risk" element={
                <ModuleProtectedRoute moduleKey="riskEnabled">
                  <RiskDashboard />
                </ModuleProtectedRoute>
              } />
              
              <Route path="fixed-assets" element={
                <ModuleProtectedRoute moduleKey="fixedAssetsEnabled">
                  <FixedAssetsDashboard />
                </ModuleProtectedRoute>
              } />
              <Route path="fixed-assets/register" element={
                <ModuleProtectedRoute moduleKey="fixedAssetsEnabled">
                  <AssetRegister />
                </ModuleProtectedRoute>
              } />
              <Route path="fixed-assets/categories" element={
                <ModuleProtectedRoute moduleKey="fixedAssetsEnabled">
                  <AssetCategories />
                </ModuleProtectedRoute>
              } />
              <Route path="fixed-assets/wizard" element={
                <ModuleProtectedRoute moduleKey="fixedAssetsEnabled">
                  <DepreciationWizard />
                </ModuleProtectedRoute>
              } />
              <Route path="finance/close-wizard" element={<MonthEndCloseWizard />} />
              <Route path="admin/workflows" element={<WorkflowConfigPage />} />
              <Route path="admin/approvals" element={<ApprovalsInboxPage />} />
              <Route path="finance/budgets" element={<BudgetRegisterPage />} />
              <Route path="finance/budgets/dashboard" element={<BudgetDashboard />} />
              <Route path="finance/budgets/vs-actual" element={<BudgetVsActualReport />} />
            </Routes>
          </Motion.div>
        </AnimatePresence>
      </Motion.main>
    </div>
  );
}
