import React, { useState, Suspense, lazy } from 'react';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  Activity, Sliders, Briefcase, BarChart2, ShieldCheck, Layers,
  UserCheck
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

// Lazily load each sub-workspace to maximize startup responsiveness
const PayrollDashboard = lazy(() => import('./PayrollDashboard'));
const PayrollRuns = lazy(() => import('./PayrollRuns'));
const PayrollEmployees = lazy(() => import('./PayrollEmployees'));
const PayrollConfiguration = lazy(() => import('./PayrollConfiguration'));
const PayrollPayments = lazy(() => import('./PayrollPayments'));
const PayrollReports = lazy(() => import('./PayrollReports'));

export default function PayrollPage() {
  const { activeCompany } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | runs | employees | configuration | payments | reports
  const [userRole, setUserRole] = useState('HR Manager'); // HR Officer | HR Manager | Finance | Treasury | Auditor

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'runs', label: 'Payroll Runs', icon: Activity },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'configuration', label: 'Configuration', icon: Sliders },
    { id: 'payments', label: 'Payments', icon: Landmark },
    { id: 'reports', label: 'Reports & Compliance', icon: BarChart2 },
  ];

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-[1600px] mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#FAFBFD] via-[#FAF9F8] to-[#F5FAF8] space-y-6">
      {/* Top Banner Orchestrator */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Users size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Payroll Workspace</h1>
              <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Operational Lifecycle</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Manage salary components, structural formula rules, payments release, and audit-compliant reporting.
            </p>
          </div>
        </div>

        {/* Dynamic Role Switcher and Tab Headers */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs">
            <UserCheck size={14} className="text-slate-400" />
            <select
              value={userRole}
              onChange={e => setUserRole(e.target.value)}
              className="text-[10.5px] font-black uppercase text-slate-700 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="HR Officer">HR Officer</option>
              <option value="HR Manager">HR Manager (Admin)</option>
              <option value="Finance">Finance Director</option>
              <option value="Treasury">Treasury Officer</option>
              <option value="Auditor">Auditor (Read Only)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/40 p-1 rounded-2xl">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab.id 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={12} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lazily Mounted Sub-Workspace Panel */}
      <div className="min-h-[500px]">
        <Suspense fallback={
          <div className="p-16 text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
            <p className="text-slate-400 text-xs font-semibold">Loading payroll sub-workspace...</p>
          </div>
        }>
          {activeTab === 'dashboard' && <PayrollDashboard onNavigateToTab={setActiveTab} userRole={userRole} />}
          {activeTab === 'runs' && <PayrollRuns userRole={userRole} />}
          {activeTab === 'employees' && <PayrollEmployees userRole={userRole} />}
          {activeTab === 'configuration' && <PayrollConfiguration userRole={userRole} />}
          {activeTab === 'payments' && <PayrollPayments userRole={userRole} />}
          {activeTab === 'reports' && <PayrollReports userRole={userRole} />}
        </Suspense>
      </div>
    </div>
  );
}
