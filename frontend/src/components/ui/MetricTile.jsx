import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function MetricTile({ title, value, change, isPositive = true, subtitle, icon: Icon }) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3 font-semibold">
      <div className="flex justify-between items-center text-slate-400">
        <span className="text-[10px] uppercase font-extrabold tracking-wider">{title}</span>
        {Icon && <Icon size={14} className="text-slate-400" />}
      </div>
      <div className="space-y-1">
        <p className="text-xl font-black text-slate-800 tracking-tight">{value}</p>
        <div className="flex items-center gap-1.5 text-[10px]">
          {change && (
            <span className={`flex items-center font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? <ArrowUpRight size={10} className="mr-0.5" /> : <ArrowDownRight size={10} className="mr-0.5" />}
              {change}
            </span>
          )}
          {subtitle && <span className="text-slate-400 font-semibold">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}
