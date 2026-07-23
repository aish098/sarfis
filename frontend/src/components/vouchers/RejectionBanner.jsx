import React from 'react';
import { AlertTriangle, Edit3, Send, History, HelpCircle } from 'lucide-react';

export default function RejectionBanner({
  lastRejectedAt,
  lastRejectedBy,
  lastRejectionCode = 'REJECTED',
  lastRejectionReason = 'No specific reason provided.',
  revisionNumber = 0,
  onEdit,
  onResubmit,
  onViewDiff
}) {
  const formattedDate = lastRejectedAt ? new Date(lastRejectedAt).toLocaleString() : 'Recently';

  return (
    <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-slate-900/4 border border-rose-500/30 rounded-2xl p-5 mb-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left Side: Warning Icon & Information */}
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                {lastRejectionCode || 'REJECTED'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Revision {revisionNumber}
              </span>
              <span className="text-[11.5px] text-slate-400 font-medium">
                • Rejected {formattedDate}
              </span>
            </div>

            <p className="text-[13px] font-bold text-slate-800 leading-snug">
              <span className="text-rose-700 font-black">Reason for Rejection: </span>
              "{lastRejectionReason}"
            </p>

            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <HelpCircle size={12} className="text-slate-400" />
              You can edit item lines, quantities, or prices below and resubmit for approval once updated.
            </p>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 border-rose-200/50 pt-3 md:pt-0">
          {onViewDiff && (
            <button
              type="button"
              onClick={onViewDiff}
              className="px-3.5 py-2 text-[12px] font-bold rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <History size={14} className="text-indigo-500" /> View History
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="px-3.5 py-2 text-[12px] font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs hover:shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={14} className="text-blue-600" /> Edit Entries
            </button>
          )}

          {onResubmit && (
            <button
              type="button"
              onClick={onResubmit}
              className="px-4 py-2 text-[12px] font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Send size={14} /> Reconsider & Resubmit
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
