import React, { useState, useEffect, Suspense, lazy } from 'react';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  Activity, Sliders, Briefcase, BarChart2, ShieldCheck, Layers,
  UserCheck, Bell, Search, Info, ShieldAlert, ArrowRight, X, Sparkles
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

// Lazily load each sub-workspace to maximize startup responsiveness
const PayrollDashboard = lazy(() => import('./PayrollDashboard'));
const PayrollProcessing = lazy(() => import('./PayrollProcessing'));
const PayrollEmployees = lazy(() => import('./PayrollEmployees'));
const PayrollConfiguration = lazy(() => import('./PayrollConfiguration'));
const PayrollPayments = lazy(() => import('./PayrollPayments'));
const PayrollReports = lazy(() => import('./PayrollReports'));

export default function PayrollPage() {
  const { activeCompany } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | processing | employees | configuration | payments | reports
  const [paymentsInitialTab, setPaymentsInitialTab] = useState('individual');
  const [userRole, setUserRole] = useState('HR Manager'); // HR Officer | HR Manager | Finance | Treasury | Auditor
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Syncing payroll workspace...');

  const triggerTransition = (tabId) => {
    let text = 'Syncing payroll workspace...';
    const cleanId = tabId.split('-')[0];
    if (cleanId === 'dashboard') text = 'Loading dashboard KPIs...';
    else if (cleanId === 'processing') text = 'Initializing payroll engine...';
    else if (cleanId === 'employees') text = 'Loading employee directories...';
    else if (cleanId === 'payments') text = 'Verifying ledger disbursements...';
    else if (cleanId === 'reports') text = 'Compiling financial registers...';
    else if (cleanId === 'configuration') text = 'Syncing structural configuration...';

    setLoadingText(text);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 450);
  };

  const handleNavigateToTab = (tabId) => {
    triggerTransition(tabId);
    if (tabId === 'payments-reconciliation') {
      setPaymentsInitialTab('reconciliation');
      setActiveTab('payments');
    } else {
      setPaymentsInitialTab('individual');
      setActiveTab(tabId);
    }
  };
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await api.get(`/notifications/${activeCompany.id}`);
      const list = res.data || [];
      const mapped = list
        .map(n => ({
          id: n.id,
          text: n.message || n.title,
          time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: n.is_read
        }))
        .filter(n => {
          const txt = n.text.toLowerCase();
          return txt.includes('payroll') || 
                 txt.includes('payslip') || 
                 txt.includes('disbursement') || 
                 txt.includes('employee') || 
                 txt.includes('salary') || 
                 txt.includes('payout') || 
                 txt.includes('loan') || 
                 txt.includes('leave') || 
                 txt.includes('attendance') ||
                 txt.includes('hr');
        });
      setNotifications(mapped);
    } catch (err) {
      console.error('Failed to fetch real-time notifications for bell icon:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeCompany?.id]);

  // Global search state
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState({
    employees: [],
    runs: [],
    journals: [],
    payments: []
  });

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'processing', label: 'Payroll Processing', icon: Activity },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'payments', label: 'Payments', icon: Landmark },
    { id: 'reports', label: 'Reports & Compliance', icon: BarChart2 },
    { id: 'configuration', label: 'Settings', icon: Sliders },
  ];

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + G -> Go to Payroll Processing
      if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setActiveTab('processing');
      }
      // Ctrl + R -> Go to Reports
      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setActiveTab('reports');
      }
      // Ctrl + F -> Focus search
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global search executor
  const handleGlobalSearch = async (val) => {
    setSearchTerm(val);
    if (!val.trim()) {
      setSearchResults({ employees: [], runs: [], journals: [], payments: [] });
      return;
    }
    
    try {
      // Query runs and employees to filter matching names/codes in real-time
      const [runsRes, empRes] = await Promise.all([
        api.get(`/payroll/${activeCompany?.id}/reports/register`),
        api.get(`/employees/${activeCompany?.id}`)
      ]);

      const term = val.toLowerCase();
      const allRuns = runsRes.data || [];
      const allEmps = empRes.data || [];

      setSearchResults({
        employees: allEmps.filter(e => e.name.toLowerCase().includes(term) || e.department?.toLowerCase().includes(term)),
        runs: allRuns.filter(r => r.period.includes(term) || r.status.toLowerCase().includes(term)),
        journals: allRuns.filter(r => r.journal_entry_id && `JV-00${r.journal_entry_id}`.toLowerCase().includes(term)).map(r => ({ id: r.journal_entry_id, period: r.period })),
        payments: allRuns.filter(r => `PAY-${r.id}`.toLowerCase().includes(term))
      });
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const getBreadcrumb = () => {
    const activeLabel = tabs.find(t => t.id === activeTab)?.label || 'Workspace';
    return (
      <nav className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
        <span>Payroll</span>
        <ChevronRight size={10} />
        <span className="text-indigo-600">{activeLabel}</span>
      </nav>
    );
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-[1600px] mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#FAFBFD] via-[#FAF9F8] to-[#F5FAF8] space-y-6">
      
      {/* Global Search Dialog Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl max-w-xl w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="font-black text-slate-800 text-sm flex items-center gap-1.5"><Search size={14} /> Global Enterprise Search</span>
              <button onClick={() => { setShowSearchModal(false); setSearchTerm(''); }} className="text-slate-400 hover:text-slate-600">
                <X size={15} />
              </button>
            </div>
            
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={searchTerm}
                onChange={e => handleGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                placeholder="Search employees, runs (e.g. 2026-08), JV vouchers, payments..."
              />
            </div>

            {/* Results Grid */}
            <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-4 pr-1 text-xs">
              {searchResults.employees.length > 0 && (
                <div>
                  <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Employees</h5>
                  <div className="space-y-1">
                    {searchResults.employees.map(e => (
                      <div 
                        key={e.id} 
                        onClick={() => { setActiveTab('employees'); setShowSearchModal(false); }}
                        className="p-2 hover:bg-slate-50 rounded-lg flex justify-between items-center cursor-pointer border border-transparent hover:border-slate-100 font-semibold"
                      >
                        <span className="text-slate-700">{e.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{e.department} — {e.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.runs.length > 0 && (
                <div>
                  <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Payroll Runs</h5>
                  <div className="space-y-1">
                    {searchResults.runs.map(r => (
                      <div 
                        key={r.id} 
                        onClick={() => { setActiveTab('processing'); setShowSearchModal(false); }}
                        className="p-2 hover:bg-slate-50 rounded-lg flex justify-between items-center cursor-pointer border border-transparent hover:border-slate-100 font-semibold"
                      >
                        <span className="text-slate-700">Period {r.period}</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-black border border-indigo-100 text-[9px] uppercase">{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.journals.length > 0 && (
                <div>
                  <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Journals & Vouchers</h5>
                  <div className="space-y-1">
                    {searchResults.journals.map(j => (
                      <div 
                        key={j.id} 
                        onClick={() => { setActiveTab('reports'); setShowSearchModal(false); }}
                        className="p-2 hover:bg-slate-50 rounded-lg flex justify-between items-center cursor-pointer border border-transparent hover:border-slate-100 font-semibold"
                      >
                        <span className="text-indigo-650 font-bold font-mono">JV-00{j.id}</span>
                        <span className="text-[10px] text-slate-400 font-normal">Payroll Period {j.period}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchTerm && Object.values(searchResults).every(arr => arr.length === 0) && (
                <div className="p-8 text-center text-slate-400 font-bold">
                  No matching records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs Navigation */}
      {getBreadcrumb()}

      {/* Top Banner Orchestrator */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
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

        {/* Dynamic Search, Notifications, and Tabs */}
        <div className="flex flex-wrap items-center gap-4 relative">
          {/* Global Search trigger bar */}
          <button 
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 bg-white px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-3xs text-[11px] cursor-pointer"
          >
            <Search size={13} />
            <span>Search (Ctrl+F)</span>
          </button>

          {/* Notifications Center Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-700 transition-all shadow-3xs cursor-pointer"
            >
              <Bell size={14} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 space-y-3 text-xs font-semibold animate-in fade-in-5 duration-100">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-black text-slate-800 text-[11px] uppercase tracking-wider">Notification Center</span>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                </div>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {notifications.map(n => (
                    <div key={n.id} className="flex gap-2 items-start leading-snug">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${n.read ? 'bg-slate-300' : 'bg-indigo-600'}`} />
                      <div>
                        <p className={`${n.read ? 'text-slate-400 font-normal' : 'text-slate-700 font-bold'}`}>{n.text}</p>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{n.time}</span>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-slate-400 text-center py-4">No active payroll alerts.</p>
                  )}
                </div>
              </div>
            )}
          </div>

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

          <div className="flex items-center gap-1.5 bg-slate-200/40 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto hide-scrollbar whitespace-nowrap">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerTransition(tab.id);
                    setPaymentsInitialTab('individual');
                    setActiveTab(tab.id);
                  }}
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

      {/* Shortcuts Help Bar */}
      <div className="bg-slate-100/50 p-2 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-400 flex gap-4 justify-center items-center flex-wrap uppercase">
        <span>Shortcuts:</span>
        <span><kbd className="bg-white px-1.5 py-0.5 rounded border shadow-3xs font-bold text-slate-600">Ctrl+F</kbd> Search</span>
        <span><kbd className="bg-white px-1.5 py-0.5 rounded border shadow-3xs font-bold text-slate-600">Ctrl+G</kbd> Processing Wizard</span>
        <span><kbd className="bg-white px-1.5 py-0.5 rounded border shadow-3xs font-bold text-slate-600">Ctrl+R</kbd> Reports</span>
      </div>

      {/* Lazily Mounted Sub-Workspace Panel */}
      <div className="min-h-[500px] relative">
        {isLoading ? (
          <div className="flex min-h-[400px] w-full items-center justify-center py-16 animate-in fade-in duration-200">
            <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-3xl p-8 flex flex-col items-center shadow-xl shadow-slate-900/5 max-w-sm w-full mx-4">
              <div className="relative w-12 h-12 mb-4 animate-in zoom-in duration-300">
                {/* Outer glowing pulsing ring */}
                <div className="absolute inset-0 rounded-full border-[3px] border-emerald-500/20 animate-pulse"></div>
                {/* Inner rotating gradient arc */}
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-600 border-r-emerald-600 animate-spin"></div>
              </div>
              <h2 className="text-[14px] font-black text-slate-950 tracking-tight font-mono">S A R F I S</h2>
              <p className="mt-2 text-slate-500 text-[11px] font-medium tracking-wide">{loadingText}</p>
            </div>
          </div>
        ) : (
          <Suspense fallback={
            <div className="p-16 text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
              <p className="text-slate-400 text-xs font-semibold">Loading payroll sub-workspace...</p>
            </div>
          }>
            {activeTab === 'dashboard' && <PayrollDashboard onNavigateToTab={handleNavigateToTab} userRole={userRole} />}
            {activeTab === 'processing' && <PayrollProcessing userRole={userRole} onBackToDashboard={() => handleNavigateToTab('dashboard')} onNavigateToTab={handleNavigateToTab} />}
            {activeTab === 'employees' && <PayrollEmployees userRole={userRole} onBackToDashboard={() => handleNavigateToTab('dashboard')} />}
            {activeTab === 'configuration' && <PayrollConfiguration userRole={userRole} />}
            {activeTab === 'payments' && <PayrollPayments userRole={userRole} initialTab={paymentsInitialTab} onBackToDashboard={() => handleNavigateToTab('dashboard')} />}
            {activeTab === 'reports' && <PayrollReports userRole={userRole} />}
          </Suspense>
        )}
      </div>
    </div>
  );
}

function ChevronRight({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
  );
}
