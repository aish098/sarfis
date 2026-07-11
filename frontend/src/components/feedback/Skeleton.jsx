import React from 'react';

// Base pulse component
function Pulse({ className }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
      <Pulse className="h-3 w-16" />
      <Pulse className="h-6 w-28" />
      <Pulse className="h-3.5 w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Pulse key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Pulse key={j} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-6">
      <div className="flex justify-between items-center">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-4 w-12" />
      </div>
      <div className="h-48 flex items-end gap-2.5 pt-4">
        <Pulse className="h-12 flex-1" />
        <Pulse className="h-28 flex-1" />
        <Pulse className="h-40 flex-1" />
        <Pulse className="h-20 flex-1" />
        <Pulse className="h-32 flex-1" />
        <Pulse className="h-16 flex-1" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonChart />
        </div>
        <div>
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

export default function Skeleton({ type = 'card' }) {
  if (type === 'table') return <SkeletonTable />;
  if (type === 'chart') return <SkeletonChart />;
  if (type === 'dashboard') return <SkeletonDashboard />;
  return <SkeletonCard />;
}
