import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

export default function ModuleHealthPanel({ health }) {
  if (!health) return null;

  const getStatusIcon = (status) => {
    if (status === 'PASS') return <ShieldCheck size={18} className="text-emerald-500 fill-emerald-50" />;
    if (status === 'WARNING') return <ShieldAlert size={18} className="text-amber-500 fill-amber-50" />;
    return <ShieldX size={18} className="text-rose-500 fill-rose-50" />;
  };

  const getStatusBg = (status) => {
    if (status === 'PASS') return 'bg-emerald-50/50 border-emerald-100';
    if (status === 'WARNING') return 'bg-amber-50/50 border-amber-100';
    return 'bg-rose-50/50 border-rose-100';
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Cross-Module Integration Health</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {health.map((h, idx) => (
          <div key={idx} className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 ${getStatusBg(h.status)}`}>
            <div className="flex justify-between items-start">
              <div>
                <span className="font-extrabold text-[13px] text-slate-800">{h.module}</span>
                <span className="text-[10px] text-slate-400 block font-bold font-mono">Score: {h.score}%</span>
              </div>
              {getStatusIcon(h.status)}
            </div>

            {h.issues.length > 0 ? (
              <div className="space-y-1">
                {h.issues.map((iss, iIdx) => (
                  <p key={iIdx} className="text-[10px] leading-relaxed font-semibold text-slate-500">
                    • {iss}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[10px] italic text-slate-400 font-semibold">All checks passing</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
