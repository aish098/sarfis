import React from 'react';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  Play, RefreshCw, AlertTriangle, ShieldCheck, Clock, 
  TrendingUp, ArrowRight, BookOpen, ShieldAlert, GitCommit
} from 'lucide-react';

export default function PayrollDashboard({ onNavigateToTab }) {
  const kpis = [
    { label: 'Total Payroll', value: 'PKR 32,550,000', change: '+4.2% vs last month', icon: DollarSign, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Employer Cost', value: 'PKR 35,100,000', change: 'Includes benefits & PF', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Provident Fund (PF)', value: 'PKR 1,220,000', change: 'Company matching: PKR 610k', icon: Landmark, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Income Taxes Withheld', value: 'PKR 2,850,000', change: 'Auto-calculated via FBR slabs', icon: ShieldCheck, color: 'text-purple-600 bg-purple-50' },
    { label: 'Average Salary', value: 'PKR 132,857', change: 'Active headcount: 245', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Budget Variance', value: '-PKR 250,000', change: 'Under budget limit by 0.8%', icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
  ];

  const headcount = {
    total: 245,
    paid: 212,
    pending: 18,
    onHold: 5,
    failedPayments: 1,
    missingBank: 3,
    pendingApprovals: 2
  };

  const calendarPeriods = [
    { name: 'May 2026', status: 'CLOSED', color: 'bg-slate-100 text-slate-500 border-slate-200' },
    { name: 'Jun 2026', status: 'CLOSED', color: 'bg-slate-100 text-slate-500 border-slate-200' },
    { name: 'Jul 2026', status: 'POSTED', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { name: 'Aug 2026', status: 'READY TO POST', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { name: 'Sep 2026', status: 'FUTURE', color: 'bg-slate-50 text-slate-400 border-slate-100 border-dashed' },
  ];

  const workflowSteps = [
    { name: 'Calculations Compiled', role: 'HR System', status: 'APPROVED', time: 'Aug 10' },
    { name: 'HR Review', role: 'HR Manager', status: 'APPROVED', time: 'Aug 11' },
    { name: 'Financial Controls Review', role: 'Finance Director', status: 'PENDING', time: 'In Progress' },
    { name: 'Disbursement Authorization', role: 'CFO', status: 'WAITING', time: 'Queued' },
  ];

  const warnings = [
    { id: 1, text: '3 Employees missing bank accounts / IBAN details.', severity: 'CRITICAL', actionText: 'Resolve Accounts', tab: 'employees' },
    { id: 2, text: '2 Employees on hold (salary disbursement locked manually).', severity: 'WARNING', actionText: 'Review Overrides', tab: 'employees' },
    { id: 3, text: '1 Formula validation warning on commission component: variable "bonus" is undefined.', severity: 'WARNING', actionText: 'Fix Formula', tab: 'configuration' },
  ];

  const recentActivities = [
    { id: 1, time: '10 mins ago', user: 'Rana Talal', text: 'Simulated payroll run for Aug 2026.' },
    { id: 2, time: '1 hour ago', user: 'Ayesha Malik', text: 'Put salary on hold for employee Ayesha Malik.' },
    { id: 3, time: '3 hours ago', user: 'System Agent', text: 'Synchronized monthly unpaid leave records from Attendance Module.' },
    { id: 4, time: 'Yesterday', user: 'System Agent', text: 'Re-validated formula cache for all active components.' },
  ];

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Top Banner Control Center */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-full border border-indigo-500/20 tracking-wider">
                Active Period: Aug 2026
              </span>
              <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-full border border-emerald-500/20 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ready For Posting
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Payroll Command Center</h2>
            <p className="text-slate-400 text-xs font-semibold max-w-xl">
              Compile monthly salary components, execute simulations inside transactional blocks, and post direct payouts to HBL/MCB treasury channels.
            </p>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 min-w-[240px] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">Calculation Progress</span>
              <span className="font-extrabold text-indigo-300">86% Complete</span>
            </div>
            <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full" style={{ width: '86%' }} />
            </div>
            <p className="text-[10px] text-slate-400 font-medium font-bold">Calculated 212 of 245 employee sheets</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">{kpi.label}</span>
                <div className={`p-2 rounded-xl ${kpi.color} shrink-0`}>
                  <Icon size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="font-display font-black text-[18px] text-slate-800 tracking-tight leading-none">{kpi.value}</p>
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">{kpi.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Headcount Breakdown Row */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs text-center font-semibold text-slate-600">
        <div>
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Total Headcount</p>
          <p className="font-display font-black text-2xl text-slate-800 mt-1">{headcount.total}</p>
        </div>
        <div className="border-l border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Paid List</p>
          <p className="font-display font-black text-2xl text-emerald-600 mt-1">{headcount.paid}</p>
        </div>
        <div className="border-l border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Pending Release</p>
          <p className="font-display font-black text-2xl text-indigo-600 mt-1">{headcount.pending}</p>
        </div>
        <div className="border-l border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Salary On Hold</p>
          <p className="font-display font-black text-2xl text-amber-500 mt-1">{headcount.onHold}</p>
        </div>
        <div className="border-l border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Failed Payments</p>
          <p className="font-display font-black text-2xl text-rose-600 mt-1">{headcount.failedPayments}</p>
        </div>
        <div className="border-l border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Missing Bank</p>
          <p className="font-display font-black text-2xl text-rose-600 mt-1">{headcount.missingBank}</p>
        </div>
        <div className="border-l border-slate-100">
          <p className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Pending Approvals</p>
          <p className="font-display font-black text-2xl text-indigo-500 mt-1">{headcount.pendingApprovals}</p>
        </div>
      </div>

      {/* Row: Payroll Calendar & Workflow Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll Calendar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Annual Payroll Calendar</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {calendarPeriods.map(p => (
              <div key={p.name} className={`p-3 rounded-2xl border text-center space-y-1.5 ${p.color}`}>
                <p className="font-bold text-slate-800 text-[11px]">{p.name}</p>
                <span className="inline-block text-[8px] font-black uppercase tracking-wider">{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Approval Monitor */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Approval Workflow Pipeline</h3>
          <div className="flex items-center justify-between gap-1 flex-wrap font-mono text-[9.5px]">
            {workflowSteps.map((step, idx) => (
              <React.Fragment key={step.name}>
                <div className={`p-2.5 rounded-xl border flex flex-col items-center text-center space-y-1 ${
                  step.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold' :
                  step.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100 font-bold' :
                  'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  <span className="font-sans font-extrabold text-[10px] text-slate-800 block">{step.name}</span>
                  <span className="text-[8px] block opacity-85">{step.role} — {step.time}</span>
                </div>
                {idx < workflowSteps.length - 1 && <ArrowRight size={10} className="text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left pane: Quick Actions & Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions Console */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Operations Console</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button 
                onClick={() => onNavigateToTab('runs')}
                className="p-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl flex flex-col items-start gap-2.5 transition-all text-xs font-black text-left shadow-2xs group cursor-pointer"
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Play size={15} />
                </div>
                <div>
                  <p className="text-slate-800">Generate Run</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 font-normal">Calculate employee statements.</p>
                </div>
              </button>

              <button 
                onClick={() => onNavigateToTab('runs')}
                className="p-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl flex flex-col items-start gap-2.5 transition-all text-xs font-black text-left shadow-2xs group cursor-pointer"
              >
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl group-hover:bg-cyan-600 group-hover:text-white transition-all">
                  <RefreshCw size={15} />
                </div>
                <div>
                  <p className="text-slate-800">Simulate Payroll</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 font-normal">Database-free transactional test.</p>
                </div>
              </button>

              <button 
                onClick={() => onNavigateToTab('payments')}
                className="p-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl flex flex-col items-start gap-2.5 transition-all text-xs font-black text-left shadow-2xs group cursor-pointer"
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <p className="text-slate-800">Treasury Payments</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 font-normal">Release bank disbursement batches.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Attention / Warnings Hub */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Attention Required</h3>
            <div className="space-y-2.5 text-xs font-semibold">
              {warnings.map(warn => (
                <div key={warn.id} className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg shrink-0 ${warn.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                      <AlertTriangle size={14} />
                    </div>
                    <span className="text-slate-700 leading-snug">{warn.text}</span>
                  </div>
                  <button 
                    onClick={() => onNavigateToTab(warn.tab)}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black text-slate-700 transition-all shadow-3xs flex items-center gap-1 self-end sm:self-center cursor-pointer"
                  >
                    {warn.actionText} <ArrowRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right pane: Recent Audit Feeds */}
        <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center justify-between">
            <span>Recent Activity Feed</span>
            <Clock size={14} className="text-slate-400" />
          </h3>
          <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-6 text-xs font-semibold">
            {recentActivities.map(act => (
              <div key={act.id} className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                <p className="text-[10px] text-slate-400 font-bold">{act.time} — {act.user}</p>
                <p className="text-slate-600 mt-1 font-normal leading-relaxed">{act.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
