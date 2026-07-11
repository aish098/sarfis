import React from 'react';

export default function Timeline({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="relative border-l border-slate-150 pl-4 ml-2 space-y-5 text-xs font-semibold text-slate-600">
      {items.map((item, idx) => (
        <div key={idx} className="relative">
          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
          <p className="text-slate-800 font-black flex justify-between">
            <span>{item.title || item.text}</span> 
            {(item.date || item.time) && (
              <span className="text-[10px] text-slate-400 font-mono font-normal">
                {item.date || item.time}
              </span>
            )}
          </p>
          {item.desc && <p className="text-[10.5px] text-slate-400 mt-0.5 font-normal leading-relaxed">{item.desc}</p>}
        </div>
      ))}
    </div>
  );
}
