import React from 'react';

export default function WizardFlow({ steps, activeStep }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-3 relative pl-2 ml-1">
      {steps.map((st, idx) => {
        const isCompleted = idx < activeStep;
        const isActive = idx === activeStep;
        return (
          <div key={idx} className="flex gap-3 items-start relative">
            <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center font-mono text-[10px] font-bold z-10 ${
              isCompleted ? 'bg-emerald-500 text-white' :
              isActive ? 'bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-150' :
              'bg-slate-100 text-slate-400'
            }`}>
              {isCompleted ? '✓' : idx + 1}
            </div>
            <div>
              <p className={`font-black ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>{st.label}</p>
              {st.desc && <p className="text-[9.5px] text-slate-400 font-normal leading-tight mt-0.5">{st.desc}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
