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

      {/* Premium Redesigned Header Container */}
      <div className="w-full bg-slate-900 text-white rounded-3xl p-6 shadow-2xl shadow-slate-900/10 border border-slate-800/80 relative overflow-hidden space-y-6">
        {/* Background Ambient Glow Accents */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row: Branding, Status, Search, Controls & Primary Action */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Left: Branding & Subtitle */}
          <div className="flex items-start md:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-0.5 shadow-xl shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Users size={22} className="stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display font-black text-xl md:text-2xl tracking-tight text-white uppercase">
                  Payroll Workspace
                </h1>
                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Operational Lifecycle
                </div>
              </div>
              <p className="text-slate-400 text-xs md:text-sm font-medium mt-1 max-w-xl">
                Manage salary components, structural formula rules, payments release, and audit-compliant reporting.
              </p>
            </div>
          </div>

          {/* Right: Controls (Search, Bell, Persona Switcher, Primary Action) */}
          <div className="flex flex-wrap items-center gap-3 relative z-20">
            {/* Search Trigger */}
            <button 
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-inner cursor-pointer"
            >
              <Search size={14} className="text-emerald-400" />
              <span>Search</span>
              <kbd className="hidden sm:inline-block bg-slate-900 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">Ctrl+F</kbd>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer relative"
              >
                <Bell size={16} className="text-emerald-400" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-slate-900">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-4 z-50 space-y-3 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                    <span className="font-black text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <Bell size={13} className="text-emerald-400" /> Notification Center
                    </span>
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                  </div>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {notifications.map(n => (
                      <div key={n.id} className="flex gap-2.5 items-start leading-snug p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-600' : 'bg-emerald-400'}`} />
                        <div>
                          <p className={`${n.read ? 'text-slate-400 font-normal' : 'text-slate-200 font-bold'}`}>{n.text}</p>
                          <span className="text-[10px] text-slate-400 font-mono block mt-1">{n.time}</span>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-slate-400 text-center py-6">No active payroll alerts.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Persona / Role Selector */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-2 rounded-xl text-xs">
              <UserCheck size={14} className="text-emerald-400 shrink-0" />
              <select
                value={userRole}
                onChange={e => setUserRole(e.target.value)}
                className="text-[11px] font-bold uppercase text-slate-200 bg-transparent border-none outline-none cursor-pointer focus:ring-0"
              >
                <option value="HR Officer" className="bg-slate-900 text-white">HR Officer</option>
                <option value="HR Manager" className="bg-slate-900 text-white">HR Manager (Admin)</option>
                <option value="Finance" className="bg-slate-900 text-white">Finance Director</option>
                <option value="Treasury" className="bg-slate-900 text-white">Treasury Officer</option>
                <option value="Auditor" className="bg-slate-900 text-white">Auditor (Read Only)</option>
              </select>
            </div>

            {/* Primary Action Button (1-Click Rule) */}
            <button
              onClick={() => handleNavigateToTab('processing')}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all cursor-pointer transform active:scale-95"
            >
              <Sparkles size={14} className="fill-slate-950" />
              <span>Process Payroll</span>
            </button>
          </div>
        </div>

        {/* Bottom Navigation Segmented Tabs & Shortcuts Row */}
        <div className="relative z-10 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto custom-scrollbar whitespace-nowrap">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerTransition(tab.id);
                    setPaymentsInitialTab('individual');
                    setActiveTab(tab.id);
                  }}
                  className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[11px] font-black flex items-center gap-2 cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-slate-950' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Keyboard Shortcuts Hints */}
          <div className="hidden xl:flex items-center gap-4 text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 font-bold">Shortcuts:</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 font-bold">Ctrl+F</kbd> Search</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 font-bold">Ctrl+G</kbd> Engine Wizard</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 font-bold">Ctrl+R</kbd> Reports</span>
          </div>
        </div>
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
              <h2 className="text-[13px] font-black text-slate-950 tracking-widest font-sans uppercase">A C C O U N T E L L E N C E</h2>
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
