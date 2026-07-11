import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function LookupField({ label, placeholder, options = [], selectedValue, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(opt => 
    String(opt.label || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === selectedValue);

  return (
    <div className="space-y-1 text-xs font-semibold text-slate-600 relative">
      {label && <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-left bg-white text-slate-700 outline-none flex justify-between items-center cursor-pointer shadow-3xs"
        >
          <span>{selectedOption ? selectedOption.label : placeholder || 'Select option...'}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 border border-slate-150 rounded-lg text-xs outline-none focus:border-indigo-500 font-semibold"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-0.5">
              {filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange && onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    selectedValue === opt.value 
                      ? 'bg-indigo-50 text-indigo-700 font-bold' 
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-slate-400 py-3">No options found.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
