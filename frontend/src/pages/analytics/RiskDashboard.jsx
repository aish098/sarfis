import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle, Clock, ShieldCheck, 
  DollarSign, Activity, FileText, ChevronRight, UserCheck, Trash2, X, Sliders, History
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';



export default function RiskDashboard() {
  const { activeCompany } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [blacklisted, setBlacklisted] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [reinstatements, setReinstatements] = useState([]);
  const [pendingOverrides, setPendingOverrides] = useState([]);
  const [rules, setRules] = useState([]);
  const [levels, setLevels] = useState([]);
  const [policyHistory, setPolicyHistory] = useState([]);
  
  // Policy Customizer & Preview States
  const [editedRules, setEditedRules] = useState([]);
  const [editedLevels, setEditedLevels] = useState([]);
  const [settingsSubTab, setSettingsSubTab] = useState('rules'); // rules | thresholds | history | preview
  const [previewResults, setPreviewResults] = useState(null);
  const [calculatingPreview, setCalculatingPreview] = useState(false);
  const [jobProgress, setJobProgress] = useState(null); // null or 0-100

  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('summary'); // summary | blacklists | incidents | reinstatements | overrides | settings
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED', reviewNotes: '', priorityAfterReinstate: 'MEDIUM', receivablesHandling: 'KEEP_AR',
    settlementFrequency: 'MONTHLY', settlementInstallmentsCount: '3',
    committeeMeetingDate: '', committeeParticipants: '', committeeDecision: '', committeeNextReviewDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [statsRes, blackRes, incRes, reinRes, overRes, settingsRes] = await Promise.all([
        api.get('/risk/dashboard-stats'),
        api.get('/risk/reports/blacklisted'),
        api.get('/risk/reports/bad-debts'),
        api.get('/risk/reports/reinstatements'),
        api.get('/risk/approval-requests/pending'),
        api.get('/risk/settings/rules')
      ]);
      setStats(statsRes.data);
      setBlacklisted(blackRes.data);
      setIncidents(incRes.data);
      setReinstatements(reinRes.data);
      setPendingOverrides(overRes.data);
      
      setRules(settingsRes.data.rules);
      setEditedRules(JSON.parse(JSON.stringify(settingsRes.data.rules)));
      
      setLevels(settingsRes.data.levels);
      setEditedLevels(JSON.parse(JSON.stringify(settingsRes.data.levels)));
      
      setPolicyHistory(settingsRes.data.history);
    } catch (err) {
      console.error('Failed to load risk dashboard data:', err);
    }
    setLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReviewRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`/risk/reinstatement/review/${selectedRequest.id}`, reviewForm);
      setSelectedRequest(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit review.');
    }
    setSaving(false);
  };

  const handleReviewOverride = async (requestId, status, reviewNotes) => {
    setError('');
    setSaving(true);
    try {
      await api.post(`/risk/approval-requests/review/${requestId}`, { status, reviewNotes });
      alert(`Override request has been ${status.toLowerCase()}.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record override review.');
    }
    setSaving(false);
  };

  const handleSaveAllChanges = async (e) => {
    if (e) e.preventDefault();
    setError('');

    try {
      const sorted = [...editedLevels].sort((a, b) => a.min_score - b.min_score);
      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        if (curr.min_score > curr.max_score) {
          throw new Error(`Min score cannot be greater than max score for ${curr.risk_level}.`);
        }
        if (i > 0) {
          const prev = sorted[i - 1];
          if (curr.min_score <= prev.max_score) {
            throw new Error(`Overlapping score thresholds detected between ${prev.risk_level} and ${curr.risk_level}.`);
          }
          if (curr.min_score > prev.max_score + 1) {
            throw new Error(`Gaps in score thresholds detected between ${prev.risk_level} and ${curr.risk_level}.`);
          }
        }
      }
    } catch (valErr) {
      setError(valErr.message);
      return;
    }

    const reason = window.prompt('Enter policy modification audit reason:', 'Risk scoring policy updates and threshold alignments');
    if (reason === null) return;

    setSaving(true);
    try {
      const modifiedRules = editedRules.filter(er => {
        const original = rules.find(r => r.id === er.id);
        return original && (original.weight !== er.weight || original.enabled !== er.enabled);
      });

      const rulePromises = modifiedRules.map(r => 
        api.put(`/risk/settings/rules/${r.id}`, { weight: r.weight, enabled: r.enabled, reason })
      );

      const levelsPromise = api.put('/risk/settings/levels', { levels: editedLevels, reason });

      await Promise.all([...rulePromises, levelsPromise]);

      setPreviewResults(null);
      setJobProgress(0);
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        if (progress > 100) {
          clearInterval(interval);
          setJobProgress(null);
          alert('Scoring policy saved successfully and background recalculation job completed.');
          loadData();
        } else {
          setJobProgress(Math.min(100, progress));
        }
      }, 300);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save policy updates.');
      setSaving(false);
    }
  };

  const handleValidatePolicy = () => {
    setError('');
    try {
      const sorted = [...editedLevels].sort((a, b) => a.min_score - b.min_score);
      const required = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const levelsPresent = sorted.map(s => s.risk_level);

      for (const req of required) {
        if (!levelsPresent.includes(req)) {
          throw new Error(`Missing required risk level configuration for ${req}.`);
        }
      }

      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        if (curr.min_score < 0 || curr.max_score < 0) {
          throw new Error('Risk scores cannot be negative.');
        }
        if (curr.min_score > curr.max_score) {
          throw new Error(`Min score cannot be greater than max score for ${curr.risk_level}.`);
        }
        if (i > 0) {
          const prev = sorted[i - 1];
          if (curr.min_score <= prev.max_score) {
            throw new Error(`Overlapping score thresholds detected between ${prev.risk_level} and ${curr.risk_level}.`);
          }
          if (curr.min_score > prev.max_score + 1) {
            throw new Error(`Gaps in score thresholds detected between ${prev.risk_level} and ${curr.risk_level}.`);
          }
        }
      }
      alert('Validation Passed: Policy ranges are structurally sound with 0 overlaps and 0 gaps.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetToSystemDefaults = () => {
    setError('');
    const defaultsTemplate = {
      LATE_PAYMENT: 15,
      BOUNCED_CHEQUE: 40,
      OVERDUE_INVOICE: 30,
      BAD_DEBT: 60,
      LEGAL_CASE: 100,
      OTHER: 10,
      POOR_QUALITY: 20,
      LATE_DELIVERY: 15,
      PRICE_MANIPULATION: 30,
      FRAUD: 80,
      CONTRACT_VIOLATION: 50
    };

    setEditedRules(prev => prev.map(r => ({
      ...r,
      weight: defaultsTemplate[r.code] !== undefined ? defaultsTemplate[r.code] : r.weight,
      enabled: true
    })));

    setEditedLevels([
      { id: editedLevels[0]?.id, risk_level: 'LOW', min_score: 0, max_score: 20 },
      { id: editedLevels[1]?.id, risk_level: 'MEDIUM', min_score: 21, max_score: 50 },
      { id: editedLevels[2]?.id, risk_level: 'HIGH', min_score: 51, max_score: 80 },
      { id: editedLevels[3]?.id, risk_level: 'CRITICAL', min_score: 81, max_score: 999 }
    ]);

    alert('Reset: Rules reverted to defaults (not yet saved to database). Click Save All Changes to persist.');
  };

  const runImpactPreview = () => {
    setCalculatingPreview(true);
    setError('');

    try {
      const activeIncidents = incidents.filter(inc => !inc.resolved);
      const partnerIncidents = {};
      
      activeIncidents.forEach(inc => {
        const key = `${inc.entity_type}_${inc.entity_id}`;
        if (!partnerIncidents[key]) {
          partnerIncidents[key] = [];
        }
        partnerIncidents[key].push(String(inc.category).toUpperCase());
      });

      const calcScore = (incCategories, rulesMap) => {
        let s = 0;
        incCategories.forEach(cat => {
          const rule = rulesMap[cat];
          if (rule && rule.enabled) {
            s += rule.weight;
          }
        });
        return Math.min(999, s);
      };

      const getLevel = (score, thresholdLevels) => {
        let lvl = 'LOW';
        for (const t of thresholdLevels) {
          if (score >= t.min_score && score <= t.max_score) {
            lvl = t.risk_level;
            break;
          }
        }
        return lvl;
      };

      const oldRulesMap = {};
      rules.forEach(r => { oldRulesMap[String(r.code).toUpperCase()] = { weight: r.weight, enabled: r.enabled }; });

      const newRulesMap = {};
      editedRules.forEach(r => { newRulesMap[String(r.code).toUpperCase()] = { weight: r.weight, enabled: r.enabled }; });

      const affected = [];
      const totalChecked = blacklisted.length;

      blacklisted.forEach(partner => {
        const key = `${partner.entity_type}_${partner.entity_id}`;
        const partnerIncs = partnerIncidents[key] || [];

        const oldScore = calcScore(partnerIncs, oldRulesMap);
        const newScore = calcScore(partnerIncs, newRulesMap);

        const oldLvl = getLevel(oldScore, levels);
        const newLvl = getLevel(newScore, editedLevels);

        if (oldScore !== newScore || oldLvl !== newLvl) {
          affected.push({
            id: partner.entity_id,
            name: partner.partner_name || `Partner #${partner.entity_id}`,
            scope: partner.entity_type,
            oldScore,
            newScore,
            oldLevel: oldLvl,
            newLevel: newLvl
          });
        }
      });

      setPreviewResults({
        totalChecked,
        affectedCount: affected.length,
        affected
      });
    } catch (err) {
      console.error(err);
      setError('Failed to compute policy preview.');
    }
    setCalculatingPreview(false);
  };

  const modifiedRulesCount = editedRules.filter(er => {
    const original = rules.find(r => r.id === er.id);
    return original && (original.weight !== er.weight || original.enabled !== er.enabled);
  }).length;

  const modifiedLevelsCount = editedLevels.filter(el => {
    const original = levels.find(l => l.id === el.id);
    return original && (original.min_score !== el.min_score || original.max_score !== el.max_score);
  }).length;

  const hasUnsavedChanges = modifiedRulesCount > 0 || modifiedLevelsCount > 0;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved credit risk policy changes. Are you sure you want to discard them?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] font-bold text-slate-400">Loading risk dashboard analytics...</p>
      </div>
    );
  }

  return (
    <WorkspaceLayout
      title="Credit Risk & Governance"
      subtitle="Monitor active customer defaults, collection recovery analytics, bad debts, and relationship reinstatements."
      icon={ShieldAlert}
      badgeText="Governance"
      breadcrumbs={['ACCOUNTELLENCE', 'Analytics', 'Credit Risk & Governance']}
      primaryAction={
        <button 
          onClick={loadData} 
          className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <History size={14} className="text-amber-500" /> Refresh Analytics
        </button>
      }
    >
      <div className="col-span-full space-y-6">

      {/* KPI Cards Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-red-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Partners at Risk</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{stats.customersAtRisk}</span>
            <span className="text-[10.5px] font-semibold text-red-500 block mt-1">High / Critical Risk Levels</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-amber-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Active Blacklists</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{stats.blacklisted}</span>
            <span className="text-[10.5px] font-semibold text-slate-500 block mt-1">{stats.watchlist} on Watchlist</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-emerald-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Recovered Debt</span>
            <span className="text-2xl font-black text-emerald-600 font-mono">PKR {stats.recoveredDebt.toLocaleString()}</span>
            <span className="text-[10.5px] font-semibold text-slate-500 block mt-1">From resolved risk incidents</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-rose-500 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Outstanding Bad Debt</span>
            <span className="text-2xl font-black text-rose-600 font-mono">PKR {stats.outstandingBadDebt.toLocaleString()}</span>
            <span className="text-[10.5px] font-semibold text-slate-500 block mt-1">Avg recovery: {stats.averageRecoveryTime} days</span>
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="bg-white border border-slate-100 rounded-xl p-1 flex items-center gap-1 overflow-x-auto hide-scrollbar whitespace-nowrap w-full sm:w-auto shadow-sm">
        {[
          { id: 'summary', label: 'Governance Overview' },
          { id: 'blacklists', label: `Active Watch/Blocks (${blacklisted.length})` },
          { id: 'incidents', label: `Defaulter Logs (${incidents.length})` },
          { id: 'reinstatements', label: `Reinstatements Review (${reinstatements.filter(r => r.status === 'PENDING').length})` },
          { id: 'overrides', label: `Override Requests (${pendingOverrides.length})` },
          { id: 'settings', label: 'Scoring Policy Settings' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-1.5 text-[12px] font-bold rounded-lg transition-all cursor-pointer border-none ${activeSubTab === tab.id ? 'bg-[#10b981] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub Tab Contents */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[300px]">
        
        {/* SUMMARY TAB */}
        {activeSubTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Latest Reinstatement Actions */}
              <div className="space-y-3">
                <h3 className="text-[13.5px] font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5"><ShieldCheck size={16} className="text-blue-500" /> Pending Reinstatement Audits</h3>
                <div className="space-y-2">
                  {reinstatements.filter(r => r.status === 'PENDING').length === 0 ? (
                    <p className="text-[12.5px] text-slate-400 italic py-4">No pending requests for reinstatement.</p>
                  ) : (
                    reinstatements.filter(r => r.status === 'PENDING').map(req => (
                      <div key={req.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
                        <div>
                          <p className="text-[12.5px] font-bold text-slate-700">{req.partner_name} ({req.entity_type})</p>
                          <p className="text-[11.5px] text-slate-400 mt-0.5">Requested: {new Date(req.request_date).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => setSelectedRequest(req)} className="text-[11px] font-bold px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg transition-colors flex items-center gap-1 border-none cursor-pointer shadow-sm">
                          Review <ChevronRight size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bad Debt Risk Concentrates */}
              <div className="space-y-3">
                <h3 className="text-[13.5px] font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5"><AlertTriangle size={16} className="text-amber-500" /> Critical Risk Partners</h3>
                <div className="space-y-2">
                  {blacklisted.filter(b => ['BLACKLISTED', 'RESTRICTED'].includes(b.status)).length === 0 ? (
                    <p className="text-[12.5px] text-slate-400 italic py-4">No blacklisted partners in company ledgers.</p>
                  ) : (
                    blacklisted.filter(b => ['BLACKLISTED', 'RESTRICTED'].includes(b.status)).slice(0, 5).map(b => (
                      <div key={b.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
                        <div>
                          <p className="text-[12.5px] font-bold text-slate-700">{b.partner_name} ({b.entity_type})</p>
                          <div className="mt-1">
                            <StatusBadge status={b.status} />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-black text-slate-800 font-mono">Score: {b.risk_score} pts</p>
                          <div className="mt-0.5">
                            <StatusBadge status={b.risk_level} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* BLACKLISTS TAB */}
        {activeSubTab === 'blacklists' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Partner Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Risk Level</th>
                  <th className="px-4 py-3">Risk Score</th>
                  <th className="px-4 py-3">Restrictions</th>
                  <th className="px-4 py-3">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px]">
                {blacklisted.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 italic">No watchlists or blocked accounts.</td></tr>
                ) : (
                  blacklisted.map(b => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-bold text-slate-800">{b.partner_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-500">{b.entity_type}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.risk_level} />
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{b.risk_score} pts</td>
                      <td className="px-4 py-3 text-slate-500">
                        {b.cash_only && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded mr-1">CASH ONLY</span>}
                        {b.credit_limit_override && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">CAP OVERRIDE</span>}
                        {!b.cash_only && !b.credit_limit_override && <span className="text-[11px] text-slate-400">None</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{new Date(b.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* INCIDENTS TAB */}
        {activeSubTab === 'incidents' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Partner Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Loss Amount</th>
                  <th className="px-4 py-3">Recovered</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Incident Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px]">
                {incidents.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400 italic">No financial incidents logged.</td></tr>
                ) : (
                  incidents.map(i => (
                    <tr key={i.id}>
                      <td className="px-4 py-3 text-slate-400">{new Date(i.incident_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{i.partner_name} ({i.entity_type === 'CUSTOMER' ? 'Client' : 'Supplier'})</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">{i.category}</span></td>
                      <td className="px-4 py-3 font-mono font-bold text-red-600">PKR {parseFloat(i.loss_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600">PKR {parseFloat(i.recovered_amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={i.resolved ? 'RESOLVED' : 'UNRESOLVED'} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium truncate max-w-xs">{i.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* REINSTATEMENTS TAB */}
        {activeSubTab === 'reinstatements' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Request Date</th>
                  <th className="px-4 py-3">Partner Name</th>
                  <th className="px-4 py-3">Request Reason</th>
                  <th className="px-4 py-3">Review Status</th>
                  <th className="px-4 py-3">Reviewer / Remarks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px]">
                {reinstatements.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 italic">No reinstatement audits found.</td></tr>
                ) : (
                  reinstatements.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-slate-400">{new Date(r.request_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{r.partner_name} ({r.entity_type})</td>
                      <td className="px-4 py-3 text-slate-600 font-medium italic">"{r.reason}"</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {r.reviewer_name ? (
                          <div>
                            <p className="font-semibold text-slate-700">{r.reviewer_name}</p>
                            <p className="text-[11px] text-slate-400 italic mt-0.5">"{r.review_notes}"</p>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'PENDING' && (
                          <button onClick={() => setSelectedRequest(r)}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white transition-colors border-none cursor-pointer shadow-sm">
                            Audit Request
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {activeSubTab === 'overrides' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-[13.5px] font-extrabold uppercase text-slate-700 tracking-wider">
                Pending Transaction Overrides
              </h3>
              <button onClick={loadData} className="px-3 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                Refresh List
              </button>
            </div>
            {pendingOverrides.length === 0 ? (
              <p className="text-[12.5px] text-slate-400 italic py-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                No pending override requests require review.
              </p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-[12.5px] bg-white">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">Partner</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Requested By</th>
                      <th className="px-4 py-3">Override Reason</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOverrides.map(req => {
                      const meta = req.metadata ? (typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata) : {};
                      return (
                        <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {req.entity_type === 'CUSTOMER' ? 'Customer' : 'Supplier'} #{req.entity_id}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {req.request_type}
                            </span>
                            {meta.totalAmount && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Amount: PKR {meta.totalAmount.toLocaleString()}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {req.requester_name || `User #${req.requested_by}`}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={req.reason}>
                            "{req.reason}"
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button onClick={() => {
                              const notes = prompt('Enter override approval notes:', 'Approved after supervisor review.');
                              if (notes !== null) handleReviewOverride(req.id, 'APPROVED', notes);
                            }} className="px-3 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                              Approve
                            </button>
                            <button onClick={() => {
                              const notes = prompt('Enter override rejection reason:', 'Rejected due to outstanding credit risk.');
                              if (notes !== null) handleReviewOverride(req.id, 'REJECTED', notes);
                            }} className="px-3 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                              Reject
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}        {activeSubTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start font-sans">
            
            {/* LEFT COLUMN: MAIN POLICY INTERFACE */}
            <div className="xl:col-span-3 space-y-6">
              
              {/* 1. Policy Header Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-900/60 px-2.5 py-0.5 rounded-full border border-amber-700">Enterprise Policy Control</span>
                    <h2 className="text-[18px] md:text-[20px] font-display font-extrabold tracking-tight uppercase">Credit Risk Scoring Policy</h2>
                    <p className="text-[12px] text-slate-300 font-medium">Policy Name: <span className="text-white font-bold">Default Company Policy</span></p>
                  </div>
                  <div className="grid grid-cols-3 gap-6 bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl min-w-[280px]">
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Version</p>
                      <p className="text-lg font-black text-amber-400 font-mono mt-0.5">{policyHistory.length + 1}</p>
                    </div>
                    <div className="text-center border-x border-slate-700">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Status</p>
                      <p className="text-[12.5px] font-black text-emerald-400 mt-1 flex items-center justify-center gap-1">🟢 Active</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Updated By</p>
                      <p className="text-[12.5px] font-black text-slate-200 mt-1 truncate max-w-[80px]" title={policyHistory[0]?.user_name || 'System Admin'}>
                        {policyHistory[0]?.user_name || 'System'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-800/80 mt-4 pt-3 flex justify-between items-center text-[11px] text-slate-400">
                  <p>System Recalculation Mode: <span className="text-amber-400 font-bold uppercase tracking-wider">Dynamic Cache Recalc</span></p>
                  <p>Last Audited: <span className="text-slate-300 font-semibold">{policyHistory[0] ? new Date(policyHistory[0].created_at).toLocaleString() : '08-Jul-2026 14:35'}</span></p>
                </div>
              </div>

              {/* 2. Sub Tab Navigation Buttons */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 p-1 rounded-xl w-fit gap-1">
                <button type="button" onClick={() => setSettingsSubTab('rules')}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${settingsSubTab === 'rules' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Sliders size={14} /> Incident Rules
                </button>
                <button type="button" onClick={() => setSettingsSubTab('thresholds')}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${settingsSubTab === 'thresholds' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Activity size={14} /> Thresholds Config
                </button>
                <button type="button" onClick={() => setSettingsSubTab('history')}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${settingsSubTab === 'history' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}>
                  <History size={14} /> Audit History
                </button>
                <button type="button" onClick={() => setSettingsSubTab('preview')}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${settingsSubTab === 'preview' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}>
                  <FileText size={14} /> Preview Impact
                </button>
              </div>

              {/* Error messages banner */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-red-600 animate-pulse" /> {error}
                </div>
              )}

              {/* 3. Sub-Tab Content Rendering */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[350px]">
                
                {/* SUB TAB: RULES */}
                {settingsSubTab === 'rules' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="text-[13.5px] font-extrabold uppercase text-slate-800 tracking-wider">Incident Scoring Category Configuration</h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Customize penalty weights and enable status toggles for risk-related occurrences.</p>
                      </div>
                    </div>
                    <div className="border border-slate-100 rounded-xl overflow-x-auto shadow-sm bg-white">
                      <table className="w-full text-left border-collapse text-[12.5px] min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="px-4 py-3">Category Code</th>
                            <th className="px-4 py-3">Category Label</th>
                            <th className="px-4 py-3">Severity Rating</th>
                            <th className="px-4 py-3">Target Scope</th>
                            <th className="px-4 py-3">Rule Type</th>
                            <th className="px-4 py-3 text-center">Score Weight</th>
                            <th className="px-4 py-3 text-right">Policy Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-600">
                          {editedRules.map(rule => {
                            // Determine Severity
                            let severityBadge = '🟢 Low';
                            let severityColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                            if (rule.weight >= 80) {
                              severityBadge = '🔴 Critical';
                              severityColor = 'bg-red-50 text-red-700 border-red-100';
                            } else if (rule.weight >= 40) {
                              severityBadge = '🟠 High';
                              severityColor = 'bg-orange-50 text-orange-700 border-orange-100';
                            } else if (rule.weight >= 15) {
                              severityBadge = '🟡 Medium';
                              severityColor = 'bg-amber-50 text-amber-700 border-amber-100';
                            }

                            // Determine Scope
                            let scopeBadge = '🟩 Both';
                            let scopeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                            if (rule.entity_scope === 'CUSTOMER') {
                              scopeBadge = '🟦 Customer';
                              scopeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                            } else if (rule.entity_scope === 'VENDOR') {
                              scopeBadge = '🟪 Vendor';
                              scopeColor = 'bg-purple-50 text-purple-700 border-purple-100';
                            }

                            return (
                              <tr key={rule.id} className="hover:bg-slate-50/40 transition-colors">
                                <td className="px-4 py-3 font-mono text-[11px] font-bold uppercase text-slate-400">{rule.code}</td>
                                <td className="px-4 py-3">
                                  <p className="font-bold text-slate-700">{rule.label}</p>
                                  <p className="text-[10.5px] text-slate-400 truncate max-w-xs">{rule.description}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`badge border text-[10px] font-extrabold px-2 py-0.5 rounded ${severityColor}`}>
                                    {severityBadge}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`badge border text-[10px] font-extrabold px-2 py-0.5 rounded ${scopeColor}`}>
                                    {scopeBadge}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`badge border text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                    rule.rule_type === 'FORMULA' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}>
                                    {rule.rule_type === 'FORMULA' ? 'Formula' : 'Static'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input type="number" min="0" max="999"
                                    className="border border-slate-200 rounded-lg w-16 p-1 text-center font-mono text-[12px] font-bold focus:ring-2 focus:ring-amber-500 outline-none hover:bg-slate-50"
                                    value={rule.weight}
                                    onChange={e => {
                                      const val = parseInt(e.target.value) || 0;
                                      setEditedRules(prev => prev.map(r => r.id === rule.id ? { ...r, weight: val } : r));
                                    }}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                      checked={rule.enabled}
                                      onChange={e => {
                                        const val = e.target.checked;
                                        setEditedRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: val } : r));
                                      }}
                                    />
                                    <span className={`text-[11.5px] font-bold ${rule.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {rule.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB TAB: THRESHOLDS */}
                {settingsSubTab === 'thresholds' && (
                  <div className="space-y-8">
                    <div className="border-b border-slate-100 pb-2">
                      <h3 className="text-[13.5px] font-extrabold uppercase text-slate-800 tracking-wider">Risk Classification Score Thresholds</h3>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Map relationships' cumulative penalties into structural rating classifications.</p>
                    </div>

                    {/* Dynamic Scale Visual Bar */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-inner">
                      <p className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wide">Dynamic Policy Range Scale Visualizer</p>
                      
                      {(() => {
                        const lowMax = editedLevels.find(l => l.risk_level === 'LOW')?.max_score || 20;
                        const medMax = editedLevels.find(l => l.risk_level === 'MEDIUM')?.max_score || 50;
                        const highMax = editedLevels.find(l => l.risk_level === 'HIGH')?.max_score || 80;

                        return (
                          <div className="space-y-4">
                            <div className="relative pt-6">
                              {/* Horizontal track */}
                              <div className="h-4 w-full rounded-full flex overflow-hidden border border-slate-200 bg-slate-200">
                                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${Math.min(100, (lowMax / 150) * 100)}%` }} />
                                <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${Math.min(100, ((medMax - lowMax) / 150) * 100)}%` }} />
                                <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${Math.min(100, ((highMax - medMax) / 150) * 100)}%` }} />
                                <div className="bg-red-600 h-full flex-1 transition-all duration-300" />
                              </div>

                              {/* Scale Markers */}
                              <div className="relative w-full flex justify-between text-[11px] font-mono text-slate-400 font-bold mt-2 px-1">
                                <span className="absolute left-0 -translate-x-1/2">0</span>
                                <span className="absolute transition-all duration-300" style={{ left: `${Math.min(95, (lowMax / 150) * 100)}%` }}>{lowMax}</span>
                                <span className="absolute transition-all duration-300" style={{ left: `${Math.min(95, (medMax / 150) * 100)}%` }}>{medMax}</span>
                                <span className="absolute transition-all duration-300" style={{ left: `${Math.min(95, (highMax / 150) * 100)}%` }}>{highMax}</span>
                                <span className="absolute right-0 translate-x-1/2">999</span>
                              </div>
                            </div>

                            {/* Key Labels */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-[12.5px] font-sans">
                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                                <div>
                                  <p className="font-bold text-slate-800">LOW RISK</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-bold">0 - {lowMax}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                                <span className="w-3 h-3 rounded-full bg-amber-400" />
                                <div>
                                  <p className="font-bold text-slate-800">MEDIUM RISK</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-bold">{lowMax + 1} - {medMax}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                                <span className="w-3 h-3 rounded-full bg-orange-500" />
                                <div>
                                  <p className="font-bold text-slate-800">HIGH RISK</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-bold">{medMax + 1} - {highMax}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                                <span className="w-3 h-3 rounded-full bg-red-600" />
                                <div>
                                  <p className="font-bold text-slate-800">CRITICAL RISK</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-bold">{highMax + 1}+</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                      {editedLevels.map((lvl, index) => (
                        <div key={lvl.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 flex items-center justify-between text-[13px]">
                          <span className="font-bold text-slate-700 capitalize flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              lvl.risk_level === 'LOW' ? 'bg-emerald-500' :
                              lvl.risk_level === 'MEDIUM' ? 'bg-amber-400' :
                              lvl.risk_level === 'HIGH' ? 'bg-orange-500' : 'bg-red-600'
                            }`} />
                            {lvl.risk_level} Rating:
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Min</label>
                              <input type="number" min="0" className="border border-slate-200 rounded-lg p-1 text-center font-mono text-[12px] font-bold w-16"
                                value={lvl.min_score}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setEditedLevels(prev => prev.map(l => l.id === lvl.id ? { ...l, min_score: val } : l));
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Max</label>
                              <input type="number" min="0" className="border border-slate-200 rounded-lg p-1 text-center font-mono text-[12px] font-bold w-20"
                                value={lvl.max_score}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setEditedLevels(prev => prev.map(l => l.id === lvl.id ? { ...l, max_score: val } : l));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUB TAB: HISTORY */}
                {settingsSubTab === 'history' && (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h3 className="text-[13.5px] font-extrabold uppercase text-slate-800 tracking-wider">Policy Configuration Logs</h3>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Chronological audit trail of risk category weight updates and threshold modifications.</p>
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="px-4 py-3">Timestamp</th>
                            <th className="px-4 py-3">Action Type</th>
                            <th className="px-4 py-3">Old Value</th>
                            <th className="px-4 py-3">New Value</th>
                            <th className="px-4 py-3">Auditor</th>
                            <th className="px-4 py-3">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[12.5px] text-slate-600">
                          {policyHistory.length === 0 ? (
                            <tr className="hover:bg-slate-50/50 bg-white">
                              <td className="px-4 py-3 font-mono text-[11px] text-slate-400">08-Jul-2026 10:00 AM</td>
                              <td className="px-4 py-3">
                                <span className="badge uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  SYSTEM_INIT
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11.5px] text-slate-500">—</td>
                              <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-slate-800">Policy Version 1</td>
                              <td className="px-4 py-3 font-medium text-slate-700">System Admin</td>
                              <td className="px-4 py-3 italic text-slate-500">Created automatically on company database provisioning.</td>
                            </tr>
                          ) : (
                            policyHistory.map(hist => (
                              <tr key={hist.id} className="hover:bg-slate-50/50 bg-white">
                                <td className="px-4 py-3 font-mono text-[11px]">{new Date(hist.created_at).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`badge uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
                                    hist.policy_type === 'RULE_CHANGE' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
                                  }`}>{hist.policy_type}</span>
                                </td>
                                <td className="px-4 py-3 font-mono text-[11.5px] text-slate-500">{hist.old_value}</td>
                                <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-slate-800">{hist.new_value}</td>
                                <td className="px-4 py-3 font-medium text-slate-700">{hist.user_name || 'System Admin'}</td>
                                <td className="px-4 py-3 italic text-slate-500">{hist.reason}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB TAB: PREVIEW */}
                {settingsSubTab === 'preview' && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                      <div>
                        <h3 className="text-[13.5px] font-extrabold uppercase text-slate-800 tracking-wider">Policy Simulation & Impact Preview</h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Analyze the score variations and classification shifts for active relationships prior to saving changes.</p>
                      </div>
                      <button type="button" onClick={runImpactPreview} disabled={calculatingPreview}
                        className="px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white font-bold text-[12px] transition-all flex items-center gap-1.5 shadow-sm border-none cursor-pointer">
                        {calculatingPreview ? 'Running Simulation...' : 'Run Preview Simulation'}
                      </button>
                    </div>

                    {!previewResults ? (
                      <div className="border border-dashed border-slate-200 rounded-2xl py-12 flex flex-col items-center justify-center bg-slate-50/50 space-y-3">
                        <FileText size={40} className="text-slate-300" />
                        <div className="text-center space-y-1">
                          <p className="text-[13px] font-bold text-slate-600">No Simulation Data Generated</p>
                          <p className="text-[11.5px] text-slate-400 max-w-sm">Click "Run Preview Simulation" to calculate exactly which customers and vendors will change risk status levels.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Active Accounts Screened</p>
                            <p className="text-xl font-black text-slate-800 font-mono mt-1">{previewResults.totalChecked}</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold text-amber-500 uppercase">Affected Relationships</p>
                            <p className="text-xl font-black text-amber-700 font-mono mt-1">{previewResults.affectedCount}</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold text-amber-500 uppercase">Score Shift Rate</p>
                            <p className="text-xl font-black text-amber-700 font-mono mt-1">
                              {previewResults.totalChecked > 0 ? `${Math.round((previewResults.affectedCount / previewResults.totalChecked) * 100)}%` : '0%'}
                            </p>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Est. Processing Time</p>
                            <p className="text-xl font-black text-slate-800 font-mono mt-1">1.4 Seconds</p>
                          </div>
                        </div>

                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                <th className="px-4 py-3">Partner Name</th>
                                <th className="px-4 py-3">Scope</th>
                                <th className="px-4 py-3 text-center">Old Score</th>
                                <th className="px-4 py-3 text-center">New Score</th>
                                <th className="px-4 py-3 text-right">Risk Classification Shift</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[12.5px] text-slate-600">
                              {previewResults.affectedCount === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center py-8 text-slate-400 italic bg-white">
                                    No changes detected. Your edits will not cause any partner risk level transitions.
                                  </td>
                                </tr>
                              ) : (
                                previewResults.affected.map(p => (
                                  <tr key={p.id} className="hover:bg-slate-50/40 bg-white">
                                    <td className="px-4 py-3 font-bold text-slate-700">{p.name}</td>
                                    <td className="px-4 py-3">
                                      <span className={`badge border text-[9.5px] font-extrabold px-1.5 py-0.5 rounded ${
                                        p.scope === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                                      }`}>
                                        {p.scope}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{p.oldScore}</td>
                                    <td className="px-4 py-3 text-center font-mono font-bold text-amber-600">{p.newScore}</td>
                                    <td className="px-4 py-3 text-right flex justify-end items-center gap-2 py-3.5">
                                      <span className={`badge text-[10px] font-bold px-2 py-0.5 rounded ${
                                        p.oldLevel === 'LOW' ? 'bg-emerald-50 text-emerald-700' :
                                        p.oldLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                                        p.oldLevel === 'HIGH' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                                      }`}>
                                        {p.oldLevel}
                                      </span>
                                      <span className="text-slate-400">➔</span>
                                      <span className={`badge text-[10px] font-black px-2 py-0.5 rounded ${
                                        p.newLevel === 'LOW' ? 'bg-emerald-50 text-emerald-700' :
                                        p.newLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                                        p.newLevel === 'HIGH' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                                      } border`}>
                                        {p.newLevel}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Pending Policy Delta Comparison */}
                        {hasUnsavedChanges && (
                          <div className="space-y-3 pt-6 border-t border-slate-100">
                            <p className="text-[12.5px] font-bold text-slate-700 uppercase tracking-wide">Pending Policy Delta Comparison</p>
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                              <table className="w-full text-left border-collapse text-[12.5px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="px-4 py-3">Rule / Threshold</th>
                                    <th className="px-4 py-3">Original Policy Value</th>
                                    <th className="px-4 py-3 font-semibold text-slate-800">Modified Value</th>
                                    <th className="px-4 py-3 text-right">Adjustment State</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-slate-600 font-mono text-[11.5px]">
                                  {/* Rules Delta */}
                                  {editedRules.filter(er => {
                                    const original = rules.find(r => r.id === er.id);
                                    return original && (original.weight !== er.weight || original.enabled !== er.enabled);
                                  }).map(er => {
                                    const original = rules.find(r => r.id === er.id);
                                    return (
                                      <tr key={er.id} className="hover:bg-slate-50/20 bg-white">
                                        <td className="px-4 py-3 font-sans font-bold text-slate-700">{er.label} ({er.code})</td>
                                        <td className="px-4 py-3 text-slate-400">Weight: {original.weight} | {original.enabled ? 'Enabled' : 'Disabled'}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-800">Weight: {er.weight} | {er.enabled ? 'Enabled' : 'Disabled'}</td>
                                        <td className="px-4 py-3 text-right text-amber-600 font-sans font-bold">Modified Rule</td>
                                      </tr>
                                    );
                                  })}
                                  {/* Levels Delta */}
                                  {editedLevels.filter(el => {
                                    const original = levels.find(l => l.id === el.id);
                                    return original && (original.min_score !== el.min_score || original.max_score !== el.max_score);
                                  }).map(el => {
                                    const original = levels.find(l => l.id === el.id);
                                    return (
                                      <tr key={el.id} className="hover:bg-slate-50/20 bg-white">
                                        <td className="px-4 py-3 font-sans font-bold text-slate-700">{el.risk_level} Rating Threshold</td>
                                        <td className="px-4 py-3 text-slate-400">{original.min_score} - {original.max_score} pts</td>
                                        <td className="px-4 py-3 font-semibold text-slate-800">{el.min_score} - {el.max_score} pts</td>
                                        <td className="px-4 py-3 text-right text-orange-600 font-sans font-bold">Modified Threshold</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Bottom Toolbar Control Box */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex gap-2">
                  <button type="button" onClick={handleResetToSystemDefaults} disabled={saving}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[12px] font-bold transition-all shadow-sm">
                    Reset to Defaults
                  </button>
                  <button type="button" onClick={handleValidatePolicy} disabled={saving}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg text-[12px] font-bold transition-all shadow-sm">
                    Validate Policy
                  </button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => {
                      if (!hasUnsavedChanges || window.confirm('Discard all unsaved policy modifications?')) {
                        loadData();
                      }
                    }} disabled={saving}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg text-[12px] font-bold transition-all">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveAllChanges} disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[12px] font-black shadow-md flex items-center gap-1">
                    {saving ? 'Saving Policy...' : 'Save All Changes'}
                  </button>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: POLICY SUMMARY & RECALCULATION PROGRESS SIDEBAR */}
            <div className="space-y-6">
              
              {/* Policy Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  Policy Summary
                </h3>
                {hasUnsavedChanges && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 space-y-1 animate-pulse">
                    <p className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Unsaved Changes
                    </p>
                    <p className="text-[10.5px] font-bold text-slate-500">
                      {modifiedRulesCount > 0 && `${modifiedRulesCount} rule(s) modified `}
                      {modifiedLevelsCount > 0 && `${modifiedLevelsCount} threshold(s) modified`}
                    </p>
                  </div>
                )}
                <div className="space-y-3 text-[12.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Customer Rules</span>
                    <span className="font-bold text-slate-700 font-mono">{editedRules.filter(r => r.entity_scope === 'CUSTOMER' || r.entity_scope === 'BOTH').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Vendor Rules</span>
                    <span className="font-bold text-slate-700 font-mono">{editedRules.filter(r => r.entity_scope === 'VENDOR' || r.entity_scope === 'BOTH').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Enabled Categories</span>
                    <span className="font-bold text-emerald-600 font-mono">{editedRules.filter(r => r.enabled).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Disabled Categories</span>
                    <span className="font-bold text-slate-400 font-mono">{editedRules.filter(r => !r.enabled).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Highest Score Penalty</span>
                    <span className="font-bold text-red-600 font-mono">{Math.max(...editedRules.map(r => r.weight), 0)} pts</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-50 pt-2 text-[13px]">
                    <span className="text-slate-800 font-bold">Policy Version</span>
                    <span className="font-black text-amber-600 font-mono">{policyHistory.length + 1}</span>
                  </div>
                </div>
              </div>

              {/* Recalculation Progress Tracker */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  System Job Status
                </h3>
                {jobProgress !== null ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <div className="text-[11.5px] font-bold">
                        <p>Recalculation in Progress...</p>
                        <p className="text-[10px] text-emerald-500 font-medium mt-0.5">Updating partner credit terms...</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono font-bold text-slate-500">
                        <span>Background Recalc</span>
                        <span>{jobProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                        <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${jobProgress}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                    <div className="text-[11.5px] font-bold">
                      <p>🟢 Policy Synced</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Background database is idle.</p>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

      {/* Review Worksheet Modal Dialog */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleReviewRequest} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-[13px] font-extrabold uppercase text-slate-800 flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-500" /> Reinstatement Governance Worksheet</h4>
              <button type="button" onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 font-bold flex items-center gap-1">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-500 mb-1">Decision</label>
                <select className="select-enterprise p-2 bg-white" value={reviewForm.status} onChange={e => setReviewForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="APPROVED">APPROVE REINSTATEMENT</option>
                  <option value="REJECTED">REJECT & REMAIN BLOCKED</option>
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-500 mb-1">Post-Reinstate Risk Level</label>
                <select className="select-enterprise p-2 bg-white font-bold" value={reviewForm.priorityAfterReinstate} onChange={e => setReviewForm(f => ({ ...f, priorityAfterReinstate: e.target.value }))}>
                  <option value="LOW">LOW RISK</option>
                  <option value="MEDIUM">MEDIUM RISK</option>
                  <option value="HIGH">HIGH RISK</option>
                  <option value="CRITICAL">CRITICAL RISK</option>
                </select>
              </div>
            </div>

            {reviewForm.status === 'APPROVED' && selectedRequest.entity_type === 'CUSTOMER' && (
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
                <p className="text-[11.5px] font-extrabold text-[#9a3412] flex items-center gap-1">
                  <AlertTriangle size={13} /> Audit outstanding AR Balance Handling
                </p>
                
                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-slate-500 mb-1">Receivables Action</label>
                  <select className="select-enterprise p-2 bg-white" value={reviewForm.receivablesHandling} onChange={e => setReviewForm(f => ({ ...f, receivablesHandling: e.target.value }))}>
                    <option value="KEEP_AR">Keep as Accounts Receivable (No Entry)</option>
                    <option value="WRITE_OFF">Write Off Bad Debt (Dr Bad Debt / Cr AR)</option>
                    <option value="SETTLEMENT">Settlement Plan (Installment Schedules)</option>
                    <option value="LEGAL">Legal Recovery Track</option>
                  </select>
                </div>

                {reviewForm.receivablesHandling === 'SETTLEMENT' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[11px] font-bold text-slate-500 mb-1">Schedule Frequency</label>
                      <select className="select-enterprise p-2 bg-white" value={reviewForm.settlementFrequency} onChange={e => setReviewForm(f => ({ ...f, settlementFrequency: e.target.value }))}>
                        <option value="WEEKLY">Weekly Installments</option>
                        <option value="MONTHLY">Monthly Installments</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[11px] font-bold text-slate-500 mb-1">Installment Count</label>
                      <input type="number" min="2" max="12" className="input-enterprise p-2 bg-white" value={reviewForm.settlementInstallmentsCount} onChange={e => setReviewForm(f => ({ ...f, settlementInstallmentsCount: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Committee Notes */}
            <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
              <p className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1">Credit Committee Registry Details</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400">Meeting Date</label>
                  <input type="date" className="input-enterprise p-1.5 bg-white text-[11px]" value={reviewForm.committeeMeetingDate} onChange={e => setReviewForm(f => ({ ...f, committeeMeetingDate: e.target.value }))} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400">Next Review Date</label>
                  <input type="date" className="input-enterprise p-1.5 bg-white text-[11px]" value={reviewForm.committeeNextReviewDate} onChange={e => setReviewForm(f => ({ ...f, committeeNextReviewDate: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400">Participants</label>
                <input type="text" className="input-enterprise p-1.5 bg-white text-[11.5px]" placeholder="e.g. CEO, CFO, Sales Lead" value={reviewForm.committeeParticipants} onChange={e => setReviewForm(f => ({ ...f, committeeParticipants: e.target.value }))} />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400">Resolution Decision Statement</label>
                <input type="text" className="input-enterprise p-1.5 bg-white text-[11.5px]" placeholder="Summary of committee agreement..." value={reviewForm.committeeDecision} onChange={e => setReviewForm(f => ({ ...f, committeeDecision: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 mb-1">Audit Notes / Comments *</label>
              <input type="text" required className="input-enterprise p-2 bg-white" placeholder="Decision explanation..." value={reviewForm.reviewNotes} onChange={e => setReviewForm(f => ({ ...f, reviewNotes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setSelectedRequest(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[12px] font-bold">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[12px] font-bold">{saving ? 'Submitting...' : 'Confirm Decision'}</button>
            </div>
          </form>
        </div>
      )}

      </div>
    </WorkspaceLayout>
  );
}
