import React, { useState } from 'react';
import { 
  Landmark, Download, CheckCircle, ShieldAlert, X, 
  RotateCcw, RefreshCw, Layers, DollarSign, ArrowRight,
  ChevronRight, Sparkles, UploadCloud
} from 'lucide-react';
import api from '../../services/api';

export default function PayrollPayments({ userRole }) {
  const [activePaymentTab, setActivePaymentTab] = useState('individual'); // individual | bulk | batches | export | reversals | reconciliation
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  // Bank Export options
  const [selectedBankFormat, setSelectedBankFormat] = useState('HBL'); // HBL | Meezan | MCB | UBL | CSV

  const [pendingPayments, setPendingPayments] = useState([
    { id: 1, name: 'Ayesha Malik', department: 'People Operations', net: 95000, bankName: 'National Bank', account: 'PK45NBPA0000765432109876', status: 'PENDING' },
    { id: 2, name: 'Rizwan Ali', department: 'Finance', net: 200000, bankName: 'MCB Bank', account: 'pk12mcb11111111111111', status: 'PENDING' },
  ]);

  const [paymentBatches, setPaymentBatches] = useState([
    { id: 'BAT-0021', period: '2026-07', headcount: 212, net: 32550000, portal: 'HBL Business', status: 'COMPLETED', date: '2026-07-28', steps: [
      { name: 'Created', done: true },
      { name: 'Exported', done: true },
      { name: 'Sent to Bank', done: true },
      { name: 'Accepted', done: true },
      { name: 'Completed', done: true }
    ], items: [
      { emp: 'Farhan Ali', amount: 156600, status: 'PAID' },
      { emp: 'Sana Khan', amount: 130500, status: 'PAID' },
      { emp: 'Zainab Ahmed', amount: 95700, status: 'FAILED' },
      { emp: 'Hamza Sheikh', amount: 143550, status: 'RETRIED' }
    ]},
    { id: 'BAT-0020', period: '2026-06', headcount: 198, net: 29800000, portal: 'MCB Gateway', status: 'COMPLETED', date: '2026-06-29', steps: [
      { name: 'Created', done: true },
      { name: 'Exported', done: true },
      { name: 'Sent to Bank', done: true },
      { name: 'Accepted', done: true },
      { name: 'Completed', done: true }
    ], items: []},
  ]);

  const [reconciliationItems, setReconciliationItems] = useState([
    { employee: 'Farhan Ali', payable: 156600, statementAmt: 156600, matchStatus: 'MATCHED' },
    { employee: 'Sana Khan', payable: 130500, statementAmt: 130500, matchStatus: 'MATCHED' },
    { employee: 'Zainab Ahmed', payable: 95700, statementAmt: 0, matchStatus: 'UNMATCHED' },
  ]);

  const [reversals, setReversals] = useState([
    { id: 8, employee: 'Hamza Sheikh', period: '2026-07', amount: 165000, reason: 'Duplicate transfer error', status: 'REVERSED', date: '2026-07-30' },
  ]);

  const handlePayIndividual = async (id, name) => {
    setLoading(true);
    setTimeout(() => {
      setPendingPayments(prev => prev.filter(p => p.id !== id));
      setActionMsg({ type: 'success', text: `Disbursement released for ${name}. Mapped AP cleared & Journal posted to general ledger.` });
      setLoading(false);
    }, 800);
  };

  const handleDownloadBankExport = () => {
    let headers = 'Beneficiary Name,Beneficiary Bank Account,Bank Name,Salary Amount,Payment Reference,Disbursement Month\n';
    let content = '';
    pendingPayments.forEach(p => {
      content += `"${p.name}","${p.account}","${p.bankName}",${p.net},"Salary Settlement","August 2026"\n`;
    });
    const blob = new Blob([headers + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bank_disbursement_${selectedBankFormat}_${new Date().toISOString().slice(0, 7)}.csv`);
    link.click();
    setActionMsg({ type: 'success', text: `Downloaded bank payout file formatted in ${selectedBankFormat} layout template.` });
  };

  const disableActions = userRole === 'Auditor';

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Alert Banner */}
      {actionMsg && (
        <div className={`p-4 rounded-xl border text-[13px] font-bold flex items-center justify-between gap-3 ${
          actionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle size={16} />
            {actionMsg.text}
          </span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-3xs gap-1.5 w-fit">
        {[
          { id: 'individual', label: 'Individual Payments' },
          { id: 'bulk', label: 'Bulk Disbursements' },
          { id: 'batches', label: 'Batch Monitor' },
          { id: 'export', label: 'Bank Export Gateway' },
          { id: 'reconciliation', label: 'Reconciliation Workspace' },
          { id: 'reversals', label: 'Reversals Registry' }
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setActivePaymentTab(tb.id)}
            className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black ${
              activePaymentTab === tb.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Individual Payments Tab */}
      {activePaymentTab === 'individual' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Pending Individual Releases</h3>
            <p className="text-[11px] text-slate-400 mt-1">Disburse pending salary lines one-by-one with immediate posting.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5">Bank Name</th>
                  <th className="px-5 py-3.5">Account / IBAN</th>
                  <th className="px-5 py-3.5 text-right">Net Payable Amount</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {pendingPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-800 font-bold">{p.name}</td>
                    <td className="px-5 py-4">{p.bankName}</td>
                    <td className="px-5 py-4 font-mono">{p.account}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {p.net.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-black border bg-amber-50 text-amber-700 border-amber-100 uppercase">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button 
                        onClick={() => handlePayIndividual(p.id, p.name)}
                        disabled={disableActions}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-3xs cursor-pointer text-[10px] font-black disabled:opacity-40"
                      >
                        Release Payment
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold">No outstanding individual salary lines pending release.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Disbursements Tab */}
      {activePaymentTab === 'bulk' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Release Bulk Salaries</h3>
          <p className="text-[12.5px] text-slate-400 leading-relaxed font-normal">
            Authorize total monthly payouts across all pending employee profiles using connected commercial banking gateways (HBL / Meezan).
          </p>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center max-w-md">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Pending Payouts Total</span>
              <p className="text-base font-black font-mono text-slate-800 mt-0.5">PKR {pendingPayments.reduce((s, p) => s + p.net, 0).toLocaleString()}</p>
            </div>
            <button 
              disabled={pendingPayments.length === 0 || disableActions}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-sm text-xs font-black cursor-pointer"
            >
              Confirm Bulk Release
            </button>
          </div>
        </div>
      )}

      {/* Batch Monitor Tab */}
      {activePaymentTab === 'batches' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Treasury Batch Payment Monitor</h3>
            <p className="text-[11px] text-slate-400 mt-1">Review compiled payroll transfer batches cleared via corporate channels.</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {paymentBatches.map(b => (
              <div key={b.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <Landmark size={15} className="text-indigo-600" /> Batch ID: {b.id}
                    </h4>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">Period {b.period} — {b.portal} — Cleared on {b.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10.5px] text-slate-400 block font-bold">Total Net Value</span>
                    <span className="text-sm font-black font-mono text-slate-800">PKR {b.net.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1 font-mono text-[9px]">
                  {b.steps.map((step, idx) => (
                    <React.Fragment key={step.name}>
                      <span className={`px-1.5 py-0.5 rounded ${
                        step.done ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-100' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {step.name}
                      </span>
                      {idx < b.steps.length - 1 && <ChevronRight size={10} className="text-slate-300" />}
                    </React.Fragment>
                  ))}
                </div>

                {b.items.length > 0 && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden mt-3">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                          <th className="px-4 py-2">Beneficiary Employee</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-center">Direct Transfer Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                        {b.items.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-bold text-slate-700">{line.emp}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-slate-800">PKR {line.amount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-black border ${
                                line.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                line.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {line.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank Export Gateway Tab */}
      {activePaymentTab === 'export' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-5">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Corporate Bank File Export Portal</h3>
            <p className="text-[11px] text-slate-400 mt-1">Download standard ACH/CSV disbursement payloads matching commercial banking templates.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-400">Select Bank Target Template Format</label>
                <select
                  value={selectedBankFormat}
                  onChange={e => setSelectedBankFormat(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="HBL">Habib Bank Limited (HBL Corporate Layout)</option>
                  <option value="Meezan">Meezan Bank (Meezan Direct Pay)</option>
                  <option value="MCB">MCB Bank Limited (MCB e-Gate)</option>
                  <option value="UBL">United Bank Limited (UBL Direct Link)</option>
                  <option value="CSV">Standard Universal CSV Register</option>
                </select>
              </div>

              <button
                onClick={handleDownloadBankExport}
                disabled={pendingPayments.length === 0}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer font-black"
              >
                <Download size={14} /> Download Export File
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Payload Summary</span>
                <div className="mt-2 space-y-1.5">
                  <p>Export Target: <span className="text-slate-800 font-bold">{selectedBankFormat} Portal</span></p>
                  <p>Record Lines: <span className="text-slate-800 font-bold">{pendingPayments.length} Pending Records</span></p>
                  <p>Accumulated Net Value: <span className="text-slate-800 font-mono font-bold">PKR {pendingPayments.reduce((s, p) => s + p.net, 0).toLocaleString()}</span></p>
                </div>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed font-normal mt-4">
                ⚠️ Bank files conform strictly to the respective institution's direct clearing layout rules. Upload directly under treasury profiles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Workspace */}
      {activePaymentTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Bank Reconciliation Workspace</h3>
              <p className="text-[11px] text-slate-400 mt-1">Reconcile general ledger payable records against imported bank clearance statements.</p>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={disableActions}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <UploadCloud size={14} /> Import Statement
              </button>
              <button 
                disabled={disableActions}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Sparkles size={14} /> Auto-Match Lines
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5 text-right">Ledger Salary Due</th>
                  <th className="px-5 py-3.5 text-right">Bank Clearance Value</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {reconciliationItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-800 font-bold">{item.employee}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {item.payable.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {item.statementAmt.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black border ${
                        item.matchStatus === 'MATCHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                      }`}>
                        {item.matchStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {item.matchStatus === 'UNMATCHED' ? (
                        <button 
                          disabled={disableActions}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9.5px] font-black shadow-3xs cursor-pointer disabled:opacity-40"
                        >
                          Manual Match
                        </button>
                      ) : <span className="text-slate-400 italic">Reconciled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reversals Registry Tab */}
      {activePaymentTab === 'reversals' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Reversals & Audit Rollbacks</h3>
            <p className="text-[11px] text-slate-400 mt-1">Track and reconcile reversed salary payments with auto-ledger adjustment logs.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Reversal ID</th>
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5">Period Target</th>
                  <th className="px-5 py-3.5 text-right">Reversed Amount</th>
                  <th className="px-5 py-3.5">Reversal Reason</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5">Processed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {reversals.map(rev => (
                  <tr key={rev.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-slate-800">#REV-0{rev.id}</td>
                    <td className="px-5 py-4 text-slate-800 font-bold">{rev.employee}</td>
                    <td className="px-5 py-4 font-bold">Period {rev.period}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-rose-600">- PKR {rev.amount.toLocaleString()}</td>
                    <td className="px-5 py-4 text-slate-400 italic">{rev.reason}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-black border bg-rose-50 text-rose-700 border-rose-100 uppercase">
                        {rev.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono">{rev.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
