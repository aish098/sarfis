import React from 'react';
import { X } from 'lucide-react';

export default function RightDrawer({ isOpen, onClose, title, subtitle, tabs, activeTab, onTabChange, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[550px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold uppercase text-sm">
            {title ? title.charAt(0) : 'D'}
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-sm">{title}</h4>
            {subtitle && <p className="text-[10px] text-slate-400 font-semibold">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer">
          <X size={16} />
        </button>
      </div>

      {/* Tabs list */}
      {tabs && tabs.length > 0 && (
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-4 text-[10px] font-black uppercase tracking-wider overflow-x-auto custom-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange && onTabChange(tab.id)}
              className={`px-3 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-700 font-bold' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content panel body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {children}
      </div>
    </div>
  );
}
