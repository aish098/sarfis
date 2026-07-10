import React from 'react';
import { Calendar, User } from 'lucide-react';

export default function CloseTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Close Timeline logs</h3>
        <p className="text-slate-400 text-xs italic">No timeline entries registered for this period closing attempt.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Close Timeline logs</h3>

      <div className="relative border-l-2 border-slate-100 ml-3.5 pl-5 space-y-5 py-2">
        {timeline.map((item, idx) => (
          <div key={idx} className="relative">
            {/* Timeline Circle dot */}
            <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-4 ring-emerald-50/50" />
            
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="font-extrabold text-slate-800">{item.title}</span>
                <span className="text-[10px] text-slate-400 font-bold font-mono">
                  {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-slate-500 leading-relaxed font-semibold">{item.description}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold pt-0.5">
                <User size={10} /> By {item.user}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
