import React from 'react';

export default function StatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase().trim();
  
  let classes = 'bg-slate-100 text-slate-500 border-slate-200';
  if (normalized === 'PAID' || normalized === 'COMPLETED' || normalized === 'SUCCESS' || normalized === 'ACTIVE' || normalized === 'APPROVED') {
    classes = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (normalized === 'PENDING' || normalized === 'PENDING_APPROVAL' || normalized === 'AWAITING' || normalized === 'AWAITING SIGN-OFF') {
    classes = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (normalized === 'PROCESSING' || normalized === 'IN_PROGRESS' || normalized === 'SIMULATED') {
    classes = 'bg-blue-50 text-blue-700 border-blue-100';
  } else if (normalized === 'WARNING' || normalized === 'UNRESOLVED') {
    classes = 'bg-orange-50 text-orange-700 border-orange-100';
  } else if (normalized === 'FAILED' || normalized === 'ERROR' || normalized === 'CRITICAL') {
    classes = 'bg-rose-50 text-rose-700 border-rose-100';
  } else if (normalized === 'CLOSED' || normalized === 'ARCHIVED' || normalized === 'DRAFT') {
    classes = 'bg-slate-100 text-slate-500 border-slate-200';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black border uppercase tracking-wider ${classes}`}>
      {status}
    </span>
  );
}
