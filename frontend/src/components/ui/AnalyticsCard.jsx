import React, { useState } from 'react';
import { Maximize2, Minimize2, RefreshCw, FileSpreadsheet, Eye } from 'lucide-react';

export default function AnalyticsCard({ 
  title, 
  subtitle, 
  kpis = [], 
  insights = [], 
  actions = [], 
  onDrillDown, 
  onExportExcel,
  onRefresh,
  children 
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`bg-white border border-slate-150 rounded-3xl transition-all ${
      isFullscreen 
        ? 'fixed inset-4 z-50 p-6 flex flex-col justify-between shadow-2xl bg-white/95 backdrop-blur-md' 
        : 'p-5 shadow-xs flex flex-col space-y-4'
    }`}>
      {/* 1. Header & Chart Toolbar */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button onClick={onRefresh} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors cursor-pointer" title="Refresh Data">
              <RefreshCw size={12} />
            </button>
          )}
          {onExportExcel && (
            <button onClick={onExportExcel} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors cursor-pointer" title="Export Excel">
              <FileSpreadsheet size={12} />
            </button>
          )}
          <button onClick={toggleFullscreen} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors cursor-pointer" title="Toggle Fullscreen">
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Header */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs font-semibold">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="space-y-0.5">
              <span className="text-[9.5px] text-slate-400 block uppercase font-extrabold tracking-wider">{kpi.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-800 font-black">{kpi.value}</span>
                {kpi.change && (
                  <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full ${
                    kpi.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {kpi.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Core Graph Area */}
      <div className={`relative ${isFullscreen ? 'flex-1 my-6 min-h-0' : 'h-[220px]'}`}>
        {children}
      </div>

      {/* 4. Insight Panel */}
      {insights && insights.length > 0 && (
        <div className="bg-indigo-50/50 border border-indigo-100/50 p-3 rounded-2xl text-[10.5px] text-indigo-700 font-semibold space-y-1">
          {insights.map((insight, idx) => (
            <p key={idx} className="flex gap-1.5 items-start">
              <span>💡</span>
              <span className="leading-relaxed">{insight}</span>
            </p>
          ))}
        </div>
      )}

      {/* 5. Actions / Drill-down bar */}
      {(onDrillDown || (actions && actions.length > 0)) && (
        <div className="flex justify-between items-center border-t border-slate-50 pt-3">
          <div>
            {onDrillDown && (
              <button 
                onClick={onDrillDown}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Eye size={11} /> View Details
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {actions.map((act, idx) => (
              <button
                key={idx}
                onClick={act.onClick}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all ${
                  act.primary 
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-3xs' 
                    : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-600'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
