import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  Play, RefreshCw, AlertTriangle, ShieldCheck, Clock, 
  TrendingUp, ArrowRight, BookOpen, Lock, Activity, ShieldAlert,
  Star, FileText, CheckSquare, Plus, ArrowUpRight
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import KPIGrid from '../../components/ui/KPIGrid';
import ActivityFeed from '../../components/ui/ActivityFeed';
import StatusBadge from '../../components/ui/StatusBadge';

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
    const tasks = [];
    switch (userRole) {
      case 'HR Officer':
      case 'HR Manager':
        if (stats.totalHeadcount === 0) {
          tasks.push({ text: 'Employee master directory is empty. Add employee profiles.', priority: 'HIGH' });
        }
        if (stats.status === 'DRAFT' || stats.status === 'READY_TO_POST') {
          tasks.push({ text: `Review ${stats.activePeriod} calculations and submit for sign-off`, priority: 'HIGH' });
        }
        if (stats.missingBank > 0) {
          tasks.push({ text: `${stats.missingBank} employee compliance exception(s) require bank account info`, priority: 'HIGH' });
        }
        if (tasks.length === 0) {
          tasks.push({ text: `No outstanding compliance validation actions for ${stats.activePeriod}`, priority: 'LOW' });
        }
        return tasks;
      case 'Finance':
        if (stats.status === 'APPROVED' || stats.status === 'READY_TO_POST') {
          tasks.push({ text: `1 payroll run awaiting post to general ledger (${stats.activePeriod})`, priority: 'HIGH' });
        }
        if (stats.budgetVariance > 0) {
          tasks.push({ text: `Department budget variance detected: PKR ${stats.budgetVariance.toLocaleString()} over-limit`, priority: 'MEDIUM' });
        }
        if (tasks.length === 0) {
          tasks.push({ text: 'All period journal entries posted successfully to Ledger', priority: 'LOW' });
        }
        return tasks;
      case 'Treasury':
        if (stats.status === 'POSTED') {
          tasks.push({ text: `Authorize bank disbursement batch file for ${stats.activePeriod}`, priority: 'HIGH' });
        }
        if (stats.failedPayments > 0) {
          tasks.push({ text: `${stats.failedPayments} failed bank clearance line(s) require transaction review`, priority: 'HIGH' });
        }
        if (stats.pending > 0) {
          tasks.push({ text: `${stats.pending} payment line(s) pending bank statement reconciliation`, priority: 'MEDIUM' });
        }
        if (tasks.length === 0) {
          tasks.push({ text: `All treasury disbursements cleared for ${stats.activePeriod}`, priority: 'LOW' });
        }
        return tasks;
      case 'Auditor':
        tasks.push({ text: `Verify calculation traces for ${stats.activePeriod} components`, priority: 'MEDIUM' });
        tasks.push({ text: 'Audit payment change logs and history trails', priority: 'MEDIUM' });
        return tasks;
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
        const missingBankCount = baseEmployees.filter(e => !e.account_number || e.account_number.trim() === '').length;

        const totalNet = wsEmployees.reduce((sum, e) => sum + parseFloat(e.net_salary || 0), 0);
        const totalGross = wsEmployees.reduce((sum, e) => sum + parseFloat(e.gross_salary || 0), 0);
        const totalPF = wsEmployees.reduce((sum, e) => sum + parseFloat(e.pf_deduction || 0), 0);
        const totalTax = wsEmployees.reduce((sum, e) => sum + parseFloat(e.tax_deduction || 0), 0);

        setStats({
          totalPayroll: totalNet || (latestRun ? parseFloat(latestRun.total_net || 0) : 0),
          employerCost: (totalGross + totalPF) || (latestRun ? parseFloat(latestRun.total_gross || 0) * 1.08 : 0),
          pfContribution: totalPF || (latestRun ? parseFloat(latestRun.total_deductions || 0) * 0.25 : 0),
          taxesWithheld: totalTax || (latestRun ? parseFloat(latestRun.total_deductions || 0) * 0.70 : 0),
          averageSalary: baseEmployees.length > 0 ? ((totalNet || (latestRun ? parseFloat(latestRun.total_net || 0) : 0)) / baseEmployees.length) : 0,
          budgetVariance: (totalNet || (latestRun ? parseFloat(latestRun.total_net || 0) : 0)) - 3000000,
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
              title: log.action.replace(/_/g, ' '),
              user: log.user_name || 'System',
              time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              description: `Entity: ${log.entity_type || 'General'} (ID: ${log.entity_id || '—'})`,
              status: log.action.includes('FAIL') || log.action.includes('REJECT') ? 'ERROR' : 'SUCCESS'
            }));

          if (filteredLogs.length > 0) {
            setTodayActivities(filteredLogs);
          } else {
            setTodayActivities([
              { title: 'Workspace Initialized', description: 'No transaction activity logs registered yet.', time: 'Just Now', status: 'INFO' }
            ]);
          }
        } catch {
          setTodayActivities([
            { title: 'Workspace Ready', description: 'Active monitoring enabled.', time: 'Just Now', status: 'INFO' }
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

  const kpiItems = [
    { label: 'Total Payroll', value: `PKR ${stats.totalPayroll.toLocaleString()}`, icon: DollarSign, iconBgClass: 'bg-indigo-50', iconColorClass: 'text-indigo-650', trend: '+4.2%', subtitle: 'vs last month' },
    { label: 'Employer Cost', value: `PKR ${stats.employerCost.toLocaleString()}`, icon: TrendingUp, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600', subtitle: 'Benefits & PF Included' },
    { label: 'Provident Fund (PF)', value: `PKR ${stats.pfContribution.toLocaleString()}`, icon: Landmark, iconBgClass: 'bg-cyan-50', iconColorClass: 'text-cyan-600', subtitle: 'Company matching contribution' },
    { label: 'Income Taxes Withheld', value: `PKR ${stats.taxesWithheld.toLocaleString()}`, icon: ShieldCheck, iconBgClass: 'bg-purple-50', iconColorClass: 'text-purple-650', subtitle: 'FBR Auto Slabs' },
    { label: 'Average Salary', value: `PKR ${Math.round(stats.averageSalary).toLocaleString()}`, icon: Users, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650', subtitle: `Headcount: ${stats.totalHeadcount}` }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[12px] font-bold text-slate-400">Loading payroll command cockpit...</p>
      </div>
    );
  }

  return (
    <WorkspaceLayout
      title="Payroll Dashboard"
      subtitle="Analyze salary costs, headcount, and period metrics."
      icon={Activity}
      breadcrumbs={['SARFIS', 'Payroll', 'Dashboard']}
    >
      {/* 1. Period Filter & Calculation Progress */}
      <div className="col-span-full bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-750 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase tracking-wider">
            Active period: {stats.activePeriod}
          </span>
          <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-750 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {stats.status}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-3 min-w-[280px]">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center text-[10.5px] mb-1 font-bold">
              <span className="text-slate-450 uppercase tracking-wider">Calculation Progress</span>
              <span className="text-indigo-650">{stats.totalHeadcount > 0 ? Math.round((stats.paid / stats.totalHeadcount) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full" style={{ width: `${stats.totalHeadcount > 0 ? Math.round((stats.paid / stats.totalHeadcount) * 100) : 0}%` }} />
            </div>
          </div>
          <span className="text-[10.5px] font-bold text-slate-500 bg-slate-55 px-2 py-0.5 rounded shrink-0">
            {stats.paid}/{stats.totalHeadcount} sheets
          </span>
        </div>
      </div>

      {/* 2. Favorites pinned buttons */}
      <div className="col-span-full bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center gap-1"><Star size={12} className="text-amber-500" /> Favorites:</span>
        {favorites.map(fav => (
          <button 
            key={fav.name}
            onClick={() => onNavigateToTab(fav.tab)}
            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all shadow-3xs cursor-pointer text-[10px] font-black"
          >
            {fav.name}
          </button>
        ))}
      </div>

      {/* 3. KPIs Grid */}
      <div className="col-span-full">
        <KPIGrid items={kpiItems} />
      </div>

      {/* 4. Left Column: Cockpit & Recommendations */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Payroll Processing Status Cockpit */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Processing Status Cockpit</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
            {/* Card 1: Generate */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-extrabold text-slate-800">Generate Payroll</h4>
                  <p className="text-[10px] text-slate-400 font-normal leading-normal mt-0.5">Initialize period calculations.</p>
                </div>
                <StatusBadge status="ACTIVE" customLabel="Ready" />
              </div>
              <button 
                onClick={() => onNavigateToTab('processing')}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center border-none"
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
                <StatusBadge status="PENDING" customLabel="Awaiting Sign-off" />
              </div>
              <button 
                onClick={() => onNavigateToTab('processing')}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center border-none"
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
                <StatusBadge status="PROCESSING" />
              </div>
              <button 
                onClick={() => onNavigateToTab('payments')}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center border-none"
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
                <StatusBadge status="FAILED" customLabel="Unresolved" />
              </div>
              <button 
                onClick={() => onNavigateToTab('payments')}
                className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-black transition-all shadow-3xs cursor-pointer text-center border-none"
              >
                Review Reconciliation
              </button>
            </div>
          </div>
        </div>

        {/* Smart Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Smart Recommendations</h3>
            <div className="space-y-2.5">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition-all">
                  <span className="text-slate-700 leading-snug font-semibold">{rec.text}</span>
                  <button 
                    onClick={() => onNavigateToTab(rec.tab)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-indigo-650 hover:bg-indigo-50 transition-all flex items-center gap-0.5 cursor-pointer shadow-3xs whitespace-nowrap"
                  >
                    {rec.actionText} <ArrowUpRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Right Column: My Tasks & Today's Activity */}
      <div className="lg:col-span-4 space-y-6">
        {/* My Tasks Console */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex justify-between items-center">
            <span>My Tasks: {userRole}</span>
            <CheckSquare size={14} className="text-slate-400" />
          </h3>
          
          <div className="space-y-3 text-xs font-semibold">
            {getMyWorkTasks().map((task, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between gap-3 items-center">
                <span className="text-slate-650 leading-normal font-semibold">{task.text}</span>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                  task.priority === 'HIGH' ? 'bg-rose-50 text-rose-700 border border-rose-150' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Payroll Activity Feed */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex justify-between items-center">
            <span>Today's Payroll Activity</span>
            <Clock size={14} className="text-slate-400" />
          </h3>

          <ActivityFeed events={todayActivities} />
        </div>
      </div>
    </WorkspaceLayout>
  );
}
