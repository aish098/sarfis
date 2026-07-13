import React from 'react';

export default function NextActionCard({ 
  status, 
  title = 'Next Recommended Action', 
  description, 
  children 
}) {
  return (
    <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl space-y-3.5 shadow-xs text-left animate-slide-up">
      <div className="flex justify-between items-center">
        <span className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">
          {title}
        </span>
        {status && (
          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded uppercase">
            Status: {status}
          </span>
        )}
      </div>
      
      {description && (
        <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
          {description}
        </p>
      )}

      {children && (
        <div className="pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
