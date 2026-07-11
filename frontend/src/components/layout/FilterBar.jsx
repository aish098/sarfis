import React from 'react';
import { Calendar, Users, Landmark } from 'lucide-react';

export default function FilterBar({ selectedPeriod, onPeriodChange, selectedDept, onDeptChange, departments = [] }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-slate-400" />
        <span className="text-[10px] text-slate-400 font-extrabold uppercase">Period</span>
        <select
          value={selectedPeriod}
          onChange={e => onPeriodChange && onPeriodChange(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none bg-slate-50 font-bold text-slate-700 cursor-pointer"
        >
          <option value="2026-08">August 2026</option>
          <option value="2026-07">July 2026</option>
          <option value="2026-06">June 2026</option>
        </select>
      </div>

      {departments.length > 0 && (
        <div className="flex items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <span className="text-[10px] text-slate-400 font-extrabold uppercase">Department</span>
          <select
            value={selectedDept}
            onChange={e => onDeptChange && onDeptChange(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none bg-slate-50 font-bold text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
