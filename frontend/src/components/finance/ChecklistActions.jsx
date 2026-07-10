import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';

export default function ChecklistActions({ checklist }) {
  if (!checklist) return null;

  const items = [...(checklist.blockers || []), ...(checklist.warnings || [])];

  if (items.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center py-12 text-slate-400 text-xs font-semibold">
        No outstanding alerts or blockers. This period is fully clean.
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Auto-Fix Diagnostics Suggestions</h3>

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className={`p-4 border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            item.severity === 'BLOCKER' ? 'bg-rose-50/20 border-rose-100' : 'bg-amber-50/20 border-amber-100'
          }`}>
            <div className="flex gap-3 items-start">
              <span className={`p-2 rounded-xl mt-0.5 ${
                item.severity === 'BLOCKER' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
              }`}>
                <AlertCircle size={16} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-slate-800">{item.title}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    item.severity === 'BLOCKER' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>{item.severity}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-relaxed">{item.description}</p>
              </div>
            </div>

            {item.actions && item.actions.length > 0 && (
              <div className="flex gap-2 justify-end">
                {item.actions.map((act, aIdx) => (
                  <Link
                    key={aIdx}
                    to={act.route}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[10px] shadow-sm transition-all"
                  >
                    {act.text} <ExternalLink size={10} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
