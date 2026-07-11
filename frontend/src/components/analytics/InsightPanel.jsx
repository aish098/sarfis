import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

export default function InsightPanel({ insights = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (insights.length === 0) return null;

  return (
    <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-3.5 space-y-2 text-xs font-semibold text-slate-600">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-amber-800 font-black uppercase text-[10px] tracking-wider cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb size={13} className="text-amber-600" />
          Smart Business Insights
        </span>
        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {isExpanded && (
        <ul className="space-y-1.5 text-slate-600 list-disc list-inside mt-2 font-medium leading-relaxed">
          {insights.map((insight, idx) => (
            <li key={idx} className="marker:text-amber-500">
              {insight}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
