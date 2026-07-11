import React from 'react';
import { Plus } from 'lucide-react';

export default function FloatingActionButton({ onClick, icon: Icon = Plus, label }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2 group z-40 cursor-pointer font-black text-xs uppercase"
      title={label}
    >
      <Icon size={18} />
      {label && <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-semibold">{label}</span>}
    </button>
  );
}
