import React from 'react';
import { CheckSquare, Square, ShieldCheck } from 'lucide-react';

export default function SignOffPanel({ signoffs, onToggleSignoff, status }) {
  const steps = [
    { code: 'INVENTORY', label: 'Inventory Verified', desc: 'Confirm negative stock balances and transit dispatches are resolved.' },
    { code: 'PAYROLL', label: 'Payroll Complete', desc: 'Ensure employee salary runs are calculated, approved, and posted.' },
    { code: 'BANK_REC', label: 'Bank Reconciled', desc: 'Confirm bank statements balance aligns with ledger cash logs.' },
    { code: 'GL_CONTROL', label: 'Trial Balance & AR/AP Control Reviewed', desc: 'Confirm customer and vendor sub-ledger balances match GL controls.' },
    { code: 'BUDGET', label: 'Budget Allocation Reviewed', desc: 'Audit actual expenditures against allocated budget limits.' },
    { code: 'TRIAL_BALANCE', label: 'Double-Entry Ledger Integrity', desc: 'Verify Trial Balance contains absolute zero debit/credit discrepancy.' }
  ];

  const isDisabled = status === 'CLOSED' || status === 'PENDING_APPROVAL';

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Management & Stakeholder Sign-offs</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((s) => {
          const matched = signoffs.find(x => x.step === s.code);
          const isChecked = !!matched;

          return (
            <div
              key={s.code}
              onClick={() => !isDisabled && onToggleSignoff(s.code, !isChecked)}
              className={`p-4 border rounded-2xl flex gap-3 transition-all ${
                isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300'
              } ${isChecked ? 'bg-emerald-50/20 border-emerald-200' : 'bg-slate-50/50 border-slate-100'}`}
            >
              <div className="mt-0.5">
                {isChecked ? (
                  <CheckSquare size={18} className="text-emerald-600 fill-emerald-50" />
                ) : (
                  <Square size={18} className="text-slate-300" />
                )}
              </div>
              <div className="text-xs space-y-1">
                <span className="font-extrabold text-slate-800 block">{s.label}</span>
                <p className="text-slate-400 font-semibold leading-relaxed">{s.desc}</p>
                {isChecked && (
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded flex items-center gap-0.5 w-fit mt-1">
                    <ShieldCheck size={10} /> Verified by {matched.checker_name || 'You'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
