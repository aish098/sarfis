import React from 'react';

export default function KPIGrid({ items = [] }) {
  if (!items || items.length === 0) return null;

  // Determine grid-cols dynamically based on number of KPIs if less than 5
  const count = items.length;
  const gridColsClass = count === 1 
    ? 'grid-cols-1' 
    : count === 2 
    ? 'grid-cols-1 sm:grid-cols-2' 
    : count === 3 
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' 
    : count === 4
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5';

  return (
    <div className={`grid ${gridColsClass} gap-4 font-sans`}>
      {items.map((kpi, idx) => {
        const KpiIcon = kpi.icon;
        const trendVal = kpi.trend;
        const subtitleVal = kpi.subtitle;
        const valueStr = String(kpi.value || '');

        // Determine correct font size for value based on its length
        const fontSizeClass = valueStr.length > 15 
          ? 'text-[13px]' 
          : valueStr.length > 11 
          ? 'text-[15px]' 
          : 'text-[18px]';

        // Check trend direction for style
        const isUp = trendVal?.includes('▲') || trendVal?.includes('+');
        const isDown = trendVal?.includes('▼') || trendVal?.includes('-');
        const trendColorClass = isUp 
          ? 'text-emerald-600 bg-emerald-50' 
          : isDown 
          ? 'text-rose-600 bg-rose-50' 
          : 'text-slate-500 bg-slate-50';

        return (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-w-0 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-3 min-w-0">
              {KpiIcon && (
                <div className={`p-2.5 rounded-xl shrink-0 ${kpi.iconBgClass || 'bg-blue-50'} ${kpi.iconColorClass || 'text-blue-650'}`}>
                  <KpiIcon size={18} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider truncate">{kpi.label}</span>
                <span className={`font-black text-slate-800 break-all leading-tight block ${fontSizeClass}`}>{kpi.value}</span>
              </div>
            </div>
            
            {(trendVal || subtitleVal) && (
              <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between gap-2 text-[10.5px]">
                {trendVal && (
                  <span className={`px-1.5 py-0.5 rounded font-bold font-mono ${trendColorClass}`}>
                    {trendVal}
                  </span>
                )}
                {subtitleVal && (
                  <span className="text-slate-450 font-semibold truncate flex-1 text-right">
                    {subtitleVal}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
