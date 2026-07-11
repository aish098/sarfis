import React from 'react';
import { RefreshCw, Download, Maximize2, Columns } from 'lucide-react';

export default function ChartToolbar({ onRefresh, onExport, onToggleFullscreen, onCompare }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-400">
      {onRefresh && (
        <button 
          onClick={onRefresh}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer transition-all"
          title="Refresh Data"
        >
          <RefreshCw size={13} />
        </button>
      )}
      {onCompare && (
        <button 
          onClick={onCompare}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer transition-all"
          title="Compare Metrics"
        >
          <Columns size={13} />
        </button>
      )}
      {onExport && (
        <button 
          onClick={onExport}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer transition-all"
          title="Export CSV/PNG"
        >
          <Download size={13} />
        </button>
      )}
      {onToggleFullscreen && (
        <button 
          onClick={onToggleFullscreen}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer transition-all"
          title="Fullscreen Toggle"
        >
          <Maximize2 size={13} />
        </button>
      )}
    </div>
  );
}
