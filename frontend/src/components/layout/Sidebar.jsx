import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, FilePlus, BookMarked,
  BarChart2, TrendingUp, Target, Settings, LogOut,
  Home, ChevronLeft, ChevronRight, Zap, Building2
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import logoImg from '../../assets/logo/Logo 05.png';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { to: '/dashboard/accounts', icon: BookOpen, label: 'Accounts' },
      { to: '/dashboard/journal', icon: FilePlus, label: 'New Journal' },
      { to: '/dashboard/ledger', icon: BookMarked, label: 'Ledger' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/dashboard/analytics', icon: TrendingUp, label: 'Analytics' },
      { to: '/dashboard/reports', icon: BarChart2, label: 'Reports' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const { user, logout, activeCompany, settings } = useAuthStore();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <motion.aside
      animate={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-w)' }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className={`sidebar fixed top-0 left-0 h-screen flex flex-col z-50 ${collapsed ? 'collapsed' : ''}`}
    >
      {/* Branding */}
      <div className="sidebar-logo flex items-center gap-3">
        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl.startsWith('http') ? settings.logoUrl : `${import.meta.env.PROD ? window.location.origin : 'http://localhost:5001'}${settings.logoUrl}`}
            alt="Logo"
            className="w-8 h-8 object-contain rounded-lg flex-shrink-0 bg-white p-0.5"
          />
        ) : (
          <img
            src={logoImg}
            alt="ACCOUNTELLENCE Logo"
            className="w-8 h-8 object-contain rounded-lg flex-shrink-0 bg-transparent"
          />
        )}
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="font-display font-black text-white text-[18px] tracking-tight uppercase">
            ACCOUNTELLENCE
          </motion.span>
        )}
      </div>

      {/* Workspace Indicator */}
      {!collapsed && (
        <div className="mx-4 my-4 p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white/90 truncate">{activeCompany?.name || 'Main Ledger'}</p>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Enterprise</p>
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2 scroll-hide">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && <p className="sidebar-section-label">{section.label}</p>}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <NavLink to="/" className="sidebar-nav-item">
          <Home size={18} />
          {!collapsed && <span>Portal Home</span>}
        </NavLink>
        <button onClick={handleLogout} className="sidebar-nav-item w-full group">
          <LogOut size={18} className="text-rose-400 group-hover:text-rose-300" />
          {!collapsed && <span className="text-rose-400 group-hover:text-rose-300">Exit System</span>}
        </button>
      </div>
    </motion.aside>
  );
}
