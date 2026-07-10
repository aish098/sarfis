import React from 'react';
import { DollarSign, Landmark, TrendingUp, ShieldAlert } from 'lucide-react';

export default function FinancialSummaryCard({ summary }) {
  if (!summary) return null;

  const fmt = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Pre-Close Financial Summary</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp size={18} />
          </span>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Revenue</span>
            <span className="text-sm font-black text-slate-800 font-mono">PKR {fmt(summary.revenue)}</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <DollarSign size={18} />
          </span>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Expenses</span>
            <span className="text-sm font-black text-slate-800 font-mono">PKR {fmt(summary.expenses)}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Landmark size={18} />
          </span>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Profit</span>
            <span className="text-sm font-black text-indigo-700 font-mono">PKR {fmt(summary.netProfit)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
        <div className="p-3.5 border border-slate-100 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assets</span>
          <span className="text-sm font-black text-slate-800 font-mono">PKR {fmt(summary.assets)}</span>
        </div>
        <div className="p-3.5 border border-slate-100 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Liabilities</span>
          <span className="text-sm font-black text-slate-800 font-mono">PKR {fmt(summary.liabilities)}</span>
        </div>
        <div className="p-3.5 border border-slate-100 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Equity</span>
          <span className="text-sm font-black text-slate-800 font-mono">PKR {fmt(summary.equity)}</span>
        </div>
        <div className="p-3.5 border border-slate-100 rounded-2xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Trial Balance Diff</span>
          <span className={`text-sm font-black font-mono ${summary.trialBalanceDifference > 0.01 ? 'text-rose-600' : 'text-slate-800'}`}>
            PKR {fmt(summary.trialBalanceDifference)}
          </span>
        </div>
      </div>

      {summary.trialBalanceDifference > 0.01 && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <ShieldAlert size={16} /> Trial Balance discrepancy detected. General ledger postings must balance before locking.
        </div>
      )}
    </div>
  );
}
