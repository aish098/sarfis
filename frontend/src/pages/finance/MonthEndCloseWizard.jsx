import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Calendar, AlertTriangle, CheckCircle2, Lock, Unlock, 
  RefreshCw, FileText, ChevronRight, Download, Play, Eye
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Dashboard sub-components
import CloseReadinessCard from '../../components/finance/CloseReadinessCard';
import FinancialSummaryCard from '../../components/finance/FinancialSummaryCard';
import ModuleHealthPanel from '../../components/finance/ModuleHealthPanel';
import ChecklistActions from '../../components/finance/ChecklistActions';
import CloseTimeline from '../../components/finance/CloseTimeline';
import SignOffPanel from '../../components/finance/SignOffPanel';

export default function MonthEndCloseWizard() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Close session details
  const [dashboardData, setDashboardData] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [moduleHealth, setModuleHealth] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [signoffs, setSignoffs] = useState([]);
  const [closeSession, setCloseSession] = useState(null);
  const [checklistData, setChecklistData] = useState(null);

  // Actions
  const [reopenReason, setReopenReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
        const open = data.find(p => p.status === 'OPEN');
        setSelectedPeriod(open || data[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch accounting periods.');
    }
  };

  const loadCloseDetails = async (periodId) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const [dashRes, summaryRes, healthRes, timelineRes, signoffsRes, checklistRes] = await Promise.all([
        api.get(`/periods/${activeCompany.id}/${periodId}/dashboard`),
        api.get(`/periods/${activeCompany.id}/${periodId}/financial-summary`),
        api.get(`/periods/${activeCompany.id}/${periodId}/module-health`),
        api.get(`/periods/${activeCompany.id}/${periodId}/timeline`),
        api.get(`/periods/${activeCompany.id}/${periodId}/signoffs`),
        api.get(`/periods/${activeCompany.id}/${periodId}/close-checklist`)
      ]);

      setDashboardData(dashRes.data);
      setFinancialSummary(summaryRes.data);
      setModuleHealth(healthRes.data);
      setTimeline(timelineRes.data);
      setSignoffs(signoffsRes.data.signoffs);
      setCloseSession(signoffsRes.data.session);
      setChecklistData(checklistRes.data);
      
      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load closing diagnostics.');
    }
    setLoading(false);
  };

  const handlePeriodChange = (e) => {
    const p = periods.find(x => String(x.id) === e.target.value);
    setSelectedPeriod(p);
    setCurrentStep(1);
    setDashboardData(null);
  };

  const handleGenerateMissing = async () => {
    if (!activeCompany || !selectedPeriod) return;
    const targetYear = new Date(selectedPeriod.start_date).getFullYear();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.post(`/accounting-periods/${activeCompany.id}/generate-missing`, {
        fiscalYear: targetYear
      });
      await fetchPeriods();
      setSuccessMsg(`Generated ${res.data.created} missing periods for Fiscal Year ${targetYear}.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate missing periods.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSignoff = async (step, checked) => {
    if (!selectedPeriod) return;
    try {
      await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/signoffs`, { step, checked });
      // Reload details to reflect new checkoff
      const signoffsRes = await api.get(`/periods/${activeCompany.id}/${selectedPeriod.id}/signoffs`);
      setSignoffs(signoffsRes.data.signoffs);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update sign-off.');
    }
  };

  const handleStartSession = async () => {
    if (!selectedPeriod) return;
    setActionLoading(true);
    try {
      await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/start-session`);
      await loadCloseDetails(selectedPeriod.id);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to start closing session.');
    }
    setActionLoading(false);
  };

  const handleSubmitApproval = async () => {
    if (!selectedPeriod) return;
    setActionLoading(true);
    try {
      const { data } = await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/submit-approval`);
      setSuccessMsg(data.message || 'Close workflow submitted successfully.');
      await loadCloseDetails(selectedPeriod.id);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit workflow approval.');
    }
    setActionLoading(false);
  };

  const handleClosePeriodDirectly = async () => {
    if (!selectedPeriod) return;
    setActionLoading(true);
    try {
      await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/close`);
      setSuccessMsg(`Accounting period '${selectedPeriod.period_name}' has been successfully locked.`);
      await loadCloseDetails(selectedPeriod.id);
      fetchPeriods();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to close accounting period.');
    }
    setActionLoading(false);
  };

  const handleReopenPeriod = async () => {
    if (!selectedPeriod || !reopenReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/periods/${activeCompany.id}/${selectedPeriod.id}/reopen`, { reason: reopenReason });
      setSuccessMsg(`Accounting period '${selectedPeriod.period_name}' is now reopened.`);
      setReopenReason('');
      await loadCloseDetails(selectedPeriod.id);
      fetchPeriods();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to reopen accounting period.');
    }
    setActionLoading(false);
  };

  const downloadReport = (format) => {
    if (!selectedPeriod) return;
    const token = localStorage.getItem('token');
    window.open(`${api.defaults.baseURL}/periods/${selectedPeriod.id}/report?format=${format}&token=${token}`, '_blank');
  };

  const isDecember = selectedPeriod?.period_name?.toLowerCase().includes('december') || 
                      (selectedPeriod?.start_date && new Date(selectedPeriod.start_date).getMonth() === 11);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
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
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Closing Workspace</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5">
              Verify posting logs, inventory, bank balances, and lock accounting periods.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2 font-bold">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: PERIOD SELECTION */}
        {currentStep === 1 ? (
          <motion.div 
            key="step-1" 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -8 }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
          >
            <div>
              <h2 className="text-lg font-black text-slate-800">Select Target Accounting Period</h2>
              <p className="text-slate-400 text-xs mt-0.5">Choose the open period to compile the close checklist or view closed history logs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Period</label>
                  <select 
                    value={selectedPeriod?.id || ''} 
                    onChange={handlePeriodChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[13px] font-bold outline-none focus:border-emerald-500"
                  >
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>{p.period_name} ({p.status})</option>
                    ))}
                  </select>
                </div>

                {selectedPeriod && (
                  <div className="p-4 rounded-2xl border border-slate-100 bg-[#FAF9F8] space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex justify-between"><span>Start Date:</span><span className="font-bold text-slate-800">{new Date(selectedPeriod.start_date).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>End Date:</span><span className="font-bold text-slate-800">{new Date(selectedPeriod.end_date).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>Current Status:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        selectedPeriod.status === 'CLOSED' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>{selectedPeriod.status}</span>
                    </div>
                  </div>
                )}

                {selectedPeriod && (() => {
                  const targetYear = new Date(selectedPeriod.start_date).getFullYear();
                  const yearPeriodsCount = periods.filter(p => new Date(p.start_date).getFullYear() === targetYear).length;
                  if (yearPeriodsCount < 12) {
                    return (
                      <div className="p-4 rounded-2xl border border-amber-250 bg-amber-50/50 text-xs font-semibold text-amber-800 space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold uppercase text-[10px] tracking-wider text-amber-700">Missing Fiscal Periods</p>
                            <p className="leading-relaxed mt-0.5">Only {yearPeriodsCount} of 12 periods are initialized for Fiscal Year {targetYear}.</p>
                          </div>
                        </div>
                        <button
                          disabled={actionLoading}
                          onClick={handleGenerateMissing}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer border-none"
                        >
                          {actionLoading ? 'Generating...' : `Generate Missing Periods for ${targetYear}`}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                <button
                  disabled={loading}
                  onClick={() => loadCloseDetails(selectedPeriod.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {loading ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />} Run Checklist Diagnostics
                </button>
              </div>

              <div className="p-6 border border-slate-100 rounded-3xl bg-[#FAF9F8] min-h-[180px] flex flex-col justify-center text-center">
                <p className="text-slate-400 text-xs font-semibold italic leading-relaxed">
                  Select a period and click "Run Checklist Diagnostics" to launch the comprehensive closed workspace.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* STEP 2: CLOSE WORKSPACE DASHBOARD */
          <motion.div 
            key="step-2" 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Action Bar (Download Report, Back to Selection) */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <button 
                onClick={() => setCurrentStep(1)} 
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
              >
                <ArrowLeft size={14} /> Select Another Period
              </button>

              {closeSession?.status === 'CLOSED' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => downloadReport('pdf')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all border border-slate-200"
                  >
                    <Download size={13} /> PDF Report
                  </button>
                  <button 
                    onClick={() => downloadReport('json')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all border border-slate-200"
                  >
                    <Download size={13} /> JSON Export
                  </button>
                </div>
              )}
            </div>

            {/* December Year-End Warning */}
            {isDecember && selectedPeriod?.status === 'OPEN' && (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-3 text-xs text-amber-800">
                  <span className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                    <Calendar size={18} />
                  </span>
                  <div>
                    <h4 className="font-black text-slate-800">Fiscal Year-End Notice</h4>
                    <p className="font-semibold text-slate-600 mt-0.5">Closing December will roll balances forward and prompt the Year-End Closing Wizard.</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/dashboard/finance/year-end')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition-all shrink-0 whitespace-nowrap"
                >
                  Start Fiscal Year Closing
                </button>
              </div>
            )}

            {/* Readiness dashboard card */}
            <CloseReadinessCard 
              progress={dashboardData?.progress || 0}
              status={closeSession?.status || 'OPEN'}
              blockers={dashboardData?.blockers || 0}
              warnings={dashboardData?.warnings || 0}
              completedChecks={dashboardData?.completedChecks || 0}
              totalChecks={dashboardData?.totalChecks || 7}
              onRunChecklist={() => loadCloseDetails(selectedPeriod.id)}
              loading={loading}
            />

            {/* Main Workspace split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Diagnostics list, health grids, timeline */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Module Health Check */}
                <ModuleHealthPanel health={moduleHealth} />

                {/* Diagnostics List */}
                <ChecklistActions checklist={checklistData} />

                {/* Financial Summary card */}
                <FinancialSummaryCard summary={financialSummary} />

                {/* Timeline */}
                <CloseTimeline timeline={timeline} />

              </div>

              {/* Right Column: Stakeholder sign-offs, action panel */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Sign-offs panel */}
                <SignOffPanel 
                  signoffs={signoffs}
                  onToggleSignoff={handleToggleSignoff}
                  status={closeSession?.status || 'OPEN'}
                />

                {/* Actions Panel */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Lock Actions</h3>

                  {closeSession?.status === 'OPEN' && (
                    <button
                      disabled={actionLoading}
                      onClick={handleStartSession}
                      className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all disabled:opacity-50"
                    >
                      Initialize Close Session
                    </button>
                  )}

                  {closeSession?.status === 'READY_TO_CLOSE' && (
                    <div className="space-y-2">
                      <button
                        disabled={actionLoading}
                        onClick={handleSubmitApproval}
                        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all disabled:opacity-50"
                      >
                        Submit for Management Approval
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={handleClosePeriodDirectly}
                        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all disabled:opacity-50"
                      >
                        Direct Lock & Close Period
                      </button>
                    </div>
                  )}

                  {closeSession?.status === 'PENDING_APPROVAL' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl text-center space-y-1">
                      <p className="font-extrabold uppercase text-[10px] tracking-wider text-amber-700">Awaiting Close Approval</p>
                      <p className="leading-relaxed">This period closing session has been submitted to the CFO workflow. The period will lock automatically upon CFO approval.</p>
                    </div>
                  )}

                  {closeSession?.status === 'CLOSED' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-2xl text-center space-y-1">
                        <p className="font-extrabold uppercase text-[10px] tracking-wider text-slate-600">Period Closed & Locked</p>
                        <p className="leading-relaxed">No further ledger postings, voucher creations, or adjustments are permitted in this range.</p>
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reopen Audit Reason</label>
                        <textarea
                          rows={3}
                          placeholder="State the auditor correction adjustments reason..."
                          value={reopenReason}
                          onChange={e => setReopenReason(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs font-semibold focus:border-emerald-500 resize-none"
                        />
                        <button
                          disabled={!reopenReason.trim() || actionLoading}
                          onClick={handleReopenPeriod}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs disabled:opacity-50"
                        >
                          Reopen Accounting Period
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
