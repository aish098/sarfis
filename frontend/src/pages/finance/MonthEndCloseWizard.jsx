import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Calendar, AlertTriangle, CheckCircle2, Lock, Unlock, 
  RefreshCw, FileText, Scale, ChevronRight, Info, ListTodo, History, CheckSquare, Eye
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function MonthEndCloseWizard() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklistData, setChecklistData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Closing / Reopening actions
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (activeCompany) {
      fetchPeriods();
    }
  }, [activeCompany]);

  const fetchPeriods = async () => {
    try {
      const { data } = await api.get(`/periods/${activeCompany.id}`);
      setPeriods(data);
      if (data.length > 0) {
        // Default to the oldest open period, or fallback to the first
        const open = data.find(p => p.status === 'OPEN');
        setSelectedPeriod(open || data[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch accounting periods.');
    }
  };

  const loadChecklist = async (periodId) => {
    setLoadingChecklist(true);
    setError(null);
    setChecklistData(null);
    try {
      const { data } = await api.get(`/periods/${activeCompany.id}/${periodId}/close-checklist`);
      setChecklistData(data);
      fetchHistory(periodId);
      setLoadingChecklist(false);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load closing checklist.');
      setLoadingChecklist(false);
    }
  };

  const fetchHistory = async (periodId) => {
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/periods/${activeCompany.id}/${periodId}/history`);
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };

  const handlePeriodChange = (e) => {
    const p = periods.find(x => String(x.id) === e.target.value);
    setSelectedPeriod(p);
    setCurrentStep(1);
    setChecklistData(null);
  };

  const runDiagnostics = () => {
    if (!selectedPeriod) return;
    loadChecklist(selectedPeriod.id);
    setCurrentStep(2);
  };

  const handleClosePeriod = async () => {
    if (!selectedPeriod) return;
    setClosing(true);
    setError(null);
    try {
      await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/close`);
      setSuccessMsg(`Accounting period '${selectedPeriod.period_name}' is now closed and locked.`);
      setClosing(false);
      fetchPeriods();
      setCurrentStep(6);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close accounting period.');
      setClosing(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!selectedPeriod || !reopenReason.trim()) return;
    setReopening(true);
    setError(null);
    try {
      await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/reopen`, { reason: reopenReason });
      setSuccessMsg(`Accounting period '${selectedPeriod.period_name}' has been successfully reopened.`);
      setReopening(false);
      setReopenReason('');
      fetchPeriods();
      setCurrentStep(6);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reopen accounting period.');
      setReopening(false);
    }
  };

  const fmt = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const steps = [
    { num: 1, label: 'Selection' },
    { num: 2, label: 'Docs Check' },
    { num: 3, label: 'Inventory' },
    { num: 4, label: 'Bank Rec' },
    { num: 5, label: 'Control GL' },
    { num: 6, label: 'Finalize' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-emerald-800 hover:bg-emerald-100/50 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Calendar size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Month-End Close</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Closing Wizard</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5">
              Verify posting logs, inventory, bank balances, and lock accounting periods.
            </p>
          </div>
        </div>
      </div>

      {/* Steps Progress Indicator */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-xs font-bold text-slate-400">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center border font-mono ${
                currentStep === s.num ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' :
                currentStep > s.num ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                'bg-slate-50 border-slate-200'
              }`}>
                {s.num}
              </span>
              <span className={currentStep === s.num ? 'text-emerald-700 font-extrabold' : ''}>{s.label}</span>
            </div>
            {idx !== steps.length - 1 && <ChevronRight size={14} className="text-slate-200" />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2 font-bold animate-pulse">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Wizard Step Body */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[380px] flex flex-col justify-between">
        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            {/* STEP 1: SELECT PERIOD */}
            {currentStep === 1 && (
              <motion.div key="step-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Select Accounting Period</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Choose the open period to compile the close checklist or view closed history logs.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Target Period</label>
                    <select 
                      value={selectedPeriod?.id || ''} 
                      onChange={handlePeriodChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[13px] font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    >
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>{p.period_name} ({p.status})</option>
                      ))}
                    </select>

                    {selectedPeriod && (
                      <div className="mt-5 p-4 rounded-2xl border border-slate-100 bg-[#FAF9F8] space-y-2 text-xs font-semibold text-slate-600">
                        <div className="flex justify-between"><span>Start Date:</span><span className="font-bold text-slate-800">{new Date(selectedPeriod.start_date).toLocaleDateString()}</span></div>
                        <div className="flex justify-between"><span>End Date:</span><span className="font-bold text-slate-800">{new Date(selectedPeriod.end_date).toLocaleDateString()}</span></div>
                        <div className="flex justify-between"><span>Current Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            selectedPeriod.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>{selectedPeriod.status}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-l border-slate-100 pl-6 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><History size={13} /> Close Logs & History</h3>
                    
                    {loadingHistory ? (
                      <div className="text-center py-6 text-slate-400 text-xs"><RefreshCw className="animate-spin inline mr-2" size={14}/>Loading logs...</div>
                    ) : history.length === 0 ? (
                      <p className="text-slate-400 text-xs italic">No closing operations registered for this period.</p>
                    ) : (
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                        {history.map(h => (
                          <div key={h.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-700 uppercase tracking-wider">{h.action}ed</span>
                              <span className="text-[10px] text-slate-400">{new Date(h.performed_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-500">By {h.performed_name}</p>
                            {h.reason && <p className="text-rose-600 font-semibold italic">Reason: {h.reason}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DOCUMENTS CHECK */}
            {currentStep === 2 && (
              <motion.div key="step-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Unposted Documents Check</h2>
                  <p className="text-slate-400 text-xs mt-0.5">All transaction sheets, vouchers, and depreciation profiles must be fully posted to prevent ledger imbalances.</p>
                </div>

                {loadingChecklist ? (
                  <div className="text-center py-12 text-slate-400 text-sm"><RefreshCw size={20} className="animate-spin mx-auto mb-3 text-emerald-500" /> Compiling checklist audits...</div>
                ) : (
                  <div className="space-y-4">
                    {/* Voucher Block card */}
                    <div className="p-5 border border-slate-100 rounded-2xl flex items-start gap-4">
                      <span className={`p-2.5 rounded-xl ${checklistData?.blockers.find(b => b.type === 'UNPOSTED_VOUCHERS') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <FileText size={20} />
                      </span>
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-center">
                          <h4 className="font-black text-slate-800 text-[13px]">Unposted Vouchers</h4>
                          <span className="font-bold text-slate-400">
                            {checklistData?.blockers.find(b => b.type === 'UNPOSTED_VOUCHERS')?.details?.length || 0} Draft Vouchers
                          </span>
                        </div>
                        <p className="text-slate-400 mt-1 leading-relaxed">Vouchers (Purchases, sales, dispatches) must be either posted or voided before closures.</p>
                        
                        {checklistData?.blockers.find(b => b.type === 'UNPOSTED_VOUCHERS') && (
                          <div className="mt-3 bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-1 text-[11px] font-semibold text-rose-700 font-mono">
                            {checklistData.blockers.find(b => b.type === 'UNPOSTED_VOUCHERS').details.map(v => (
                              <div key={v.id} className="flex justify-between items-center">
                                <span>{v.voucher_number} ({v.type})</span>
                                <span>PKR {fmt(v.total_amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Journal block card */}
                    <div className="p-5 border border-slate-100 rounded-2xl flex items-start gap-4">
                      <span className={`p-2.5 rounded-xl ${checklistData?.blockers.find(b => b.type === 'DRAFT_JOURNALS') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <ListTodo size={20} />
                      </span>
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-center">
                          <h4 className="font-black text-slate-800 text-[13px]">Draft Journal Entries</h4>
                          <span className="font-bold text-slate-400">
                            {checklistData?.blockers.find(b => b.type === 'DRAFT_JOURNALS')?.details?.length || 0} Draft Journals
                          </span>
                        </div>
                        <p className="text-slate-400 mt-1 leading-relaxed">Pending manual journal entry drafts must be committed to ledger accounts.</p>
                        
                        {checklistData?.blockers.find(b => b.type === 'DRAFT_JOURNALS') && (
                          <div className="mt-3 bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-1 text-[11px] font-semibold text-rose-700 font-mono">
                            {checklistData.blockers.find(b => b.type === 'DRAFT_JOURNALS').details.map(j => (
                              <div key={j.id} className="flex justify-between items-center">
                                <span>{j.description || 'Manual Entry'}</span>
                                <span>PKR {fmt(j.total_amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Depreciation Block Card */}
                    <div className="p-5 border border-slate-100 rounded-2xl flex items-start gap-4">
                      <span className={`p-2.5 rounded-xl ${checklistData?.blockers.find(b => b.type === 'MISSING_DEPRECIATION') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Scale size={20} />
                      </span>
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-center">
                          <h4 className="font-black text-slate-800 text-[13px]">Asset Depreciation Calculations</h4>
                          <span className="font-bold text-slate-400">
                            {checklistData?.diagnostics.depreciationRun ? 'Calculated & Posted' : 'Missing Run'}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-1 leading-relaxed">Depreciation values must be posted to Asset Book profiles before closing periods.</p>
                        {!checklistData?.diagnostics.depreciationRun && (
                          <Link to="/dashboard/fixed-assets" className="inline-flex items-center gap-1 mt-2 text-indigo-600 font-bold hover:underline">
                            Open Asset Depreciation Wizard <ChevronRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: INVENTORY CHECKS */}
            {currentStep === 3 && (
              <motion.div key="step-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Inventory Audits</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Reviews warehouse valuations, stock transfers, and ensures no negative inventory balances.</p>
                </div>

                <div className="space-y-4">
                  {/* Negative inventory warnings */}
                  <div className="p-5 border border-slate-100 rounded-2xl flex items-start gap-4">
                    <span className={`p-2.5 rounded-xl ${checklistData?.warnings.find(w => w.type === 'NEGATIVE_INVENTORY') ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <AlertTriangle size={20} />
                    </span>
                    <div className="flex-1 text-xs">
                      <div className="flex justify-between items-center">
                        <h4 className="font-black text-slate-800 text-[13px]">Negative Stock Balances</h4>
                        <span className="font-bold text-slate-400">
                          {checklistData?.warnings.find(w => w.type === 'NEGATIVE_INVENTORY')?.details?.length || 0} Product Warnings
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1 leading-relaxed">Products having negative quantities on hand might indicate pending purchase receipts.</p>
                      
                      {checklistData?.warnings.find(w => w.type === 'NEGATIVE_INVENTORY') && (
                        <div className="mt-3 bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-1.5 text-[11px] font-semibold text-amber-800 font-mono">
                          {checklistData.warnings.find(w => w.type === 'NEGATIVE_INVENTORY').details.map(item => (
                            <div key={item.product_id} className="flex justify-between">
                              <span>{item.product_name} ({item.sku}) - {item.warehouse_name}</span>
                              <span className="text-rose-600 font-black">{item.quantity} units</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pending deliveries */}
                  <div className="p-5 border border-slate-100 rounded-2xl flex items-start gap-4">
                    <span className={`p-2.5 rounded-xl ${checklistData?.warnings.find(w => w.type === 'PENDING_DELIVERIES') ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <ChevronRight size={20} />
                    </span>
                    <div className="flex-1 text-xs">
                      <div className="flex justify-between items-center">
                        <h4 className="font-black text-slate-800 text-[13px]">Pending Stock Dispatches</h4>
                        <span className="font-bold text-slate-400">
                          {checklistData?.warnings.find(w => w.type === 'PENDING_DELIVERIES')?.details?.length || 0} Transfers / Shipments
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1 leading-relaxed">Verify that all stock shipments within this period have been fully confirmed or moved to final states.</p>
                      
                      {checklistData?.warnings.find(w => w.type === 'PENDING_DELIVERIES') && (
                        <div className="mt-3 bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-1 text-[11px] font-semibold text-amber-800 font-mono">
                          {checklistData.warnings.find(w => w.type === 'PENDING_DELIVERIES').details.map(d => (
                            <div key={d.id} className="flex justify-between">
                              <span>Delivery #{d.delivery_number}</span>
                              <span className="uppercase font-bold">{d.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: BANK RECONCILIATION */}
            {currentStep === 4 && (
              <motion.div key="step-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Bank Statement Reconciliation</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Validates General Ledger cash/bank account balances against reconciled bank statement statements.</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="px-5 py-3 text-left">Bank / Cash Account</th>
                        <th className="px-5 py-3 text-right">Ledger Balance</th>
                        <th className="px-5 py-3 text-right">Statement Balance</th>
                        <th className="px-5 py-3 text-right">Variance</th>
                        <th className="px-5 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checklistData?.diagnostics.bankReconciliations.map(b => (
                        <tr key={b.accountId} className="border-b border-slate-50 font-semibold text-slate-700">
                          <td className="px-5 py-3.5">
                            <span className="font-bold block text-slate-800">{b.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Code: {b.code}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">PKR {fmt(b.ledgerBalance)}</td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                            {b.statementBalance !== null ? `PKR ${fmt(b.statementBalance)}` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-rose-600 font-bold">
                            {b.difference !== null && b.difference > 0 ? `PKR ${fmt(b.difference)}` : '0.00'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              b.status === 'RECONCILED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>{b.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* STEP 5: CONTROL ACCOUNTS RECONCILIATION */}
            {currentStep === 5 && (
              <motion.div key="step-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Sub-ledger Control Account Integrity</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Asserts that control accounts match sub-ledger asset schedules, customer receivables, and vendor payables.</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="px-5 py-3 text-left">Control Account</th>
                        <th className="px-5 py-3 text-right">GL Ledger Balance</th>
                        <th className="px-5 py-3 text-right">Sub-ledger Balance</th>
                        <th className="px-5 py-3 text-right">Discrepancy</th>
                        <th className="px-5 py-3 text-center">Verification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checklistData?.diagnostics.controlReconciliations.map(c => (
                        <tr key={c.accountId} className="border-b border-slate-50 font-semibold text-slate-700">
                          <td className="px-5 py-3.5">
                            <span className="font-bold block text-slate-800">{c.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Code: {c.code}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">PKR {fmt(c.ledgerBalance)}</td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">PKR {fmt(c.subledgerBalance)}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-rose-600 font-bold">
                            {c.difference > 0 ? `PKR ${fmt(c.difference)}` : '0.00'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              c.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              c.status === 'WARNING' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>{c.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* STEP 6: FINALIZE */}
            {currentStep === 6 && (
              <motion.div key="step-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Review & Close Period</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Overview of diagnostics. Lock the period to disable future postings or reopen it if adjustments are needed.</p>
                </div>

                {successMsg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold rounded-2xl flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-emerald-600" /> {successMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Summary Checklist Stats */}
                  <div className="p-6 border border-slate-100 rounded-3xl space-y-4 bg-[#FAF9F8]">
                    <h3 className="font-extrabold text-[14px] text-slate-800">Checklist Diagnostics Summary</h3>
                    
                    <div className="space-y-2 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span>Blockers Checked</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          checklistData?.blockers.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>{checklistData?.blockers.length || 0} Blockers</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span>Warnings Checked</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          checklistData?.warnings.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>{checklistData?.warnings.length || 0} Warnings</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Closing Target Period</span>
                        <span className="font-extrabold text-slate-800">{selectedPeriod?.period_name}</span>
                      </div>
                    </div>

                    {selectedPeriod?.status === 'OPEN' ? (
                      <div className="pt-2">
                        {checklistData?.blockers.length > 0 ? (
                          <div className="p-4 bg-rose-50/50 border border-rose-100 text-rose-800 text-[11px] font-bold rounded-xl space-y-1 leading-relaxed">
                            <p className="uppercase text-[10px] tracking-wider text-rose-600">❌ Period Lock Blocked</p>
                            <p>You must resolve all blocker items (Draft Journals, Unposted Vouchers, or Missing Depreciation Runs) before you can close this period.</p>
                          </div>
                        ) : (
                          <div className="p-4 bg-emerald-50/50 border border-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl space-y-1 leading-relaxed">
                            <p className="uppercase text-[10px] tracking-wider text-emerald-600">✓ Ready to Close</p>
                            <p>No active blockers found. Locking the period will prohibit any transactions in this date range.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 text-[11.5px] font-bold rounded-xl flex gap-2">
                        <Lock size={16} className="text-rose-600 shrink-0" />
                        <div>
                          <p className="uppercase text-[10px] tracking-wider text-rose-600">Period Currently Locked</p>
                          <p className="mt-0.5 font-medium leading-relaxed">This period is closed. You can reopen it if you need to post corrections, but this requires an audit trail reason.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions / Inputs Form */}
                  <div className="space-y-4">
                    {selectedPeriod?.status === 'OPEN' ? (
                      <button
                        disabled={checklistData?.blockers.length > 0 || closing}
                        onClick={handleClosePeriod}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95 cursor-pointer"
                      >
                        {closing ? <><RefreshCw className="animate-spin" size={14}/> Locking Period...</> : <><Lock size={14}/> Close & Lock Period</>}
                      </button>
                    ) : (
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Reopen Reason (Required)</label>
                          <textarea 
                            rows={3}
                            placeholder="Enter detailed auditor explanation supporting reopening this period..."
                            value={reopenReason}
                            onChange={e => setReopenReason(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                          />
                        </div>
                        <button
                          disabled={!reopenReason.trim() || reopening}
                          onClick={handleReopenPeriod}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95 cursor-pointer"
                        >
                          {reopening ? <><RefreshCw className="animate-spin" size={14}/> Reopening...</> : <><Unlock size={14}/> Reopen accounting period</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stepper Navigation Footer Buttons */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button
            disabled={currentStep === 1 || closing || reopening}
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[12.5px] transition-all hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none active:scale-95 cursor-pointer"
          >
            Back
          </button>
          
          {currentStep === 1 ? (
            <button
              onClick={runDiagnostics}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[12.5px] transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Run Checklist <ChevronRight size={14} />
            </button>
          ) : currentStep === 6 ? (
            <Link 
              to="/dashboard"
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-[12.5px] transition-all active:scale-95"
            >
              Exit Wizard
            </Link>
          ) : (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[12.5px] transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Next Step <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
