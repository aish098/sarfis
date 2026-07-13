import React from 'react';
import { Clock } from 'lucide-react';

export default function ActivityFeed({ events = [] }) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-[12.5px] italic font-sans">
        No recent activity logged.
      </div>
    );
  }

  const getStatusClasses = (status) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
      case 'COMPLETED':
      case 'PAID':
      case 'APPROVED':
      case 'POSTED':
        return { dot: 'text-emerald-600', dotBg: 'bg-emerald-50 ring-emerald-100/50' };
      case 'WARNING':
      case 'PENDING':
      case 'PENDING_APPROVAL':
      case 'PROCESSING':
      case 'SUBMITTED':
      case 'DRAFT':
        return { dot: 'text-amber-600', dotBg: 'bg-amber-50 ring-amber-100/50' };
      case 'ERROR':
      case 'REJECTED':
      case 'CANCELLED':
      case 'BLOCKED':
      case 'REVERSED':
      case 'ON HOLD':
      case 'ON_HOLD':
        return { dot: 'text-rose-600', dotBg: 'bg-rose-50 ring-rose-100/50' };
      case 'INFO':
      case 'ACTIVE':
      default:
        return { dot: 'text-indigo-650', dotBg: 'bg-indigo-50 ring-indigo-100/50' };
    }
  };

  return (
    <div className="flow-root font-sans">
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const { dot, dotBg } = getStatusClasses(event.status);
          const EventIcon = event.icon || Clock;

          return (
            <li key={event.id || idx}>
              <div className="relative pb-6">
                {idx !== events.length - 1 && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3.5 items-start">
                  <div>
                    <span className={`h-8.5 w-8.5 rounded-full flex items-center justify-center ring-4 ring-white ${dotBg} ${dot}`}>
                      <EventIcon size={14} className="flex-shrink-0" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-0.5">
                        <p className="text-[12.5px] font-bold text-slate-800">
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="text-[11.5px] text-slate-500 leading-normal font-semibold">
                            {event.description}
                          </p>
                        )}
                        {event.action && (
                          <button
                            type="button"
                            onClick={event.action.onClick}
                            className="mt-1.5 text-[10.5px] font-bold text-indigo-650 hover:text-indigo-800 transition-all border-none bg-transparent cursor-pointer flex items-center gap-1 hover:underline p-0"
                          >
                            {event.action.label}
                          </button>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-slate-400 font-semibold whitespace-nowrap shrink-0">
                        {event.user && <span className="block text-slate-650 font-extrabold">{event.user}</span>}
                        <time className="block mt-0.5 font-mono text-[10px] text-slate-400">{event.time}</time>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
