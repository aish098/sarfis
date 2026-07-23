import React from 'react';
import { History, X, Calendar, User, FileText, CheckCircle, AlertTriangle, Send } from 'lucide-react';

export default function RevisionDiffModal({
  isOpen,
  onClose,
  revisions = [],
  documentNumber = ''
}) {
  if (!isOpen) return null;

  const getTypeBadge = (type) => {
    switch (type) {
      case 'RESUBMITTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1"><Send size={10} /> Resubmitted</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1"><AlertTriangle size={10} /> Rejected</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1"><CheckCircle size={10} /> Approved</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Document Revision & Audit Snapshots</h3>
              <p className="text-[11px] text-slate-400 font-mono">{documentNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 border-none cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {revisions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <FileText size={32} className="mx-auto text-slate-300" />
              <p className="text-[13px] font-semibold">No historical revision snapshots logged yet.</p>
            </div>
          ) : (
            revisions.map((rev, index) => {
              const snapshot = rev.snapshot_json || {};
              const header = snapshot.header || {};
              const items = snapshot.items || [];

              return (
                <div key={rev.id || index} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-3">
                  
                  {/* Revision Header Info */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10.5px] font-mono font-bold">
                        Rev {rev.revision_number}
                      </span>
                      {getTypeBadge(rev.snapshot_type)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <User size={12} className="text-slate-400" /> {rev.creator_name || 'System User'}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar size={12} className="text-slate-400" /> {new Date(rev.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Revision Notes if any */}
                  {rev.revision_notes && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-[12px] text-slate-700 italic">
                      "{rev.revision_notes}"
                    </div>
                  )}

                  {/* Items Snapshot Grid */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11.5px] font-sans">
                      <thead>
                        <tr className="bg-slate-200/50 text-slate-600 font-bold uppercase text-[9.5px]">
                          <th className="px-3 py-1.5">Product ID</th>
                          <th className="px-3 py-1.5 text-center">Qty</th>
                          <th className="px-3 py-1.5 text-right">Unit Price</th>
                          <th className="px-3 py-1.5 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono">
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 font-sans font-medium text-slate-800">
                              Product #{item.productId}
                            </td>
                            <td className="px-3 py-1.5 text-center font-bold text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-600">
                              PKR {Number(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-emerald-700">
                              PKR {Number(item.lineTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer border-none"
          >
            Close Inquiry
          </button>
        </div>

      </div>
    </div>
  );
}
