import React, { useState } from 'react';
import { Send, X, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export default function ResubmitModal({
  isOpen,
  onClose,
  onSubmit,
  documentNumber = '',
  currentRevision = 0,
  totalAmount = 0,
  itemCount = 0,
  isSubmitting = false
}) {
  const [revisionNotes, setRevisionNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!revisionNotes.trim() || revisionNotes.trim().length < 5) {
      setError('Please provide a meaningful revision note (at least 5 characters) explaining your changes.');
      return;
    }
    onSubmit(revisionNotes.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Reconsider & Resubmit for Approval</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {documentNumber} • Revision {(currentRevision || 0) + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 border-none cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Pre-flight Summary Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Total Amount</span>
              <span className="font-mono font-black text-slate-800 text-[13.5px]">
                PKR {Number(totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Line Items</span>
              <span className="font-mono font-bold text-slate-700 text-[13px]">
                {itemCount} {itemCount === 1 ? 'Line' : 'Lines'}
              </span>
            </div>
          </div>

          {/* Revision Notes Input */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-bold text-slate-700">
              Revision Notes & Change Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe what was changed (e.g., Reduced laptop quantity from 5 to 3 and updated unit price to 9,500 based on vendor quote)."
              className="w-full px-3.5 py-2.5 text-[12px] rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
            />
            <p className="text-[10.5px] text-slate-400">
              This note will be visible to approvers in the Document Audit Timeline and Workflow History.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11.5px] font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[12px] font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition-all border-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-[12px] font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-none disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={15} /> Confirm & Resubmit
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
