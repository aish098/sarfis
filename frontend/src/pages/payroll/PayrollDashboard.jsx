import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  Play, RefreshCw, AlertTriangle, ShieldCheck, Clock, 
  TrendingUp, ArrowRight, BookOpen, Lock, Activity, ShieldAlert,
  Star, FileText, CheckSquare, Plus, ArrowUpRight
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import Timeline from '../../components/ui/Timeline';

export default function PayrollDashboard({ onNavigateToTab, userRole }) {
  const { activeCompany } = useAuthStore();
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalPayroll: 0,
    employerCost: 0,
    pfContribution: 0,
    taxesWithheld: 0,
    averageSalary: 0,
    budgetVariance: 0,
    totalHeadcount: 0,
    paid: 0,
    pending: 0,
    onHold: 0,
    failedPayments: 0,
    missingBank: 0,
    pendingApprovals: 0,
    activePeriod: '2026-08',
    status: 'DRAFT'
  });

  const kpis = [
    { label: 'Total Payroll', icon: DollarSign, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Employer Cost', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Provident Fund (PF)', icon: Landmark, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Income Taxes Withheld', icon: ShieldCheck, color: 'text-purple-600 bg-purple-50' },
    { label: 'Average Salary', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Budget Variance', icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
  ];

  // Favorites reports list
  const [favorites, setFavorites] = useState([
    { name: 'Payroll Register', tab: 'reports' },
    { name: 'Bank Reconciliation', tab: 'payments' },
    { name: 'Employee Cost Report', tab: 'reports' },
    { name: 'Payslips Summary', tab: 'reports' }
  ]);

  const [todayActivities, setTodayActivities] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  // Role-Based "My Work" Tasks
  const getMyWorkTasks = () => {
    switch (userRole) {
      case 'HR Officer':
        return [
          { text: '2 Payroll runs awaiting initial HR compiler', priority: 'HIGH' },
          { text: '3 Employees missing active salary structure details', priority: 'MEDIUM' },
          { text: '5 Attendance records marked absent without explanation', priority: 'LOW' }
        ];
      case 'HR Manager':
        return [
          { text: 'Review Aug 2026 calculations and submit for sign-off', priority: 'HIGH' },
          { text: '3 employee compliance exceptions require override validation', priority: 'HIGH' }
        ];
      case 'Finance':
        return [
          { text: '1 payroll run awaiting post to general ledger', priority: 'HIGH' },
          { text: '2 department budget warnings require sign-off overrides', priority: 'MEDIUM' }
        ];
      case 'Treasury':
        return [
          { text: 'Authorize bank disbursement batch file for Aug 2026', priority: 'HIGH' },
          { text: '5 payment lines pending bank statement reconciliation', priority: 'MEDIUM' },
          { text: '1 failed bank clearance line requires transaction review', priority: 'HIGH' }
        ];
      case 'Auditor':
        return [
          { text: 'Verify calculation traces for modified components', priority: 'MEDIUM' },
          { text: 'Audit payment reversal logs for period Jul 2026', priority: 'MEDIUM' }
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    if (!activeCompany?.id) return;
    
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const runsRes = await api.get(`/payroll/${activeCompany.id}/reports/register`);
        const runs = runsRes.data || [];
        
        const empRes = await api.get(`/employees/${activeCompany.id}`);
        const baseEmployees = empRes.data || [];

        let currentPeriod = '2026-08';
        let latestRun = null;
        let wsEmployees = [];

        if (runs.length > 0) {
          latestRun = runs[0];
          currentPeriod = latestRun.period;
          const workspaceEmpRes = await api.get(`/payroll/${activeCompany.id}/employees?period=${currentPeriod}`);
          wsEmployees = workspaceEmpRes.data || [];
        }

        const paidCount = wsEmployees.filter(e => e.payment_status === 'PAID' || e.payment_status === 'DISBURSED').length;
        const holdCount = wsEmployees.filter(e => e.payment_status === 'ON_HOLD').length;
        const pendingCount = wsEmployees.length - paidCount - holdCount;
        const failedCount = wsEmployees.filter(e => e.payment_status === 'FAILED').length;
        const missingBankCount = baseEmployees.filter(e => !e.bank_account || e.bank_account.trim() === '').length;

        setStats({
          totalPayroll: latestRun ? parseFloat(latestRun.total_net || 0) : 0,
          employerCost: latestRun ? parseFloat(latestRun.total_gross || 0) * 1.08 : 0,
          pfContribution: latestRun ? parseFloat(latestRun.total_deductions || 0) * 0.25 : 0,
          taxesWithheld: latestRun ? parseFloat(latestRun.total_deductions || 0) * 0.70 : 0,
          averageSalary: baseEmployees.length > 0 && latestRun ? (parseFloat(latestRun.total_net || 0) / baseEmployees.length) : 0,
          budgetVariance: latestRun ? (parseFloat(latestRun.total_net || 0) - 3000000) : 0,
          totalHeadcount: baseEmployees.length,
          paid: paidCount,
          pending: pendingCount,
          onHold: holdCount,
          failedPayments: failedCount,
          missingBank: missingBankCount,
          pendingApprovals: latestRun && latestRun.status === 'DRAFT' ? 1 : 0,
          activePeriod: currentPeriod,
          status: latestRun ? latestRun.status : 'DRAFT'
        });

        // Generate recommendations dynamically
        const recs = [];
        if (missingBankCount > 0) {
          recs.push({
            text: `${missingBankCount} employee(s) missing bank accounts / IBAN details.`,
            actionText: 'Fix Now',
            tab: 'employees'
          });
        }
        if (failedCount > 0) {
          recs.push({
            text: `${failedCount} payment clearance line(s) failed.`,
            actionText: 'Review payments',
            tab: 'payments'
          });
        }
        if (baseEmployees.length === 0) {
          recs.push({
            text: 'Employee master directory is empty. Add profiles to compute payroll.',
            actionText: 'Add Employee',
            tab: 'employees'
          });
        }
        setRecommendations(recs);

        // Fetch activities dynamically from audit logs
        try {
          const auditRes = await api.get(`/audit/${activeCompany.id}`);
          const auditLogs = auditRes.data.logs || [];
          
          const filteredLogs = auditLogs
            .filter(log => log.entity_type === 'PAYROLL' || log.entity_type === 'EMPLOYEE' || log.action.includes('PAYROLL'))
            .slice(0, 5)
            .map(log => ({
              title: `${log.user_name || 'System'} completed ${log.action.toLowerCase()}`,
              desc: `Entity: ${log.entity_type || 'General'} (ID: ${log.entity_id || '—'})`,
              date: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

          if (filteredLogs.length > 0) {
            setTodayActivities(filteredLogs);
          } else {
            setTodayActivities([
              { title: 'Workspace Initialized', desc: 'No transaction activity logs registered yet.', date: 'Just Now' }
            ]);
          }
        } catch {
          setTodayActivities([
            { title: 'Workspace Ready', desc: 'Active monitoring enabled.', date: 'Just Now' }
          ]);
        }
      } catch (err) {
        console.error('Failed to load real-time dashboard analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeCompany?.id]);

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      
      {/* Top Banner Control Center */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase tracking-wider">
                Active period: {stats.activePeriod}
              </span>
              <span className="text-[10px] font-black bg-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {stats.status}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Payroll Command Center</h2>
            <p className="text-slate-400 text-xs font-semibold max-w-xl font-normal">
              Review real-time accounting runs, exceptions checklist, and payments release pipelines in one central cockpit.
            </p>
          </div>

          {(() => {
            const progressPct = stats.totalHeadcount > 0 ? Math.round((stats.paid / stats.totalHeadcount) * 100) : 0;
            return (
              <div className="bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 min-w-[240px] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">Calculation Progress</span>
                  <span className="font-extrabold text-indigo-300">{progressPct}% Complete</span>
                </div>
                <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 font-medium font-bold">Calculated {stats.paid} of {stats.totalHeadcount} employee sheets</p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Favorites Pinned Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center gap-1"><Star size={12} className="text-amber-500" /> Favorites:</span>
        {favorites.map(fav => (
          <button 
            key={fav.name}
            onClick={() => onNavigateToTab(fav.tab)}
            className="px-3 py-1.5 bg-slate-55 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs cursor-pointer text-[10px] font-black"
          >
            {fav.name}
          </button>
        ))}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          let val = '';
          let change = '';
          if (kpi.label === 'Total Payroll') { val = `PKR ${stats.totalPayroll.toLocaleString()}`; change = '+4.2% vs last month'; }
          if (kpi.label === 'Employer Cost') { val = `PKR ${stats.employerCost.toLocaleString()}`; change = 'Includes benefits & PF'; }
          if (kpi.label === 'Provident Fund (PF)') { val = `PKR ${stats.pfContribution.toLocaleString()}`; change = 'Company matching match'; }
          if (kpi.label === 'Income Taxes Withheld') { val = `PKR ${stats.taxesWithheld.toLocaleString()}`; change = 'Auto FBR slabs'; }
          if (kpi.label === 'Average Salary') { val = `PKR ${Math.round(stats.averageSalary).toLocaleString()}`; change = `Headcount: ${stats.totalHeadcount}`; }
          if (kpi.label === 'Budget Variance') { val = `${stats.budgetVariance >= 0 ? '+' : ''}PKR ${stats.budgetVariance.toLocaleString()}`; change = 'Under budget'; }

          return (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">{kpi.label}</span>
                <div className={`p-2 rounded-xl ${kpi.color} shrink-0`}>
                  <Icon size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="font-display font-black text-[18px] text-slate-800 tracking-tight leading-none">{val}</p>
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">{change}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: My Work, Action Cards, Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Intelligent Action Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Processing Status Cockpit</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              {/* Card 1: Generate */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-800">Generate Payroll</h4>
                    <p className="text-[10px] text-slate-400 font-normal leading-normal mt-0.5">Initialize period calculations.</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase">Ready</span>
                </div>
                <button 
                  onClick={() => onNavigateToTab('processing')}
                  className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center"
                >
                  Start Run
                </button>
              </div>

              {/* Card 2: Approvals */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-800">Workflow Approval sign-off</h4>
                    <p className="text-[10px] text-slate-400 font-normal leading-normal mt-0.5">Finance Director review sign-offs.</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black uppercase">Awaiting sign-off</span>
                </div>
                <button 
                  onClick={() => onNavigateToTab('processing')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center"
                >
                  Open Sign-off
                </button>
              </div>

              {/* Card 3: Payments */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-800">Direct Treasury Payouts</h4>
                    <p className="text-[10px] text-slate-400 font-normal leading-normal mt-0.5">{stats.paid} Disbursed • {stats.pending} Pending.</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase">Processing</span>
                </div>
                <button 
                  onClick={() => onNavigateToTab('payments')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center"
                >
                  Release Payments
                </button>
              </div>

              {/* Card 4: Reconciliation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-800">Bank Statement Reconciliation</h4>
                    <p className="text-[10px] text-slate-400 font-normal leading-normal mt-0.5">3 Unmatched entries flagged.</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-black uppercase">Unresolved</span>
                </div>
                <button 
                  onClick={() => onNavigateToTab('payments')}
                  className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center"
                >
                  Review Reconciliation
                </button>
              </div>
            </div>
          </div>

          {/* Smart Recommendations */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Smart Recommendations Console</h3>
            <div className="space-y-2.5">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition-all">
                  <span className="text-slate-700 leading-snug">{rec.text}</span>
                  <button 
                    onClick={() => onNavigateToTab(rec.tab)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-0.5 cursor-pointer shadow-3xs"
                  >
                    {rec.actionText} <ArrowUpRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: My Work & Timeline */}
        <div className="space-y-6">
          {/* My Work Role Console */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex justify-between items-center">
              <span>My Tasks: {userRole}</span>
              <CheckSquare size={14} className="text-slate-400" />
            </h3>
            
            <div className="space-y-3 text-xs font-semibold">
              {getMyWorkTasks().map((task, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between gap-3 items-center">
                  <span className="text-slate-600 leading-normal">{task.text}</span>
                  <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                    task.priority === 'HIGH' ? 'bg-rose-50 text-rose-700 border border-rose-150' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Payroll Activity Timeline */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex justify-between items-center">
              <span>Today's Payroll Activity</span>
              <Clock size={14} className="text-slate-400" />
            </h3>

            <Timeline items={todayActivities} />
          </div>
        </div>
      </div>
    </div>
  );
}
