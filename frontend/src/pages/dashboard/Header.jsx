import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, ChevronDown, Building2, Menu, User, Plus,
  HelpCircle, Calendar, LogOut, Settings, FilePlus, BookOpen,
  Truck, Users, ChevronRight, CheckSquare, Lock, Unlock,
  ShieldAlert, Clock, Database, FileText, KeyRound, History,
  RefreshCw, CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePeriodStore, { MONTHS } from '../../store/periodStore';
import { resolveBreadcrumb } from './headerRoutes';

const PBI = {
  blue: '#059669',
  cyan: '#0891b2',
  navy: '#060d24',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#475569',
  dim: '#94a3b8',
  surface: '#f8fafc',
  soft: '#ecfdf5',
};

const CREATE_ACTIONS = [
  { label: 'Journal Entry', desc: 'Post manual journal', icon: BookOpen, to: '/dashboard/journal', color: PBI.blue },
  { label: 'ERP Voucher', desc: 'Sales, purchase, payment', icon: FilePlus, to: '/dashboard/vouchers', color: PBI.cyan },
  { label: 'Delivery Order', desc: 'New distribution order', icon: Truck, to: '/dashboard/distribution', color: '#f59e0b' },
  { label: 'Add Client', desc: 'Distribution client', icon: Users, to: '/dashboard/distribution', color: '#10b981' },
];

function HeaderDropdown({ open, onClose, align = 'right', children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          ref={ref}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.14 }}
          className={`absolute top-full mt-1.5 bg-white rounded-lg border overflow-hidden z-50 shadow-[0_6.4px_14.4px_rgba(0,0,0,.11)] ${align === 'right' ? 'right-0' : 'left-0'} ${className}`}
          style={{ borderColor: PBI.border, boxShadow: '0 12px 30px rgba(15,23,42,0.12)' }}
        >
          {children}
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Header({ sidebarCollapsed, isMobile, onMenuToggle, searchQuery, onSearchChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, companies, activeCompany, setActiveCompany, logout } = useAuthStore();
  const { month, year, initForCompany, setPeriod } = usePeriodStore();

  const [menuState, setMenuState] = useState({ key: null, pathname: location.pathname });
  const searchRef = useRef(null);

  // Core visual parameters
  const leftOffset = isMobile ? 0 : (sidebarCollapsed ? 68 : 248);
  const crumb = resolveBreadcrumb(location.pathname);
  const periodLabel = `${MONTHS[month - 1] || 'Period'} ${year}`;
  const openMenu = menuState.pathname === location.pathname ? menuState.key : null;

  // Multi-entity and RBAC definitions
  const userPerms = useAuthStore(state => state.permissions) || [];
  const isSuperAdmin = user?.role === 'Super Admin';
  const effectiveRole = activeCompany?.user_role || user?.role || 'Member';
  const adminRoles = ['Company Admin', 'Super Admin', 'Admin', 'Owner', 'CEO'];
  const canAdmin = adminRoles.includes(effectiveRole) || adminRoles.includes(user?.role);

  // Approvals RBAC permissions check
  const canApproveJournals = isSuperAdmin || userPerms.includes('journal.post') || userPerms.includes('journal.approve');
  const canApproveVouchers = isSuperAdmin || userPerms.includes('voucher.post') || userPerms.includes('voucher.approve');
  const hasApprovalAccess = canApproveJournals || canApproveVouchers;

  // State hooks for accounting data
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [approvals, setApprovals] = useState({ pendingJournals: [], pendingVouchers: [] });
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const closeAll = useCallback(() => {
    setMenuState({ key: null, pathname: location.pathname });
  }, [location.pathname]);

  const toggle = (key) => {
    setMenuState((menu) => ({
      key: menu.pathname === location.pathname && menu.key === key ? null : key,
      pathname: location.pathname,
    }));
    setFeedback(null);
  };

  // 1. Fetch periods for status checks
  const fetchPeriods = useCallback(async () => {
    if (!activeCompany?.id) return;
    setPeriodsLoading(true);
    try {
      const res = await api.get(`/periods/${activeCompany.id}`, {
        headers: { 'x-company-id': String(activeCompany.id) }
      });
      setPeriods(res.data || []);
    } catch (err) {
      console.error('Failed to fetch periods in header:', err);
    } finally {
      setPeriodsLoading(false);
    }
  }, [activeCompany?.id]);

  // 2. Fetch pending approvals (Journals and Vouchers)
  const fetchApprovals = useCallback(async () => {
    if (!activeCompany?.id || !hasApprovalAccess) return;
    setApprovalsLoading(true);
    try {
      const res = await api.get(`/admin/companies/${activeCompany.id}/approvals`, {
        headers: { 'x-company-id': String(activeCompany.id) }
      });
      setApprovals(res.data || { pendingJournals: [], pendingVouchers: [] });
    } catch (err) {
      console.error('Failed to fetch approvals in header:', err);
    } finally {
      setApprovalsLoading(false);
    }
  }, [activeCompany?.id, hasApprovalAccess]);

  useEffect(() => {
    if (activeCompany?.id) {
      initForCompany(activeCompany.id);
      fetchPeriods();
      fetchApprovals();
    }
  }, [activeCompany?.id, initForCompany, fetchPeriods, fetchApprovals]);

  // Refetch approvals when location changes to keep badge synced with user creations
  useEffect(() => {
    fetchApprovals();
  }, [location.pathname, fetchApprovals]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeAll]);

  // Derived accounting period information
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentPeriodName = `${monthNames[month - 1]} ${year}`;
  const currentPeriod = periods.find(p => p.period_name === currentPeriodName);
  const isPeriodClosed = currentPeriod?.status === 'CLOSED';
  const periodStatusText = currentPeriod ? currentPeriod.status : 'OPEN';

  // Toggle accounting period lock status
  const handleTogglePeriod = async () => {
    if (!canAdmin || !activeCompany?.id || !currentPeriod) return;
    setActionSaving(true);
    setFeedback(null);
    const nextStatus = currentPeriod.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      await api.patch(`/periods/${activeCompany.id}/${currentPeriod.id}`, { status: nextStatus }, {
        headers: { 'x-company-id': String(activeCompany.id) }
      });
      await fetchPeriods();
      setFeedback({ type: 'success', text: `Period status successfully updated to ${nextStatus}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to update period status.' });
    } finally {
      setActionSaving(false);
    }
  };

  // Seed selected monthly period in database
  const handleSeedPeriod = async () => {
    if (!canAdmin || !activeCompany?.id) return;
    setActionSaving(true);
    setFeedback(null);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      await api.post(`/periods/${activeCompany.id}`, {
        periodName: currentPeriodName,
        startDate,
        endDate,
        status: 'OPEN'
      }, {
        headers: { 'x-company-id': String(activeCompany.id) }
      });
      await fetchPeriods();
      setFeedback({ type: 'success', text: 'Period successfully initialized.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to seed period.' });
    } finally {
      setActionSaving(false);
    }
  };

  // Approve and post vouchers to General Ledger
  const handleApproveVoucher = async (voucherId) => {
    if (!activeCompany?.id) return;
    setActionSaving(true);
    setFeedback(null);
    try {
      await api.post(`/vouchers/${activeCompany.id}/${voucherId}/post`, {}, {
        headers: { 'x-company-id': String(activeCompany.id) }
      });
      await fetchApprovals();
      setFeedback({ type: 'success', text: 'Voucher posted successfully to General Ledger.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to post voucher.' });
    } finally {
      setActionSaving(false);
    }
  };

  // Approve and post manual journal entries
  const handleApproveJournal = async (journalId) => {
    if (!activeCompany?.id) return;
    setActionSaving(true);
    setFeedback(null);
    try {
      await api.post(`/journal/${journalId}/post`, {}, {
        headers: { 'x-company-id': String(activeCompany.id) }
      });
      await fetchApprovals();
      setFeedback({ type: 'success', text: 'Journal entry posted successfully to General Ledger.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to post journal entry.' });
    } finally {
      setActionSaving(false);
    }
  };

  const handleLogout = () => {
    closeAll();
    logout();
    navigate('/login');
  };

  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);
  const totalPendingCount = (approvals.pendingJournals?.length || 0) + (approvals.pendingVouchers?.length || 0);

  return (
    <header
      className="fixed top-0 right-0 z-40 flex items-center gap-3 px-4 lg:px-5"
      style={{
        left: leftOffset,
        height: 60,
        background: 'rgba(255,255,255,0.96)',
        borderBottom: `1px solid ${PBI.border}`,
        boxShadow: '0 1px 0 rgba(15,23,42,0.02)',
        transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Left: menu + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-md transition-colors hover:bg-emerald-50 flex-shrink-0"
          aria-label="Toggle menu"
        >
          <Menu size={18} style={{ color: PBI.muted }} />
        </button>

        <nav className="hidden sm:flex items-center gap-1 min-w-0 text-[12px]" aria-label="Breadcrumb">
          <span className="font-semibold text-emerald-600 shrink-0">SARFIS</span>
          {crumb.section && (
            <>
              <ChevronRight size={12} className="text-slate-300 shrink-0" />
              <span className="text-slate-400 truncate max-w-[100px]">{crumb.section}</span>
            </>
          )}
          <ChevronRight size={12} className="text-slate-300 shrink-0" />
          <span className="font-semibold truncate max-w-[140px] lg:max-w-[200px]" style={{ color: PBI.text }}>
            {crumb.title}
          </span>
        </nav>

        <span className="sm:hidden font-semibold text-[13px] truncate max-w-[120px]" style={{ color: PBI.text }}>
          {crumb.title}
        </span>
      </div>

      {/* Center: global search */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: PBI.dim }} />
          <input
            ref={searchRef}
            className="w-full rounded-md py-2 text-[13px] outline-none transition-colors focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5"
            style={{
              background: PBI.surface,
              border: `1px solid ${PBI.border}`,
              paddingLeft: 34,
              paddingRight: 72,
              color: PBI.text,
            }}
            placeholder="Search accounts, journals, clients…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <kbd
            className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ color: PBI.muted, background: '#fff', border: `1px solid ${PBI.border}` }}
          >
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right: period, create, company, approvals, help, bell, gear, user */}
      <div className="flex items-center gap-1.5 lg:gap-2 ml-auto flex-shrink-0">
        
        {/* 1. Accounting period Selector with lock badge status (Sage 50 Style) */}
        <div className="relative">
          <button
            onClick={() => toggle('period')}
            className="flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors hover:bg-emerald-50 border bg-slate-50/50"
            style={{ color: PBI.text, borderColor: PBI.border }}
          >
            <Calendar size={13} style={{ color: PBI.blue }} />
            <span className="hidden sm:inline">{periodLabel}</span>
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border ${
              isPeriodClosed 
                ? 'bg-rose-50 text-rose-700 border-rose-100' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              {periodStatusText}
            </span>
            <ChevronDown size={11} style={{ color: PBI.dim }} />
          </button>
          
          <HeaderDropdown open={openMenu === 'period'} onClose={closeAll} className="w-60">
            <div className="px-3 py-2 border-b bg-slate-50/50" style={{ borderColor: PBI.border }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PBI.blue }}>Fiscal Period Details</p>
              <p className="text-[12px] font-black text-slate-800 mt-0.5">{periodLabel} Status</p>
            </div>
            
            <div className="p-3.5 space-y-3">
              {/* Period Date boundaries */}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] space-y-1 font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Start Date:</span>
                  <span className="font-mono text-slate-900">{currentPeriod ? new Date(currentPeriod.start_date).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>End Date:</span>
                  <span className="font-mono text-slate-900">{currentPeriod ? new Date(currentPeriod.end_date).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'N/A'}</span>
                </div>
                <div className="h-px bg-slate-200/50 my-1" />
                <div className="flex justify-between text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  <span>Fiscal Bounds:</span>
                  <span>Jan 1 – Dec 31</span>
                </div>
              </div>

              {feedback && (
                <div className={`p-2 rounded text-[11px] font-semibold border ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'}`}>
                  {feedback.text}
                </div>
              )}

              {/* Month/Year selectors */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Month</span>
                  <select
                    value={month}
                    onChange={(e) => setPeriod(+e.target.value, year, activeCompany?.id)}
                    className="mt-1 w-full rounded-md px-1.5 py-1.5 text-[12px] outline-none bg-white font-semibold border"
                    style={{ borderColor: PBI.border, color: PBI.text }}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Year</span>
                  <select
                    value={year}
                    onChange={(e) => setPeriod(month, +e.target.value, activeCompany?.id)}
                    className="mt-1 w-full rounded-md px-1.5 py-1.5 text-[12px] outline-none bg-white font-semibold border"
                    style={{ borderColor: PBI.border, color: PBI.text }}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Lock controls - Admin only */}
              {canAdmin && (
                <div className="pt-2 border-t" style={{ borderColor: PBI.border }}>
                  {currentPeriod ? (
                    <button
                      onClick={handleTogglePeriod}
                      disabled={actionSaving}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold transition-all border ${
                        isPeriodClosed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {actionSaving ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : isPeriodClosed ? (
                        <><Unlock size={12} /> Unlock Fiscal Period</>
                      ) : (
                        <><Lock size={12} /> Lock Fiscal Period</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSeedPeriod}
                      disabled={actionSaving}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold bg-[#EBFDF5] text-emerald-800 border border-[#C2F3DC] hover:bg-[#d5f7e6] transition-all"
                    >
                      {actionSaving ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <><Plus size={12} /> Initialize Fiscal Period</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </HeaderDropdown>
        </div>

        {/* + Create Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => toggle('create')}
            className="flex items-center gap-1 px-2.5 lg:px-3 py-1.5 rounded-md text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${PBI.blue}, ${PBI.cyan})`, boxShadow: '0 6px 18px rgba(5,150,105,0.22)' }}
          >
            <Plus size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown size={12} className="hidden sm:block opacity-80" />
          </button>
          <HeaderDropdown open={openMenu === 'create'} onClose={closeAll} className="w-64">
            <div className="px-3 py-2 border-b" style={{ borderColor: PBI.border }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PBI.blue }}>Quick create</p>
            </div>
            {CREATE_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => { navigate(action.to); closeAll(); }}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-emerald-50/50"
              >
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${action.color}18` }}>
                  <action.icon size={14} style={{ color: action.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold" style={{ color: PBI.text }}>{action.label}</p>
                  <p className="text-[10px]" style={{ color: PBI.dim }}>{action.desc}</p>
                </div>
              </button>
            ))}
          </HeaderDropdown>
        </div>

        {/* Company Switcher Dropdown */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => toggle('company')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-emerald-50 max-w-[160px]"
            style={{ border: `1px solid ${PBI.border}`, color: PBI.text }}
          >
            <Building2 size={13} style={{ color: PBI.blue }} />
            <span className="truncate">{activeCompany?.name || 'Select company'}</span>
            <ChevronDown size={12} style={{ color: PBI.dim }} className="flex-shrink-0" />
          </button>
          <HeaderDropdown open={openMenu === 'company'} onClose={closeAll} className="w-56">
            <div className="px-3 py-2 border-b" style={{ borderColor: PBI.border }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PBI.blue }}>Switch company</p>
            </div>
            {(companies?.length ? companies : []).map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveCompany(c); initForCompany(c.id); closeAll(); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[12px] transition-colors hover:bg-emerald-50/50"
                style={{ color: activeCompany?.id === c.id ? PBI.blue : PBI.text, fontWeight: activeCompany?.id === c.id ? 600 : 400 }}
              >
                <span className="truncate">{c.name}</span>
                {activeCompany?.id === c.id && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PBI.blue }} />}
              </button>
            ))}
            {!companies?.length && (
              <p className="px-3 py-4 text-[12px]" style={{ color: PBI.dim }}>No companies available</p>
            )}
          </HeaderDropdown>
        </div>

        {/* 2. Approvals Inbox Dropdown (ERP 4-Eyes Control) */}
        {hasApprovalAccess && (
          <div className="relative">
            <button
              onClick={() => toggle('approvals')}
              className="relative w-9 h-9 rounded-md flex items-center justify-center transition-colors hover:bg-emerald-50 border border-slate-100"
              aria-label="Approvals queue"
            >
              <CheckSquare size={16} style={{ color: PBI.muted }} />
              {totalPendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-black text-white border-2 border-white">
                  {totalPendingCount}
                </span>
              )}
            </button>

            <HeaderDropdown open={openMenu === 'approvals'} onClose={closeAll} className="w-80">
              <div className="px-4 py-3 border-b bg-slate-50/50" style={{ borderColor: PBI.border }}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Pending Approvals</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center text-[11px] font-bold text-slate-500">
                  <div className="bg-white p-1.5 rounded border">
                    <span className="block text-[14px] font-black text-slate-800">{approvals.pendingJournals?.length || 0}</span>
                    Journals
                  </div>
                  <div className="bg-white p-1.5 rounded border">
                    <span className="block text-[14px] font-black text-slate-800">{approvals.pendingVouchers?.length || 0}</span>
                    Vouchers
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-1.5 rounded text-amber-800">
                    <span className="block text-[14px] font-black">{totalPendingCount}</span>
                    Total
                  </div>
                </div>
              </div>

              {feedback && (
                <div className={`m-3 p-2 rounded text-[11px] font-semibold border ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'}`}>
                  {feedback.text}
                </div>
              )}

              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                {/* Pending Vouchers */}
                {canApproveVouchers && approvals.pendingVouchers?.map((v) => (
                  <div key={v.id} className="p-3 text-[12px] hover:bg-slate-50/50 transition">
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <p className="font-bold text-slate-800">{v.voucher_number}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wide mt-0.5">{v.type} Voucher</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                          Amount: <span className="font-semibold text-slate-700">PKR {parseFloat(v.total_amount).toLocaleString()}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">By: {v.creator_name || 'System'}</p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleApproveVoucher(v.id)}
                          disabled={actionSaving}
                          className="px-2 py-1 rounded bg-[#EBFDF5] text-emerald-800 border border-[#C2F3DC] text-[10px] font-bold hover:bg-[#d5f7e6]"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { navigate('/dashboard/vouchers'); closeAll(); }}
                          className="px-2 py-1 rounded bg-white text-slate-600 border text-[10px] font-bold hover:bg-slate-50"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pending Journals */}
                {canApproveJournals && approvals.pendingJournals?.map((j) => (
                  <div key={j.id} className="p-3 text-[12px] hover:bg-slate-50/50 transition">
                    <div className="flex justify-between items-start gap-1">
                      <div className="min-w-0 flex-1 pr-1">
                        <p className="font-bold text-slate-800 truncate">JE #{j.id} — {j.description}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wide mt-0.5">Manual Journal</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                          Amount: <span className="font-semibold text-slate-700">PKR {parseFloat(j.total_amount).toLocaleString()}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">By: {j.creator_name || 'System'}</p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleApproveJournal(j.id)}
                          disabled={actionSaving}
                          className="px-2 py-1 rounded bg-[#EBFDF5] text-emerald-800 border border-[#C2F3DC] text-[10px] font-bold hover:bg-[#d5f7e6]"
                        >
                          Post GL
                        </button>
                        <button
                          onClick={() => { navigate('/dashboard/ledger'); closeAll(); }}
                          className="px-2 py-1 rounded bg-white text-slate-600 border text-[10px] font-bold hover:bg-slate-50"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {totalPendingCount === 0 && (
                  <div className="p-6 text-center text-slate-500 font-medium">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-[12px]">All transactions posted</p>
                    <p className="text-[10px] text-slate-400 mt-1">Workspace is fully locked and approved.</p>
                  </div>
                )}
              </div>
            </HeaderDropdown>
          </div>
        )}

        {/* Notifications Button */}
        <button
          className="relative w-9 h-9 rounded-md flex items-center justify-center transition-colors hover:bg-emerald-50 border border-slate-100"
          aria-label="Notifications"
        >
          <Bell size={16} style={{ color: PBI.muted }} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white" style={{ background: '#10b981' }} />
        </button>

        {/* 3. QuickBooks-style Admin Gear Menu dropdown */}
        <div className="relative">
          <button
            onClick={() => toggle('gear')}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors border border-slate-100 hover:bg-emerald-50 ${
              openMenu === 'gear' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : ''
            }`}
            aria-label="Admin Tools"
          >
            <Settings size={17} style={{ color: PBI.muted }} />
          </button>
          
          <HeaderDropdown open={openMenu === 'gear'} onClose={closeAll} className="w-80">
            <div className="px-4 py-3 border-b bg-slate-50/50" style={{ borderColor: PBI.border }}>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Settings & Admin Utilities</p>
              <p className="text-[12px] font-black text-slate-800 mt-0.5">Quick Access Tools</p>
            </div>
            
            <div className="p-2.5 grid grid-cols-2 gap-3 text-left">
              {/* Category 1: Company & Access */}
              <div className="col-span-2 px-1.5 pt-1 text-[10px] font-black uppercase tracking-wider text-[#064E3B] opacity-80">
                Company & Access
              </div>
              <button
                onClick={() => { navigate('/dashboard/settings'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-emerald-50 text-emerald-700">
                  <Settings size={13} />
                </div>
                System Settings
              </button>
              
              <button
                onClick={() => { navigate('/dashboard/admin?tab=users'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-emerald-50 text-emerald-700">
                  <Users size={13} />
                </div>
                Company Profile
              </button>

              <button
                onClick={() => { navigate('/dashboard/admin?tab=permissions'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-emerald-50 text-emerald-700">
                  <KeyRound size={13} />
                </div>
                User Permissions
              </button>
              
              {/* Category 2: Data & Maintenance */}
              <div className="col-span-2 px-1.5 pt-2 border-t text-[10px] font-black uppercase tracking-wider text-[#064E3B] opacity-80" style={{ borderColor: PBI.border }}>
                Data & Maintenance
              </div>
              <button
                onClick={() => { navigate('/dashboard/admin?tab=periods'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-cyan-50 text-cyan-700">
                  <Calendar size={13} />
                </div>
                Fiscal Periods
              </button>

              <button
                onClick={() => { navigate('/dashboard/admin?tab=sessions'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-cyan-50 text-cyan-700">
                  <History size={13} />
                </div>
                Audit Logs
              </button>
              
              <button
                onClick={() => { navigate('/dashboard/admin?tab=data'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-cyan-50 text-cyan-700">
                  <Database size={13} />
                </div>
                Backup & Restore
              </button>

              <button
                onClick={() => { navigate('/dashboard/admin?tab=data'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-cyan-50 text-cyan-700">
                  <Plus size={13} />
                </div>
                Import Data
              </button>

              <button
                onClick={() => { navigate('/dashboard/admin?tab=data'); closeAll(); }}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-[12px] text-slate-700 font-semibold"
              >
                <div className="p-1.5 rounded bg-cyan-50 text-cyan-700">
                  <FileText size={13} />
                </div>
                Export Data
              </button>
            </div>
          </HeaderDropdown>
        </div>

        {/* User profile dropdown menu */}
        <div className="relative">
          <button
            onClick={() => toggle('user')}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md transition-colors hover:bg-emerald-50"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${PBI.blue}, ${PBI.cyan})` }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || <User size={14} />}
            </div>
            <span className="hidden xl:block text-[12px] font-semibold max-w-[90px] truncate" style={{ color: PBI.text }}>
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown size={12} className="hidden xl:block" style={{ color: PBI.dim }} />
          </button>
          
          <HeaderDropdown open={openMenu === 'user'} onClose={closeAll} className="w-52">
            <div className="px-3 py-3 border-b" style={{ borderColor: PBI.border }}>
              <p className="text-[13px] font-semibold truncate" style={{ color: PBI.text }}>{user?.name || 'User'}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: PBI.dim }}>{user?.email || ''}</p>
              {user?.role && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide" style={{ background: PBI.soft, color: PBI.blue }}>
                  {user.role}
                </span>
              )}
            </div>
            <button
              onClick={() => { navigate('/dashboard/settings'); closeAll(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] hover:bg-emerald-50/50"
              style={{ color: PBI.text }}
            >
              <Settings size={14} style={{ color: PBI.muted }} /> Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] hover:bg-[#fde7e9] border-t"
              style={{ color: '#E81123', borderColor: PBI.border }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </HeaderDropdown>
        </div>
      </div>
    </header>
  );
}
