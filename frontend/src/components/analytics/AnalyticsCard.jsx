import React from 'react';
import ChartToolbar from './ChartToolbar';
import KPISummary from './KPISummary';
import InsightPanel from './InsightPanel';
import Skeleton from '../feedback/Skeleton';

export default function AnalyticsCard({ 
  title, 
  subtitle, 
  description,
  icon: Icon,
  kpis = [], 
  insights = [], 
  onRefresh, 
  onExport, 
  onCompare, 
  onToggleFullscreen,
  loading = false,
  footer,
  children 
}) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className="text-indigo-600" />}
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">{title}</h3>
          </div>
          {subtitle && <p className="text-[10px] text-slate-400 font-semibold">{subtitle}</p>}
          {description && <p className="text-[9.5px] text-slate-400 font-normal mt-0.5 leading-relaxed">{description}</p>}
        </div>
        
        <ChartToolbar 
          onRefresh={onRefresh} 
          onExport={onExport} 
          onCompare={onCompare} 
          onToggleFullscreen={onToggleFullscreen} 
        />
      </div>

      {/* KPI summaries list */}
      {kpis.length > 0 && <KPISummary items={kpis} />}

      {/* Main chart rendering node */}
      <div className="flex-1 min-h-[220px] flex flex-col justify-center">
        {loading ? (
          <Skeleton type="chart" />
        ) : (
          children
        )}
      </div>

      {/* Insights collapser */}
      {insights.length > 0 && <InsightPanel insights={insights} />}

      {/* Footer info text */}
      {footer && (
        <div className="border-t border-slate-50 pt-3 text-[9.5px] text-slate-400 font-semibold uppercase tracking-wider">
          {footer}
        </div>
      )}
    </div>
  );
}
