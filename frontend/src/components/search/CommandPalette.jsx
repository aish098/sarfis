import React, { useState, useEffect } from 'react';
import { Search, Compass, ChevronRight, X } from 'lucide-react';
import api from '../../services/api';

export default function CommandPalette({ isOpen, onClose, onActionSelect }) {
  const [search, setSearch] = useState('');

  const defaultShortcuts = [
    { label: 'Generate Payroll Run', action: 'WIZARD', category: 'Actions' },
    { label: 'Open Employee Directory', action: 'EMPLOYEES', category: 'Navigation' },
    { label: 'View Financial Reports', action: 'REPORTS', category: 'Navigation' },
    { label: 'Open Ledger Workspace', action: 'LEDGER', category: 'Navigation' },
    { label: 'Create Budget Plan', action: 'BUDGETS', category: 'Actions' }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filtered = defaultShortcuts.filter(s => 
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-28 z-50 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[400px]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search size={16} className="text-slate-400" />
          <input
            className="flex-1 text-sm bg-transparent outline-none font-bold text-slate-800 placeholder-slate-400"
            placeholder="Type a command or search everywhere (Ahmed, Budget)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded text-slate-400 cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs font-semibold">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider px-3 block mb-1">Command Palette Shortcuts</span>
            <div className="space-y-0.5">
              {filtered.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onActionSelect && onActionSelect(item);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex justify-between items-center text-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass size={14} className="text-slate-400" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">{item.category}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-slate-400 py-6">No matching actions or shortcuts found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
