import React from 'react';

export default function KPISummary({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-4 border-b border-slate-50 pb-3 font-semibold text-xs text-slate-600 overflow-x-auto custom-scrollbar">
      {items.map((kpi, idx) => (
        <div key={idx} className="space-y-0.5 shrink-0 pr-4 border-r last:border-0 border-slate-100">
          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">{kpi.label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-800 font-black">{kpi.value}</span>
            {kpi.change && (
              <span className={`text-[9px] font-black ${kpi.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpi.change}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
