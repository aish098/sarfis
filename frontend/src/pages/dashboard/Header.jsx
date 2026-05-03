import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, ChevronDown, Building2, Menu, User } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Header({ sidebarCollapsed, onMenuToggle }) {
  const { user, companies, activeCompany, setActiveCompany } = useAuthStore();
  const [showCompanies, setShowCompanies] = useState(false);

  const leftOffset = sidebarCollapsed ? 68 : 248;

  return (
    <header
      className="fixed top-0 right-0 z-40 flex items-center px-5 gap-4"
      style={{
        left: leftOffset,
        height: 60,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #e2e8f0',
        transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Mobile menu */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-lg transition-colors hover:bg-slate-100"
      >
        <Menu size={18} className="text-slate-600" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-sm hidden sm:block">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-enterprise input-search py-[9px] text-sm"
            placeholder="Search across ledgers..."
            style={{ background: '#f8fafc', borderColor: '#e8edf2', fontSize: 13 }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Company switcher */}
        <div className="relative">
          <button
            onClick={() => setShowCompanies(!showCompanies)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium text-slate-700 hover:bg-slate-50"
            style={{ border: '1px solid #e2e8f0' }}
          >
            <Building2 size={14} className="text-emerald-500" />
            <span className="hidden sm:block max-w-[140px] truncate text-[13px]">
              {activeCompany?.name || "Ayesha Khan's Workspace"}
            </span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          <AnimatePresence>
            {showCompanies && companies?.length > 0 && (
              <Motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-card-lg border border-slate-100 overflow-hidden z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch Company</p>
                </div>
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveCompany(c); setShowCompanies(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] transition-colors hover:bg-slate-50 ${
                      activeCompany?.id === c.id ? 'text-emerald-600 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    {c.name}
                    {activeCompany?.id === c.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                ))}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100">
          <Bell size={17} className="text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-white" />
        </button>

        {/* Avatar */}
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}
        >
          {user?.name?.charAt(0)?.toUpperCase() || 'A'}
        </button>
      </div>
    </header>
  );
}
