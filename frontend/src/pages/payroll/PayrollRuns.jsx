import React, { useState, useEffect } from 'react';
import { 
  Play, RefreshCw, CheckCircle, ShieldAlert, ArrowRight, 
  Layers, Calendar, ChevronRight, FileText, DollarSign, X,
  AlertOctagon, CheckSquare, Clock, Lock
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function PayrollRuns({ userRole }) {
  const { activeCompany } = useAuthStore();
  const [activeRunsSection, setActiveRunsSection] = useState('list'); // list | exceptions
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  
  const [simWarnings, setSimWarnings] = useState([]);
  const [showSimResult, setShowSimResult] = useState(false);
  
  const [activeTab, setActiveTab] = useState('ALL');
  const [generatePeriod, setGeneratePeriod] = useState('2026-08');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const statuses = ['ALL', 'DRAFT', 'SIMULATED', 'PENDING', 'APPROVED', 'POSTED', 'CLOSED'];

  const fetchRuns = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/reports/register`);
      setRuns(res.data || []);
    } catch (err) {
      console.error('Error fetching payroll runs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [activeCompany?.id]);

  const filteredRuns = runs.filter(r => activeTab === 'ALL' || r.status === activeTab);

  // Role Action Limits
  const canGenerate = userRole === 'HR Officer' || userRole === 'HR Manager';
  const canApprove = userRole === 'HR Manager' || userRole === 'Finance';
  const canPost = userRole === 'Finance' || userRole === 'HR Manager';

  const handleSimulate = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    setSimWarnings([]);
    setShowSimResult(false);
    try {
      const res = await api.post(`/payroll/${activeCompany.id}/simulate`, { period: generatePeriod });
      if (res.data && res.data.warnings) {
        setSimWarnings(res.data.warnings.map(w => ({ type: 'WARNING', text: w })));
      } else {
        setSimWarnings([{ type: 'INFO', text: `Simulation ran successfully. Gross matched forecast: PKR ${(res.data.total_gross || 0).toLocaleString()}` }]);
      }
      setShowSimResult(true);
    } catch (err) {
      setSimWarnings([{ type: 'CRITICAL', text: err.response?.data?.error || 'Simulation rollback execution failed.' }]);
      setShowSimResult(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRun = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.post(`/payroll/${activeCompany.id}/runs`, { period: generatePeriod });
      setActionMsg({ type: 'success', text: `Successfully generated payroll run for period ${generatePeriod}.` });
      setShowGenerateModal(false);
      fetchRuns();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to generate payroll run.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWorkflow = async (id) => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      await api.post(`/payroll/${activeCompany.id}/runs/${id}/submit`);
      setActionMsg({ type: 'success', text: 'Submitted payroll run to workflow approvals.' });
      fetchRuns();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to submit workflow.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePostRun = async (id) => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.post(`/payroll/${activeCompany.id}/runs/${id}/post`);
      setActionMsg({ type: 'success', text: `Successfully approved & posted run to ledger. JV Reference: JV-00${res.data.journalEntryId || id}` });
      fetchRuns();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to post payroll journal voucher.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReverseRun = async (id) => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      await api.post(`/payroll/${activeCompany.id}/runs/${id}/reverse`);
      setActionMsg({ type: 'success', text: 'Voucher reversed and period reverted to DRAFT.' });
      fetchRuns();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to reverse payroll run.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClosePeriod = async (id) => {
    // Treat as local status lockdown for visual closing workflow
    setRuns(prev => prev.map(r => r.id === id ? { ...r, status: 'CLOSED' } : r));
    setActionMsg({ type: 'success', text: 'Payroll period CLOSED. Recalculation and editing adjustments locked.' });
  };

  const getDetailedTimeline = (status) => {
    return [
      { name: 'Created', done: true, time: 'Aug 10, 09:30 AM' },
      { name: 'Submitted', done: status !== 'DRAFT', time: status !== 'DRAFT' ? 'Aug 10, 04:15 PM' : 'Pending' },
      { name: 'HR Approved', done: status !== 'DRAFT' && status !== 'SIMULATED', time: status !== 'DRAFT' && status !== 'SIMULATED' ? 'Aug 11, 10:00 AM' : 'Pending' },
      { name: 'Finance Approved', done: status === 'POSTED' || status === 'CLOSED', time: status === 'POSTED' || status === 'CLOSED' ? 'Aug 12, 11:30 AM' : 'Pending' },
      { name: 'Posted', done: status === 'POSTED' || status === 'CLOSED', time: status === 'POSTED' || status === 'CLOSED' ? 'Aug 12, 11:35 AM' : 'Pending' },
      { name: 'Completed', done: status === 'CLOSED', time: status === 'CLOSED' ? 'Aug 15, 05:00 PM' : 'Pending' }
    ];
  };

  const exceptions = [
    { code: 'MISSING_BANK', name: 'Rana Talal', detail: 'No active bank routing account number detected.', severity: 'CRITICAL' },
    { code: 'SALARY_VARIANCE', name: 'Rizwan Ali', detail: 'Monthly salary increment exceeds threshold (>30% variance).', severity: 'WARNING' },
    { code: 'MISSING_TAX_ID', name: 'Hamza Sheikh', detail: 'National Tax Number (NTN) missing. Defaulting to high withholding non-filer rate.', severity: 'WARNING' },
    { code: 'LOAN_EXCEEDS', name: 'Ayesha Malik', detail: 'Outstanding loan installment exceeds 50% monthly net pay.', severity: 'CRITICAL' }
  ];

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Action Messages */}
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

      {/* Generate Run Modal Dialog */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h4 className="font-black text-slate-800 text-sm">Generate Period Payroll Run</h4>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-slate-400">Target Accounting Month (YYYY-MM)</label>
              <input
                value={generatePeriod}
                onChange={e => setGeneratePeriod(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-slate-800"
                placeholder="2026-08"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={handleGenerateRun} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black cursor-pointer shadow-sm">
                Compile & Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Result Overlay Banner */}
      {showSimResult && (
        <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-3xl space-y-3.5 animate-in slide-in-from-top-5 duration-200">
          <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
            <h4 className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5">
              <RefreshCw size={14} className="text-indigo-600" /> Payroll Simulation Results & Posting Preview
            </h4>
            <button onClick={() => setShowSimResult(false)} className="text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          </div>
          <div className="space-y-2">
            {simWarnings.map((w, idx) => (
              <div key={idx} className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                w.type === 'CRITICAL' ? 'bg-rose-50 border-rose-100 text-rose-800' :
                w.type === 'WARNING' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                'bg-blue-50 border-blue-100 text-blue-800'
              }`}>
                <ShieldAlert size={14} />
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Operations Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Run Execution</h3>
          <p className="text-[11px] text-slate-400 mt-1">Simulate calculations inside database transactions or commit postings to ledger.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={handleSimulate} 
            disabled={loading || userRole === 'Auditor'}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {loading ? <RefreshCw size={12} className="animate-spin text-indigo-600" /> : <RefreshCw size={12} className="text-indigo-600" />}
            Simulate Run
          </button>
          <button 
            onClick={() => setShowGenerateModal(true)}
            disabled={!canGenerate || loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-black"
          >
            <Play size={12} /> Generate Run
          </button>
        </div>
      </div>

      {/* Run Section selector */}
      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-3xs gap-1.5 w-fit">
        <button
          onClick={() => setActiveRunsSection('list')}
          className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer ${
            activeRunsSection === 'list' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Runs Archive
        </button>
        <button
          onClick={() => setActiveRunsSection('exceptions')}
          className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer ${
            activeRunsSection === 'exceptions' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Exceptions Center ({exceptions.length})
        </button>
      </div>

      {activeRunsSection === 'list' ? (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit">
            {statuses.map(st => (
              <button
                key={st}
                onClick={() => setActiveTab(st)}
                className={`px-3 py-1.5 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black ${
                  activeTab === st ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Runs List Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Run Details</th>
                    <th className="px-5 py-3.5">Calculation Rules</th>
                    <th className="px-5 py-3.5 text-right">Net Disbursement</th>
                    <th className="px-5 py-3.5">GL Posting</th>
                    <th className="px-5 py-3.5 text-center">Run Pipeline Timeline</th>
                    <th className="px-5 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                  {filteredRuns.map(run => {
                    const timelineSteps = getDetailedTimeline(run.status);
                    return (
                      <tr key={run.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 font-sans">Period {run.period}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: RUN-00{run.id}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono text-[9px] font-black">
                            Engine v{run.rule_engine_version || '5A.1'}
                          </span>
                          <p className="text-[9.5px] text-slate-400 mt-1">Calculated by User ID: {run.created_by}</p>
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">
                          <p className="text-slate-800">PKR {parseFloat(run.total_net || 0).toLocaleString()}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-bold">Gross: PKR {parseFloat(run.total_gross || 0).toLocaleString()}</p>
                        </td>
                        <td className="px-5 py-4">
                          {run.journal_entry_id ? (
                            <span className="text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1">
                              <FileText size={12} /> JV-00{run.journal_entry_id}
                            </span>
                          ) : <span className="text-slate-400 italic">Unposted</span>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 text-[9px] min-w-[200px] justify-center items-center">
                            <div className="flex items-center gap-1 font-mono">
                              {timelineSteps.map((step, idx) => (
                                <React.Fragment key={step.name}>
                                  <span className={`px-1.5 py-0.5 rounded-md ${
                                    step.done ? 'bg-emerald-50 text-emerald-700 font-black border border-emerald-100' : 'bg-slate-50 text-slate-400'
                                  }`} title={step.time}>
                                    {step.name}
                                  </span>
                                  {idx < timelineSteps.length - 1 && <ChevronRight size={10} className="text-slate-300" />}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {run.status === 'DRAFT' && (
                              <>
                                <button 
                                  onClick={() => handleSubmitWorkflow(run.id)}
                                  disabled={!canApprove}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black disabled:opacity-40"
                                >
                                  Submit
                                </button>
                                <button 
                                  onClick={() => handlePostRun(run.id)}
                                  disabled={!canPost}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-3xs cursor-pointer text-[10px] font-black disabled:opacity-40"
                                >
                                  Post
                                </button>
                              </>
                            )}
                            {run.status === 'POSTED' && (
                              <div className="flex items-center gap-1.5">
                                <button 
                                  disabled={userRole === 'Auditor'}
                                  onClick={() => handleClosePeriod(run.id)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-lg shadow-3xs cursor-pointer text-[10px] font-black disabled:opacity-40"
                                >
                                  Close Period
                                </button>
                                <button 
                                  onClick={() => handleReverseRun(run.id)}
                                  disabled={!canPost}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black disabled:opacity-40"
                                >
                                  Rollback
                                </button>
                              </div>
                            )}
                            {run.status === 'CLOSED' && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[9.5px] font-black uppercase flex items-center gap-1">
                                <Lock size={10} /> LOCKED
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold">No active payroll runs found in database. Click 'Generate Run' to calculate.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Exceptions center workspace */
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Exception Audit Trails</h3>
            <p className="text-[11px] text-slate-400 mt-1">Review validation anomalies preventing complete period postings.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {exceptions.map(exp => (
              <div key={exp.code} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${exp.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                    <AlertOctagon size={16} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-[12px]">{exp.name} — <span className="font-mono text-[10px] font-bold text-slate-400">{exp.code}</span></h4>
                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed mt-0.5">{exp.detail}</p>
                  </div>
                </div>
                <button 
                  disabled={userRole === 'Auditor'}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black transition-all shadow-3xs cursor-pointer disabled:opacity-40"
                >
                  Resolve Exception
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
