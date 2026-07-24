import React from 'react';

export default function PageLoader({ message = 'Syncing workspace ledger...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] w-full p-8">
      <div className="bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-3xl p-8 flex flex-col items-center shadow-xl shadow-slate-900/5 max-w-xs w-full">
        <div className="relative w-12 h-12 mb-4">
          {/* Outer glowing pulsing ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-emerald-500/20 animate-pulse"></div>
          {/* Inner rotating gradient arc */}
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-600 border-r-emerald-600 animate-spin"></div>
        </div>
        <h3 className="text-[14px] font-black text-slate-950 tracking-widest uppercase">
          A C C O U N T E L L E N C E
        </h3>
        <p className="mt-1.5 text-slate-500 text-[11px] font-semibold text-center">
          {message}
        </p>
      </div>
    </div>
  );
}
