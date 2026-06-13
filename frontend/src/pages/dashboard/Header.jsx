import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, ChevronDown, Building2, Menu, User, Plus,
  HelpCircle, Calendar, LogOut, Settings, FilePlus, BookOpen,
  Truck, Users, ChevronRight,
} from 'lucide-react';
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

  const leftOffset = isMobile ? 0 : (sidebarCollapsed ? 68 : 248);
  const crumb = resolveBreadcrumb(location.pathname);
  const periodLabel = `${MONTHS[month - 1] || 'Period'} ${year}`;
  const openMenu = menuState.pathname === location.pathname ? menuState.key : null;

  const closeAll = useCallback(() => {
    setMenuState({ key: null, pathname: location.pathname });
  }, [location.pathname]);
  const toggle = (key) => {
    setMenuState((menu) => ({
      key: menu.pathname === location.pathname && menu.key === key ? null : key,
      pathname: location.pathname,
    }));
  };

  useEffect(() => {
    if (activeCompany?.id) initForCompany(activeCompany.id);
  }, [activeCompany?.id, initForCompany]);

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

  const handleLogout = () => {
    closeAll();
    logout();
    navigate('/login');
  };

  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);

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

      {/* Right: period, create, company, help, bell, user */}
      <div className="flex items-center gap-1.5 lg:gap-2 ml-auto flex-shrink-0">
        {/* Accounting period */}
        <div className="relative">
          <button
            onClick={() => toggle('period')}
            className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors hover:bg-emerald-50"
            style={{ color: PBI.text, border: `1px solid ${PBI.border}`, background: PBI.surface }}
          >
            <Calendar size={13} style={{ color: PBI.blue }} />
            <span className="hidden sm:inline">{periodLabel}</span>
            <ChevronDown size={12} style={{ color: PBI.dim }} />
          </button>
          <HeaderDropdown open={openMenu === 'period'} onClose={closeAll} className="w-52">
            <div className="px-3 py-2 border-b" style={{ borderColor: PBI.border }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PBI.blue }}>Accounting period</p>
              <p className="text-[12px] font-semibold mt-0.5" style={{ color: PBI.text }}>{periodLabel}</p>
            </div>
            <div className="p-3 space-y-2">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: PBI.dim }}>Month</span>
                <select
                  value={month}
                  onChange={(e) => setPeriod(+e.target.value, year, activeCompany?.id)}
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-[12px] outline-none"
                  style={{ border: `1px solid ${PBI.border}`, color: PBI.text }}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: PBI.dim }}>Year</span>
                <select
                  value={year}
                  onChange={(e) => setPeriod(month, +e.target.value, activeCompany?.id)}
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-[12px] outline-none"
                  style={{ border: `1px solid ${PBI.border}`, color: PBI.text }}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
          </HeaderDropdown>
        </div>

        {/* + Create */}
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

        {/* Company switcher */}
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

        {/* Help */}
        <div className="relative hidden lg:block">
          <button
            onClick={() => toggle('help')}
            className="w-9 h-9 rounded-md flex items-center justify-center transition-colors hover:bg-emerald-50"
            aria-label="Help"
          >
            <HelpCircle size={17} style={{ color: PBI.muted }} />
          </button>
          <HeaderDropdown open={openMenu === 'help'} onClose={closeAll} className="w-48">
            <button onClick={() => { navigate('/dashboard/reports'); closeAll(); }} className="w-full px-3 py-2.5 text-left text-[12px] hover:bg-emerald-50/50" style={{ color: PBI.text }}>
              Financial reports
            </button>
            <button onClick={() => { navigate('/dashboard/analytics'); closeAll(); }} className="w-full px-3 py-2.5 text-left text-[12px] hover:bg-emerald-50/50" style={{ color: PBI.text }}>
              Analytics & planning
            </button>
            <button onClick={() => { navigate('/dashboard/ledger'); closeAll(); }} className="w-full px-3 py-2.5 text-left text-[12px] hover:bg-emerald-50/50" style={{ color: PBI.text }}>
              General ledger
            </button>
          </HeaderDropdown>
        </div>

        {/* Notifications */}
        <button
          className="relative w-9 h-9 rounded-md flex items-center justify-center transition-colors hover:bg-emerald-50"
          aria-label="Notifications"
        >
          <Bell size={16} style={{ color: PBI.muted }} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white" style={{ background: '#10b981' }} />
        </button>

        {/* User menu */}
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
