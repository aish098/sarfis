import React from 'react';
import { ChevronRight } from 'lucide-react';
import FilterBar from '../ui/FilterBar';
import KPIGrid from '../ui/KPIGrid';

export default function WorkspaceLayout({
  title,
  subtitle,
  icon: Icon,
  badgeText,
  breadcrumbs = [],
  primaryAction = null,
  
  // Filters configuration
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  statusFilter,
  onStatusFilterChange,
  statusOptions = [],
  extraFilters = null,

  // KPI Tiles
  kpis = [], // array of { label, value, icon, iconBgClass, iconColorClass }
  
  // Optional secondary panels
  relatedDocuments = null,
  timeline = null,
  
  children
}) {
  return (
    <div className="space-y-6 font-sans pb-20">
      
      {/* 1. Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[11.5px] text-slate-400 font-semibold no-print">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={11} className="text-slate-350" />}
              <span className={idx === breadcrumbs.length - 1 ? 'text-slate-600 font-bold' : ''}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* 2. Top Banner Toolbar / Header */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
              <Icon size={18} className="text-white" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">
                {title}
              </h1>
              {badgeText && (
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {primaryAction && (
          <div className="mt-3 md:mt-0 flex items-center gap-2 flex-wrap">
            {primaryAction}
          </div>
        )}
      </div>

      {/* 3. Search & Filters Toolbar */}
      {(onSearchChange !== undefined || onStatusFilterChange !== undefined || extraFilters) && (
        <FilterBar 
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          statusOptions={statusOptions}
          extraFilters={extraFilters}
        />
      )}

      {/* 4. KPI Cards Grid (Responsive Layout) */}
      {kpis.length > 0 && (
        <KPIGrid items={kpis} />
      )}

      {/* 5. Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {children}
      </div>

      {/* 6. Optional Related Documents and Timeline */}
      {(relatedDocuments || timeline) && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-100 no-print">
          {relatedDocuments && (
            <div className={timeline ? 'md:col-span-8' : 'md:col-span-12'}>
              {relatedDocuments}
            </div>
          )}
          {timeline && (
            <div className={relatedDocuments ? 'md:col-span-4' : 'md:col-span-12'}>
              {timeline}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
