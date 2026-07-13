import React from 'react';
import StatusBadge from './StatusBadge';

export default function DocumentHeader({ 
  title, 
  number, 
  status, 
  metadata = [], 
  actions = null 
}) {
  return (
    <div className="space-y-4">
      {/* Title, Number and Status Badge */}
      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-mono font-black text-slate-850 text-[15px] flex items-center gap-2 flex-wrap">
            {number}
            {status && <StatusBadge status={status} />}
          </h3>
          {title && (
            <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wider">
              {title}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 no-print">
            {actions}
          </div>
        )}
      </div>

      {/* Metadata Grid (3 cols desktop, 2 cols tablet, 1 col mobile) */}
      {metadata.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3.5 gap-x-2 text-[12px] text-slate-650 border-b border-slate-100 pb-4">
          {metadata.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="space-y-0.5">
                <span className="block text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">
                  {item.label}
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  {Icon && <Icon size={12} className="text-slate-400 shrink-0" />}
                  <span className="truncate">{item.value || 'N/A'}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
