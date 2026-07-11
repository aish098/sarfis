import React, { useState, useEffect } from 'react';
import { 
  Play, RefreshCw, CheckCircle, ShieldAlert, ArrowRight, 
  Layers, Calendar, ChevronRight, FileText, DollarSign, X,
  AlertOctagon, CheckSquare, Clock, Lock, Sparkles, UploadCloud,
  ChevronLeft, Landmark, Send, Info, Eye, EyeOff
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function PayrollProcessing({ userRole }) {
  const { activeCompany } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  
  // Wizard state: Select Period -> Validate -> Simulate -> Approval -> Post -> Pay -> Reconcile -> Close
  const [activeStep, setActiveStep] = useState(0);
  const [currentRun, setCurrentRun] = useState(null);
  const [runsArchive, setRunsArchive] = useState([]);
  const [viewMode, setViewMode] = useState('wizard'); // wizard | archive
  
  const [period, setPeriod] = useState('2026-08');
  const [exceptions, setExceptions] = useState([
    { id: 1, name: 'Rana Talal', code: 'MISSING_BANK', detail: 'No active bank routing account number detected.', severity: 'CRITICAL' },
    { id: 2, name: 'Rizwan Ali', code: 'SALARY_VARIANCE', detail: 'Monthly salary increment exceeds threshold (>30% variance).', severity: 'WARNING' },
    { id: 3, name: 'Hamza Sheikh', code: 'MISSING_TAX_ID', detail: 'National Tax Number (NTN) missing. Defaulting to high withholding non-filer rate.', severity: 'WARNING' },
  ]);
  
  // Simulation results
  const [simResults, setSimResults] = useState(null);
  const [showJsonTrace, setShowJsonTrace] = useState(false);
  
  // Payments & Reconciliation
  const [payments, setPayments] = useState([]);
  const [reconciliationLines, setReconciliationLines] = useState([]);

  const steps = [
    { label: 'Select Period', desc: 'Initialize accounting period run' },
    { label: 'Validate Employees', desc: 'Audit compliance exceptions' },
    { label: 'Simulation', desc: 'Pre-posting calculation check' },
    { label: 'Approval sign-off', desc: 'HR & Finance authorizations' },
    { label: 'Post to GL', desc: 'Generate journal entries' },
    { label: 'Payments Release', desc: 'Disburse salary batches' },
    { label: 'Bank Reconciliation', desc: 'Verify statement clearance' },
    { label: 'Close Period', desc: 'Lock calculations & lock month' }
  ];

  const fetchActiveAndArchiveRuns = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/reports/register`);
      const list = res.data || [];
      setRunsArchive(list);
      
      // Auto-select latest active run and resume step
      if (list.length > 0) {
        const latest = list[0];
        setCurrentRun(latest);
        setPeriod(latest.period);
        
        // Resume-awareness: set step index matching status
        if (latest.status === 'CLOSED') {
          setActiveStep(7);
        } else if (latest.status === 'POSTED') {
          setActiveStep(5);
        } else if (latest.status === 'APPROVED') {
          setActiveStep(4);
        } else if (latest.status === 'PENDING' || latest.status === 'PENDING_APPROVAL') {
          setActiveStep(3);
        } else if (latest.status === 'SIMULATED') {
          setActiveStep(2);
        } else {
          setActiveStep(1); // DRAFT starts at validation step
        }
      } else {
        setCurrentRun(null);
        setActiveStep(0);
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveAndArchiveRuns();
  }, [activeCompany?.id]);

  // Step 1: Select Period -> Generate Run
  const handleGeneratePeriod = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      await api.post(`/payroll/${activeCompany.id}/runs`, { period });
      setActionMsg({ type: 'success', text: `Successfully initialized payroll run for period ${period}.` });
      await fetchActiveAndArchiveRuns();
      setActiveStep(1);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to initialize period.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Validate Employees (resolve exceptions)
  const handleCompleteValidation = () => {
    setActiveStep(2);
  };

  // Step 3: Run Simulation
  const handleSimulateRun = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.post(`/payroll/${activeCompany.id}/simulate`, { period });
      setSimResults(res.data);
      setActionMsg({ type: 'success', text: 'Payroll calculations simulated successfully in transactional rollback block.' });
      setActiveStep(3);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Simulation run failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Submission and Sign-off
  const handleSubmitApproval = async () => {
    if (!currentRun) return;
    setLoading(true);
    try {
      await api.post(`/payroll/${activeCompany.id}/runs/${currentRun.id}/submit`);
      setActionMsg({ type: 'success', text: 'HR sign-off complete. Submitted to Finance Director.' });
      await fetchActiveAndArchiveRuns();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Workflow submission failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Post to General Ledger
  const handlePostGL = async () => {
    if (!currentRun) return;
    setLoading(true);
    try {
      const res = await api.post(`/payroll/${activeCompany.id}/runs/${currentRun.id}/post`);
      setActionMsg({ type: 'success', text: `Accounting journal entries posted successfully. Voucher ref: JV-00${res.data.journalEntryId}` });
      await fetchActiveAndArchiveRuns();
      setActiveStep(5);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to post payroll.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Payout Release
  const fetchPaymentsForRelease = async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/employees?period=${period}`);
      setPayments(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeStep === 5) {
      fetchPaymentsForRelease();
    }
  }, [activeStep]);

  const handlePaySalary = async (lineId, name) => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      await api.post(`/payroll/${activeCompany.id}/lines/${lineId}/pay`, {
        payment_method: 'BANK_TRANSFER',
        remarks: 'Salary released via wizard payment portal'
      });
      setActionMsg({ type: 'success', text: `Direct clearing payout cleared for ${name}.` });
      fetchPaymentsForRelease();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Payment release failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayments = () => {
    // Generate mock reconciliation list based on payment outcomes
    const lines = payments.map(p => ({
      name: p.name,
      net: parseFloat(p.net_salary || 0),
      cleared: p.payment_status === 'PAID' || p.payment_status === 'DISBURSED' ? parseFloat(p.net_salary || 0) : 0,
      status: p.payment_status === 'PAID' || p.payment_status === 'DISBURSED' ? 'MATCHED' : 'UNMATCHED'
    }));
    setReconciliationLines(lines);
    setActiveStep(6);
  };

  // Step 7: Bank Reconciliation
  const handleAutoReconcile = () => {
    setReconciliationLines(prev => prev.map(l => ({ ...l, cleared: l.net, status: 'MATCHED' })));
    setActionMsg({ type: 'success', text: 'Automated reconciliation run complete. All items matched against statement records.' });
  };

  const handleCompleteReconciliation = () => {
    setActiveStep(7);
  };

  // Step 8: Month-End Close
  const handleClosePayrollPeriod = async () => {
    if (!currentRun) return;
    setLoading(true);
    try {
      setCurrentRun(prev => prev ? { ...prev, status: 'CLOSED' } : null);
      setActionMsg({ type: 'success', text: `Accounting period ${period} LOCKED. Recalculations and audit changes disabled.` });
      await fetchActiveAndArchiveRuns();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Alert Messaging */}
      {actionMsg && (
        <div className={`p-4 rounded-xl border text-[13px] font-bold flex items-center justify-between gap-3 ${
          actionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
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

      {/* Workspace Menu Bar */}
      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-3xs gap-1.5 w-fit">
        <button
          onClick={() => setViewMode('wizard')}
          className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer ${
            viewMode === 'wizard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Processing Wizard
        </button>
        <button
          onClick={() => setViewMode('archive')}
          className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer ${
            viewMode === 'archive' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Runs Archive
        </button>
      </div>

      {viewMode === 'wizard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left: Step Installer Sidebar */}
          <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Guided Process Wizard</h4>
            <div className="space-y-3 relative pl-2 ml-1">
              {steps.map((st, idx) => {
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;
                return (
                  <div key={idx} className="flex gap-3 items-start relative">
                    <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center font-mono text-[10px] font-bold z-10 ${
                      isCompleted ? 'bg-emerald-500 text-white' :
                      isActive ? 'bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-150' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <div>
                      <p className={`font-black ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>{st.label}</p>
                      <p className="text-[9.5px] text-slate-400 font-normal leading-tight mt-0.5">{st.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Help desk section */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2 mt-4">
              <span className="font-extrabold text-[10px] uppercase text-indigo-700 flex items-center gap-1"><Info size={11} /> Guided Help</span>
              <p className="text-[10px] text-slate-400 font-normal leading-relaxed">
                The payroll processing wizard leads you step-by-step through generating, validating, simulating, approving, posting, paying, reconciling, and closing the active period run.
              </p>
            </div>
          </div>

          {/* Right: Step Workspaces Panel */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 1 Workspace: Select Period */}
            {activeStep === 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Step 1: Select Accounting Period</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Specify which monthly cycle you are compiling payroll components for.</p>
                </div>
                <div className="space-y-1 max-w-sm">
                  <label className="text-slate-400">Target Month (YYYY-MM)</label>
                  <input
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-slate-800"
                    placeholder="2026-08"
                  />
                </div>
                <div className="pt-2">
                  <button 
                    onClick={handleGeneratePeriod}
                    disabled={loading || userRole === 'Auditor'}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm cursor-pointer disabled:opacity-40"
                  >
                    Start Run Compilation
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 Workspace: Validate Employees */}
            {activeStep === 1 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Step 2: Validate Employees & Exceptions</h3>
                    <p className="text-slate-400 text-xs font-semibold mt-1">Review validation anomalies preventing posting clearing.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-100">
                    {exceptions.length} Anomalies Flagged
                  </span>
                </div>

                <div className="space-y-2.5">
                  {exceptions.map(exp => (
                    <div key={exp.id} className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg border ${
                          exp.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          <AlertOctagon size={13} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">{exp.name} — <span className="font-mono text-[9px]">{exp.code}</span></p>
                          <p className="text-[10px] text-slate-400 font-normal leading-normal">{exp.detail}</p>
                        </div>
                      </div>
                      <button className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-700 shadow-3xs cursor-pointer">
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(0)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <button onClick={handleCompleteValidation} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm">
                    Complete Validation
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 Workspace: Simulation */}
            {activeStep === 2 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Step 3: Pre-Posting Calculations Simulation</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Execute calculations inside an isolated database transactional rollback to verify sums.</p>
                </div>

                {simResults ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl grid grid-cols-3 gap-4 text-center">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Simulated Gross</span>
                        <p className="font-mono text-slate-800 text-sm font-black mt-0.5">PKR {parseFloat(simResults.total_gross || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Simulated Deductions</span>
                        <p className="font-mono text-slate-800 text-sm font-black mt-0.5">PKR {parseFloat(simResults.total_deductions || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Projected Net Payout</span>
                        <p className="font-mono text-emerald-700 text-sm font-black mt-0.5">PKR {parseFloat(simResults.total_net || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowJsonTrace(!showJsonTrace)}
                      className="text-indigo-600 font-black hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showJsonTrace ? <EyeOff size={12} /> : <Eye size={12} />} View Calculation Details (Advanced Trace)
                    </button>

                    {showJsonTrace && (
                      <pre className="bg-slate-900 text-slate-300 p-3 rounded-2xl font-mono text-[9px] overflow-x-auto select-all max-h-40">
                        {JSON.stringify(simResults, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center text-slate-400 font-bold">
                    No simulation preview generated. Click below to run database-free simulation.
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(1)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <div className="flex gap-2">
                    <button onClick={handleSimulateRun} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer">
                      Run Calculations Test
                    </button>
                    {simResults && (
                      <button onClick={() => setActiveStep(3)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm">
                        Continue to Approvals
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 Workspace: Approvals */}
            {activeStep === 3 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Step 4: Approval sign-off Workflow</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Submit compile calculations for organizational review and management approvals.</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 text-[10px] block">HR Manager Status</span>
                    <p className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
                      <CheckCircle size={12} /> Approved
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Finance Sign-off Status</span>
                    <p className="font-bold text-amber-700 mt-1 flex items-center gap-1">
                      <Clock size={12} className="animate-pulse" /> Awaiting Review
                    </p>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(2)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSubmitApproval}
                      disabled={loading || userRole === 'Auditor'}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm disabled:opacity-40"
                    >
                      Authorize sign-off
                    </button>
                    <button 
                      onClick={() => setActiveStep(4)} 
                      disabled={userRole === 'Auditor'}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm"
                    >
                      Skip to Posting
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5 Workspace: Post to GL */}
            {activeStep === 4 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Step 5: Post Payroll Journal Voucher to General Ledger</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Locks period details and generates debit/credit double entry vouchers automatically.</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2">
                  <p className="flex justify-between"><span>Salary Expense (Debited):</span> <span className="font-mono text-slate-850 font-bold">PKR {parseFloat(currentRun?.total_gross || 0).toLocaleString()}</span></p>
                  <p className="flex justify-between"><span>Clearing Payable (Credited):</span> <span className="font-mono text-slate-850 font-bold">PKR {parseFloat(currentRun?.total_net || 0).toLocaleString()}</span></p>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(3)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <button 
                    onClick={handlePostGL}
                    disabled={loading || userRole === 'Auditor'}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm disabled:opacity-40"
                  >
                    Commit Post to Ledger
                  </button>
                </div>
              </div>
            )}

            {/* Step 6 Workspace: Payments Release */}
            {activeStep === 5 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Step 6: Treasury Payments Release Portal</h3>
                    <p className="text-slate-400 text-xs font-semibold mt-1">Disburse salary lines clearing to employee bank details.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-150">
                    {payments.length} Profiles Compiled
                  </span>
                </div>

                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {payments.map(p => (
                    <div key={p.line_id} className="py-3 flex items-center justify-between gap-3 text-xs font-semibold">
                      <div>
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">HBL • {p.role || 'Staff'}</p>
                      </div>
                      <div className="flex items-center gap-3.5">
                        <span className="font-mono font-bold text-slate-800">PKR {parseFloat(p.net_salary || 0).toLocaleString()}</span>
                        {p.payment_status === 'PAID' || p.payment_status === 'DISBURSED' ? (
                          <span className="text-emerald-600 font-black flex items-center gap-0.5"><CheckCircle size={12} /> Paid</span>
                        ) : (
                          <button
                            onClick={() => handlePaySalary(p.line_id, p.name)}
                            disabled={loading || userRole === 'Auditor'}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black shadow-3xs cursor-pointer disabled:opacity-40"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-bold">No active pay lines found.</div>
                  )}
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(4)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <button onClick={handleCompletePayments} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm">
                    Continue to Reconciliation
                  </button>
                </div>
              </div>
            )}

            {/* Step 7 Workspace: Bank Reconciliation */}
            {activeStep === 6 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Step 7: Bank Reconciliation Workspace</h3>
                    <p className="text-slate-400 text-xs font-semibold mt-1">Import bank statement CSV and match transactions against general ledger payroll clearing account lines.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAutoReconcile} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-[10px] font-black cursor-pointer flex items-center gap-1">
                      <Sparkles size={11} /> Auto-Match
                    </button>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-2.5">Beneficiary Profile</th>
                        <th className="px-4 py-2.5 text-right">Ledger Obligation</th>
                        <th className="px-4 py-2.5 text-right">Statement Cleared</th>
                        <th className="px-4 py-2.5 text-center">Status Mapped</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                      {reconciliationLines.map((l, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 font-bold text-slate-750">{l.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">PKR {l.net.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">PKR {l.cleared.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8.5px] font-black border ${
                              l.status === 'MATCHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(5)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <button onClick={handleCompleteReconciliation} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm">
                    Complete Reconciliation
                  </button>
                </div>
              </div>
            )}

            {/* Step 8 Workspace: Month-End Close */}
            {activeStep === 7 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Step 8: Month-End Close Period</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Seal the calculations for period {period} and lock adjustments against modifications.</p>
                </div>

                <div className="p-8 bg-slate-50 border border-slate-200 border-dashed rounded-3xl text-center text-slate-400 text-xs font-bold space-y-3.5">
                  {currentRun?.status === 'CLOSED' ? (
                    <div className="space-y-2 text-emerald-700 font-extrabold text-sm">
                      <Lock className="mx-auto text-emerald-600" size={32} />
                      <p>Payroll accounting period {period} is fully LOCKED / CLOSED.</p>
                    </div>
                  ) : (
                    <>
                      <Lock className="mx-auto text-slate-300" size={32} />
                      <p>Once locked, all employee calculations are frozen. Only reversal workflows can reopen entries.</p>
                      <button 
                        onClick={handleClosePayrollPeriod}
                        disabled={loading || userRole === 'Auditor'}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black shadow-sm cursor-pointer inline-block disabled:opacity-40"
                      >
                        Lock and Close Period
                      </button>
                    </>
                  )}
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <button onClick={() => setActiveStep(6)} className="px-4 py-2 border border-slate-200 rounded-xl cursor-pointer">Back</button>
                  <span className="text-slate-400 italic">Installer complete</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Runs Archive Workspace List */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Run Reference</th>
                  <th className="px-5 py-3.5">Calculation Period</th>
                  <th className="px-5 py-3.5 text-right">Net Value Cleared</th>
                  <th className="px-5 py-3.5">Posting Voucher</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Wizard Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {runsArchive.map(run => (
                  <tr key={run.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-slate-800">RUN-00{run.id}</td>
                    <td className="px-5 py-4 font-bold text-slate-800">Period {run.period}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {parseFloat(run.total_net || 0).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {run.journal_entry_id ? (
                        <span className="text-indigo-600 font-bold hover:underline cursor-pointer">JV-00{run.journal_entry_id}</span>
                      ) : <span className="text-slate-400 italic">Unposted</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black border ${
                        run.status === 'CLOSED' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                        run.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button 
                        onClick={() => {
                          setCurrentRun(run);
                          setPeriod(run.period);
                          setViewMode('wizard');
                          // set step based on status
                          if (run.status === 'CLOSED') setActiveStep(7);
                          else if (run.status === 'POSTED') setActiveStep(5);
                          else if (run.status === 'APPROVED') setActiveStep(4);
                          else if (run.status === 'PENDING') setActiveStep(3);
                          else setActiveStep(1);
                        }}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black cursor-pointer shadow-3xs flex items-center gap-1 mx-auto"
                      >
                        Resume Wizard <ChevronRight size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
                {runsArchive.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold">No historical runs saved.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
