import React from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function CloseReadinessCard({ progress, status, blockers, warnings, completedChecks, totalChecks, onRunChecklist, loading }) {
  const getStatusColor = () => {
    if (status === 'CLOSED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'PENDING_APPROVAL') return 'text-amber-700 bg-amber-50 border-amber-200';
    if (blockers > 0) return 'text-rose-700 bg-rose-50 border-rose-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  const getStatusLabel = () => {
    if (status === 'CLOSED') return 'Period Locked';
    if (status === 'PENDING_APPROVAL') return 'Awaiting Approval';
    if (blockers > 0) return 'Blockers Outstanding';
    return 'Ready to Close';
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
      {/* Progress Circular Indicator */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r="48"
            className="stroke-slate-100 fill-transparent"
            strokeWidth="8"
          />
          <circle
            cx="56"
            cy="56"
            r="48"
            className="stroke-emerald-500 fill-transparent transition-all duration-500"
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 48}
            strokeDashoffset={2 * Math.PI * 48 * (1 - progress / 100)}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xl font-black text-slate-800 font-mono">{progress}%</span>
      </div>

      {/* Stats and status description */}
      <div className="flex-1 text-center md:text-left space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-800">Close Readiness status</h3>
            <p className="text-slate-400 text-xs font-semibold">Completed checks: {completedChecks} / {totalChecks}</p>
          </div>
          <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase border ${getStatusColor()}`}>
            {getStatusLabel()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-2xl text-center">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Blockers</span>
            <span className="text-xl font-black text-rose-700 font-mono">{blockers}</span>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl text-center">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Warnings</span>
            <span className="text-xl font-black text-amber-700 font-mono">{warnings}</span>
          </div>
        </div>
      </div>

      {onRunChecklist && (
        <button
          disabled={loading}
          onClick={onRunChecklist}
          className="flex items-center gap-1.5 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Run Diagnostics
        </button>
      )}
    </div>
  );
}
