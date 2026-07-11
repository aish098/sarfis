import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, Eye, Edit2, Trash2 } from 'lucide-react';

export default function DataTable({ 
  columns, 
  data, 
  onRowClick, 
  actions, 
  searchPlaceholder = "Search records...", 
  enableSearch = true,
  enablePagination = true,
  pageSize = 5
}) {
  const [sortConfig, setSortConfig] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(columns.map(c => c.key));
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Sorting logic
  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    let sortableItems = [...data];
    if (searchTerm) {
      sortableItems = sortableItems.filter(item => 
        Object.values(item).some(val => 
          String(val || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig, searchTerm]);

  // Pagination logic
  const paginatedData = React.useMemo(() => {
    if (!enablePagination) return sortedData;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, enablePagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const toggleColumn = (key) => {
    if (visibleColumns.includes(key)) {
      if (visibleColumns.length > 1) {
        setVisibleColumns(visibleColumns.filter(c => c !== key));
      }
    } else {
      setVisibleColumns([...visibleColumns, key]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Column visibility toolbar */}
      <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
        {enableSearch && (
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
        )}

        {/* Column show/hide selector */}
        <div className="relative">
          <button 
            onClick={() => setShowColumnDropdown(!showColumnDropdown)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
          >
            Columns <ChevronDown size={12} />
          </button>
          {showColumnDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-35 p-3 space-y-2 font-semibold">
              <p className="text-[9px] uppercase text-slate-400 font-black tracking-wider mb-2">Visible Columns</p>
              {columns.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-slate-350 text-indigo-600 cursor-pointer"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid view fallback for Mobile screens */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {paginatedData.map((item, idx) => (
          <div 
            key={item.id || idx}
            onClick={() => onRowClick && onRowClick(item)}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs space-y-3 cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                {columns.filter(c => visibleColumns.includes(c.key)).slice(0, 2).map(c => (
                  <p key={c.key} className="text-xs text-slate-500 first:font-extrabold first:text-slate-800 first:text-sm">
                    {c.render ? c.render(item[c.key], item) : String(item[c.key] || '')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table view for Desktop screens */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                {columns.filter(col => visibleColumns.includes(col.key)).map(col => (
                  <th 
                    key={col.key} 
                    onClick={() => handleSort(col.key)}
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {sortConfig && sortConfig.key === col.key && (
                        sortConfig.direction === 'ascending' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                      )}
                    </div>
                  </th>
                ))}
                {actions && <th className="px-5 py-3.5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
              {paginatedData.map((item, idx) => (
                <tr 
                  key={item.id || idx}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  {columns.filter(col => visibleColumns.includes(col.key)).map(col => (
                    <td 
                      key={col.key} 
                      className="px-5 py-4 text-slate-655"
                    >
                      {col.render ? col.render(item[col.key], item) : String(item[col.key] || '')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="px-5 py-8 text-center text-slate-400 font-bold">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls footer */}
        {enablePagination && totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-650">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
