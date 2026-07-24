import React, { useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function OrganizationSwitcher() {
  const { currentCompany, userCompanies, setCurrentCompany } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  if (!userCompanies || userCompanies.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold">
        <Building2 size={14} className="text-emerald-600" />
        <span className="truncate max-w-[140px]">{currentCompany?.name || 'Workspace'}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold transition-all shadow-3xs cursor-pointer"
      >
        <Building2 size={14} className="text-emerald-600" />
        <span className="truncate max-w-[130px]">{currentCompany?.name || 'Select Workspace'}</span>
        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Workspaces ({userCompanies.length})
            </div>
            {userCompanies.map((c) => {
              const isSelected = currentCompany?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setCurrentCompany(c);
                    setIsOpen(false);
                    window.location.reload();
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer border-none bg-transparent ${
                    isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 size={13} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
