import React from 'react';
import SearchInput from './SearchInput';

export default function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  statusFilter,
  onStatusFilterChange,
  statusOptions = [],
  extraFilters = null
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {onSearchChange !== undefined && (
        <SearchInput 
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      )}
      
      {onStatusFilterChange !== undefined && statusOptions.length > 0 && (
        <select 
          className="input-enterprise text-[13px] py-2.5 w-full sm:w-auto"
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {extraFilters}
    </div>
  );
}
