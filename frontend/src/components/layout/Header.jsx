import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, ChevronDown, Building2, Menu } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Header({ sidebarCollapsed, onMenuToggle }) {
  const { user, companies, activeCompany, setActiveCompany } = useAuthStore();
  const [showCompanies, setShowCompanies] = useState(false);

  return (
    <header
      className="header fixed top-0 right-0 z-40 flex items-center px-6 gap-4"
      style={{
        left: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-w)',
        height: 'var(--header-h)',
        transition: 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Menu size={20} className="text-slate-600" />
      </button>

      {/* Global Search */}
      <div className="flex-1 max-w-sm hidden sm:block">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-enterprise pl-10 py-2.5 text-[13px]"
            placeholder="Universal search..."
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        {/* Company Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowCompanies(!showCompanies)}
            className="btn btn-secondary px-3 py-2 flex items-center gap-2.5 group"
          >
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <Building2 size={12} />
            </div>
            <span className="hidden lg:block max-w-[150px] truncate text-[13px] font-bold text-slate-700">
              {activeCompany?.name || "Select Company"}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${showCompanies ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showCompanies && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50 p-1.5"
              >
                <p className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Your Organizations</p>
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveCompany(c); setShowCompanies(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] transition-all hover:bg-slate-50 ${
                      activeCompany?.id === c.id ? 'text-emerald-600 font-bold bg-emerald-50/50' : 'text-slate-600'
                    }`}
                  >
                    {c.name}
                    {activeCompany?.id === c.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors border border-slate-100">
          <Bell size={18} className="text-slate-500" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-white" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-100">
          <div className="hidden lg:block text-right">
            <p className="text-[13px] font-bold text-slate-900 leading-tight">{user?.name || 'Ayesha Khan'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin</p>
          </div>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[13px] text-white"
            style={{ background: 'linear-gradient(135deg, var(--emerald), var(--cyan))' }}>
            {user?.name?.charAt(0) || 'A'}
          </button>
        </div>
      </div>
    </header>
  );
}
