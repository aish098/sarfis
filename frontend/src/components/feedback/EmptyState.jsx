import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function EmptyState({ icon: Icon = AlertCircle, title, description, actionText, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 border-dashed rounded-3xl text-center max-w-md mx-auto space-y-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <Icon size={24} />
      </div>
      <div className="space-y-1">
        <h4 className="font-extrabold text-slate-800 text-sm">{title || 'No Data Available'}</h4>
        <p className="text-xs text-slate-500 font-semibold leading-relaxed">{description || 'There are no records found matching this workspace.'}</p>
      </div>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
