import React from 'react';
import { Search } from 'lucide-react';

export default function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  className = '' 
}) {
  return (
    <div className={`relative flex-1 max-w-sm ${className}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input 
        type="text"
        className="input-enterprise pl-9 text-[13px] py-2.5 w-full input-enterprise-icon" 
        placeholder={placeholder} 
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
