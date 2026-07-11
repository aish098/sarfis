import React from 'react';

export default function DashboardGrid({ cols = 3, children }) {
  let gridCols = 'grid-cols-1 md:grid-cols-3';
  if (cols === 1) gridCols = 'grid-cols-1';
  if (cols === 2) gridCols = 'grid-cols-1 md:grid-cols-2';
  if (cols === 4) gridCols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid gap-6 ${gridCols}`}>
      {children}
    </div>
  );
}
