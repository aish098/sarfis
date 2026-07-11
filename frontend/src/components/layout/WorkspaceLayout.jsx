import React from 'react';

export default function WorkspaceLayout({ title, subtitle, breadcrumbs, actions, filterBar, kpis, children, sidebar }) {
  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Header and Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {breadcrumbs && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span>/</span>}
                  <span>{crumb}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <h2 className="text-xl font-black text-slate-800 tracking-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 font-semibold">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Filter Bar */}
      {filterBar && <div className="z-20">{filterBar}</div>}

      {/* KPI Cards Summary Section */}
      {kpis && <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{kpis}</div>}

      {/* Main Content Workspace Split */}
      {sidebar ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-3 space-y-6">{children}</div>
          <div className="lg:col-span-1 space-y-6">{sidebar}</div>
        </div>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
    </div>
  );
}
