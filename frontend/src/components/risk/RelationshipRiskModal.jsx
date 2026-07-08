import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, AlertTriangle, AlertCircle, CheckCircle, Clock, ShieldAlert, ShieldCheck, 
  Trash2, DollarSign, Calendar, FileText, ArrowRight, UserPlus, ListTodo
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const CATEGORIES = {
  CUSTOMER: [
    { id: 'LATE_PAYMENT', label: 'Late Payment' },
    { id: 'BOUNCED_CHEQUE', label: 'Bounced Cheque' },
    { id: 'OVERDUE_INVOICE', label: 'Overdue Invoice' },
    { id: 'BAD_DEBT', label: 'Bad Debt / Default' },
    { id: 'LEGAL_CASE', label: 'Legal Case' },
    { id: 'OTHER', label: 'Other Issue' }
  ],
  VENDOR: [
    { id: 'POOR_QUALITY', label: 'Poor Quality' },
    { id: 'LATE_DELIVERY', label: 'Late Delivery' },
    { id: 'PRICE_MANIPULATION', label: 'Price Manipulation' },
    { id: 'FRAUD', label: 'Fraud / Duplicate Billing' },
    { id: 'CONTRACT_VIOLATION', label: 'Contract Violation' },
    { id: 'OTHER', label: 'Other Issue' }
  ]
};

const RISK_LEVEL_COLORS = {
  LOW: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  MEDIUM: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  HIGH: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  CRITICAL: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' }
};

const STATUS_BADGES = {
  ACTIVE: { text: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle },
  WATCHLIST: { text: 'text-amber-700', bg: 'bg-amber-50', icon: AlertTriangle },
  RESTRICTED: { text: 'text-orange-700', bg: 'bg-orange-50', icon: AlertCircle },
  BLACKLISTED: { text: 'text-red-700', bg: 'bg-red-50', icon: ShieldAlert },
  REINSTATED: { text: 'text-blue-700', bg: 'bg-blue-50', icon: ShieldCheck }
};

export default function RelationshipRiskModal({ isOpen, onClose, entityType, entityId, entityName, outstandingBalance = 0 }) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview'); // overview | incidents | payment-plans | history
  const [status, setStatus] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [plans, setPlans] = useState([]);
  const [reinstatementRequests, setReinstatementRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    category: '', reason: '', lossAmount: '', recoveredAmount: '', daysLate: '', notes: '', resolved: false
  });
  
  const [showBlacklistForm, setShowBlacklistForm] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({ untilDate: '', reason: '', notes: '' });

  const [showReinstateRequestForm, setShowReinstateRequestForm] = useState(false);
  const [reinstateRequestForm, setReinstateRequestForm] = useState({ reason: '' });

  const [showReviewForm, setShowReviewForm] = useState(null); // request object if open
  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED', reviewNotes: '', priorityAfterReinstate: 'MEDIUM', receivablesHandling: 'KEEP_AR',
    settlementFrequency: 'MONTHLY', settlementInstallmentsCount: '3',
    committeeMeetingDate: '', committeeParticipants: '', committeeDecision: '', committeeNextReviewDate: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load Status and Incidents
  const loadData = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const [statusRes, incRes, histRes, planRes, reinstatementRes] = await Promise.all([
        api.get(`/risk/status/${entityType}/${entityId}`),
        api.get(`/risk/incidents/${entityType}/${entityId}`),
        api.get(`/risk/history/${entityType}/${entityId}`),
        api.get(`/risk/payment-plans/${entityType}/${entityId}`),
        api.get(`/risk/reinstatement/requests/${entityType}/${entityId}`).catch(() => ({ data: [] }))
      ]);
      setStatus(statusRes.data);
      setIncidents(incRes.data);
      setHistory(histRes.data);
      setPlans(planRes.data);
      setReinstatementRequests(reinstatementRes.data);
    } catch (err) {
      console.error('Failed to load risk profile data:', err);
    }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setActiveTab('overview');
      setShowIncidentForm(false);
      setShowBlacklistForm(false);
      setShowReinstateRequestForm(false);
      setShowReviewForm(null);
      setError('');
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleLogIncident = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/risk/incidents', {
        entityType,
        entityId,
        ...incidentForm
      });
      setShowIncidentForm(false);
      setIncidentForm({ category: '', reason: '', lossAmount: '', recoveredAmount: '', daysLate: '', notes: '', resolved: false });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log incident.');
    }
    setSaving(false);
  };

  const handleResolveIncident = async (id, loss) => {
    if (!window.confirm('Resolve this incident?')) return;
    try {
      const rec = window.prompt('Enter recovered amount:', loss);
      if (rec === null) return;
      await api.post(`/risk/incidents/${id}/resolve`, {
        recoveredAmount: parseFloat(rec) || 0,
        notes: 'Resolved via Credit Risk module.'
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve incident.');
    }
  };

  const handleBlacklist = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/risk/blacklist', {
        entityType,
        entityId,
        ...blacklistForm
      });
      setShowBlacklistForm(false);
      setBlacklistForm({ untilDate: '', reason: '', notes: '' });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to blacklist partner.');
    }
    setSaving(false);
  };

  const handleWarn = async () => {
    const reason = window.prompt('Enter reason for Warning / Watchlist status:');
    if (!reason) return;
    try {
      await api.post('/risk/warn', {
        entityType,
        entityId,
        reason
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to flag watchlist.');
    }
  };

  const handleRequestReinstate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/risk/reinstatement/request', {
        entityType,
        entityId,
        reason: reinstateRequestForm.reason
      });
      setShowReinstateRequestForm(false);
      setReinstateRequestForm({ reason: '' });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request reinstatement.');
    }
    setSaving(false);
  };

  const handleReviewRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`/risk/reinstatement/review/${showReviewForm.id}`, reviewForm);
      setShowReviewForm(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit review.');
    }
    setSaving(false);
  };

  const handlePayInstallment = async (instId, amount) => {
    if (!window.confirm(`Record payment of PKR ${amount.toLocaleString()} for this installment?`)) return;
    try {
      await api.post(`/risk/payment-plans/installment/${instId}/pay`, { amount });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Payment failed.');
    }
  };

  const currentStatusConfig = status ? STATUS_BADGES[status.status] : STATUS_BADGES.ACTIVE;
  const currentRiskConfig = status ? RISK_LEVEL_COLORS[status.risk_level] : RISK_LEVEL_COLORS.LOW;
  const StatusIcon = currentStatusConfig.icon;

  const totalLoss = incidents.reduce((s, i) => s + parseFloat(i.loss_amount || 0), 0);
  const totalRecovered = incidents.reduce((s, i) => s + parseFloat(i.recovered_amount || 0), 0);
  const recoveryPct = totalLoss > 0 ? Math.round((totalRecovered / totalLoss) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-black text-slate-800 tracking-tight uppercase">Relationship Risk Profile</h2>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-500/20">Governance</span>
            </div>
            <p className="text-[12px] font-bold text-slate-500 mt-1">{entityName} ({entityType === 'CUSTOMER' ? 'Client' : 'Supplier'})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-[13px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-3" />
            Loading credit risk profile...
          </div>
        ) : (
          <>
            {/* Top Ribbon Summary */}
            <div className="bg-white border-b border-slate-100 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Status</span>
                <div className="flex items-center gap-1.5 mt-2">
                  <StatusIcon size={16} className={currentStatusConfig.text} />
                  <span className={`text-[13px] font-black uppercase ${currentStatusConfig.text}`}>{status.status}</span>
                </div>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk Matrix</span>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`text-[12px] font-black px-2.5 py-0.5 rounded border uppercase ${currentRiskConfig.text} ${currentRiskConfig.bg} ${currentRiskConfig.border}`}>
                    {status.risk_level} ({status.risk_score} pts)
                  </span>
                </div>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Recovery</span>
                <span className="text-[14px] font-extrabold text-slate-800 mt-2 font-mono">
                  PKR {totalRecovered.toLocaleString()} <span className="text-[11px] text-slate-500 font-bold">({recoveryPct}%)</span>
                </span>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding Bal</span>
                <span className="text-[14px] font-extrabold text-red-600 mt-2 font-mono">
                  PKR {outstandingBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-50 px-5 border-b border-slate-200 flex gap-2">
              {[
                { id: 'overview', label: 'Governance Overview' },
                { id: 'incidents', label: `Incident Log (${incidents.length})` },
                { id: 'payment-plans', label: `Installments (${plans.length})` },
                { id: 'history', label: 'Audit Trail' }
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`py-2 px-3 text-[12px] font-bold border-b-2 transition-all ${activeTab === t.id ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[12.5px] text-red-700 font-semibold flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Active Credit Restrictions */}
                    <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50">
                      <p className="text-[12px] font-bold text-slate-700 border-b border-slate-100 pb-1">Automated Policies & Restrictions</p>
                      
                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="text-slate-500 font-semibold">Payment Condition:</span>
                        <span className="font-extrabold text-slate-800">{status.cash_only ? '❌ Cash Only (Credit Blocked)' : '✔️ Terms Approved'}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="text-slate-500 font-semibold">Credit Limit Override:</span>
                        <span className="font-mono font-extrabold text-slate-800">
                          {status.credit_limit_override ? `PKR ${parseFloat(status.credit_limit_override).toLocaleString()}` : 'None (Use COA defaults)'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="text-slate-500 font-semibold">Overdue Limit:</span>
                        <span className="font-extrabold text-slate-800">{status.max_credit_days ? `${status.max_credit_days} Days` : 'Standard'}</span>
                      </div>

                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="text-slate-500 font-semibold">Manager Override:</span>
                        <span className="font-extrabold text-slate-800">{status.manager_approval_required ? 'Required for credit' : 'Not required'}</span>
                      </div>

                      {status.blacklist_expires_at && (
                        <div className="flex justify-between items-center text-[12.5px] text-red-600 font-bold bg-red-50 p-2 rounded">
                          <span>Blacklist Expiry:</span>
                          <span>{new Date(status.blacklist_expires_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Toolbar Actions */}
                    <div className="border border-slate-100 rounded-xl p-4 space-y-2 bg-slate-50/50 flex flex-col justify-center">
                      <p className="text-[12px] font-bold text-slate-700 border-b border-slate-100 pb-1">Governance Commands</p>
                      
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button onClick={() => { setShowIncidentForm(true); setShowBlacklistForm(false); setShowReinstateRequestForm(false); }}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[12px] font-bold transition-all shadow-sm">
                          Log Risk Incident
                        </button>
                        
                        {status.status !== 'BLACKLISTED' ? (
                          <button onClick={() => { setShowBlacklistForm(true); setShowIncidentForm(false); setShowReinstateRequestForm(false); }}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[12px] font-bold transition-all shadow-sm">
                            Blacklist Account
                          </button>
                        ) : (
                          <button onClick={() => { setShowReinstateRequestForm(true); setShowIncidentForm(false); setShowBlacklistForm(false); }}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold transition-all shadow-sm">
                            Request Reinstate
                          </button>
                        )}
                        
                        {status.status !== 'WATCHLIST' && status.status !== 'BLACKLISTED' && (
                          <button onClick={handleWarn}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[12px] font-bold transition-all">
                            Manual Watchlist
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Forms overlay */}
                  {showIncidentForm && (
                    <form onSubmit={handleLogIncident} className="border border-amber-200 rounded-xl p-4 bg-amber-50/30 space-y-3">
                      <h4 className="text-[12.5px] font-bold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={14} /> Log Customer Incident</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Incident Category</label>
                          <select required className="select-enterprise text-[12.5px] p-2 bg-white" value={incidentForm.category} onChange={e => setIncidentForm(f => ({ ...f, category: e.target.value }))}>
                            <option value="">Select Category</option>
                            {CATEGORIES[entityType].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Incident Date</label>
                          <input type="date" required className="input-enterprise text-[12.5px] p-2 bg-white" value={incidentForm.incidentDate} onChange={e => setIncidentForm(f => ({ ...f, incidentDate: e.target.value }))} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Estimated Financial Loss (PKR)</label>
                          <input type="number" className="input-enterprise text-[12.5px] p-2 bg-white font-mono" placeholder="0.00" value={incidentForm.lossAmount} onChange={e => setIncidentForm(f => ({ ...f, lossAmount: e.target.value }))} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Days Overdue (If Overdue Invoice)</label>
                          <input type="number" className="input-enterprise text-[12.5px] p-2 bg-white font-mono" placeholder="0" value={incidentForm.daysLate} onChange={e => setIncidentForm(f => ({ ...f, daysLate: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-bold text-slate-500 mb-1">Short Description</label>
                        <input type="text" required className="input-enterprise text-[12.5px] p-2 bg-white" placeholder="Reason for the late check / bouncing..." value={incidentForm.reason} onChange={e => setIncidentForm(f => ({ ...f, reason: e.target.value }))} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setShowIncidentForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[12px] font-bold">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-[12px] font-bold">{saving ? 'Logging...' : 'Log Incident'}</button>
                      </div>
                    </form>
                  )}

                  {showBlacklistForm && (
                    <form onSubmit={handleBlacklist} className="border border-red-200 rounded-xl p-4 bg-red-50/20 space-y-3">
                      <h4 className="text-[12.5px] font-bold text-red-800 flex items-center gap-1.5"><ShieldAlert size={14} /> Blacklist Customer Account</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Blacklist Until (Optional)</label>
                          <input type="date" className="input-enterprise text-[12.5px] p-2 bg-white" value={blacklistForm.untilDate} onChange={e => setBlacklistForm(f => ({ ...f, untilDate: e.target.value }))} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Primary Reason</label>
                          <input type="text" required className="input-enterprise text-[12.5px] p-2 bg-white" placeholder="e.g. Bad debts, non-responsiveness" value={blacklistForm.reason} onChange={e => setBlacklistForm(f => ({ ...f, reason: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-bold text-slate-500 mb-1">Detail Resolution Notes</label>
                        <textarea className="input-enterprise text-[12.5px] p-2 bg-white" rows="2" placeholder="Detail condition of blacklist..." value={blacklistForm.notes} onChange={e => setBlacklistForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setShowBlacklistForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[12px] font-bold">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-[12px] font-bold">{saving ? 'Blacklisting...' : 'Enforce Blacklist'}</button>
                      </div>
                    </form>
                  )}

                  {showReinstateRequestForm && (
                    <form onSubmit={handleRequestReinstate} className="border border-blue-200 rounded-xl p-4 bg-blue-50/20 space-y-3">
                      <h4 className="text-[12.5px] font-bold text-blue-800 flex items-center gap-1.5"><ShieldCheck size={14} /> Submit Reinstatement Request</h4>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-bold text-slate-500 mb-1">Reason / Supporting Documents / settlement Details</label>
                        <textarea required className="input-enterprise text-[12.5px] p-2 bg-white" rows="3" placeholder="State reason for reinstatement review..." value={reinstateRequestForm.reason} onChange={e => setReinstateRequestForm(f => ({ ...f, reason: e.target.value }))} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setShowReinstateRequestForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[12px] font-bold">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-[12px] font-bold">{saving ? 'Submitting...' : 'Request Reinstatement'}</button>
                      </div>
                    </form>
                  )}

                  {/* Reinstatement requests review workflow */}
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <p className="text-[12.5px] font-bold text-slate-800 flex items-center gap-1"><ShieldCheck size={14} className="text-blue-500" /> Pending Reinstatements Review</p>
                    {reinstatementRequests.filter(r => r.status === 'PENDING').length === 0 ? (
                      <p className="text-[12px] text-slate-400 italic">No pending requests for reinstatement review.</p>
                    ) : (
                      reinstatementRequests.filter(r => r.status === 'PENDING').map((req) => (
                        <div key={req.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between md:flex-row md:items-center">
                          <div className="space-y-1">
                            <p className="text-[12.5px] font-bold text-slate-700">Requested on {new Date(req.created_at || req.request_date).toLocaleDateString()}</p>
                            <p className="text-[12px] text-slate-500 font-medium italic">"{req.reason}"</p>
                          </div>
                          
                          <button onClick={() => { setShowReviewForm(req); setReviewForm(f => ({ ...f, status: 'APPROVED' })); }}
                            className="mt-3 md:mt-0 text-[12px] px-3.5 py-1.5 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1">
                            Review Request <ArrowRight size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reinstatement Review Worksheet Modal overlay */}
                  {showReviewForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                      <form onSubmit={handleReviewRequest} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <h4 className="text-[13px] font-extrabold uppercase text-slate-800 flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-500" /> Reinstatement Worksheet Review</h4>
                          <button type="button" onClick={() => setShowReviewForm(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                        </div>

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

                        {reviewForm.status === 'APPROVED' && entityType === 'CUSTOMER' && outstandingBalance > 0 && (
                          <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
                            <p className="text-[11.5px] font-extrabold text-[#9a3412] flex items-center gap-1">
                              <AlertTriangle size={13} /> Outstanding Balance Exists (PKR {outstandingBalance.toLocaleString()})
                            </p>
                            
                            <div className="flex flex-col">
                              <label className="text-[11px] font-bold text-slate-500 mb-1">How should the balance be handled?</label>
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

                        {/* Credit Committee Notes */}
                        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
                          <p className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1"><ListTodo size={13} /> Credit Committee Notes (Management-only)</p>
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
                            <input type="text" className="input-enterprise p-1.5 bg-white text-[11.5px]" placeholder="e.g. Finance Director, GM Sales" value={reviewForm.committeeParticipants} onChange={e => setReviewForm(f => ({ ...f, committeeParticipants: e.target.value }))} />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400">Committee Resolution Summary</label>
                            <input type="text" className="input-enterprise p-1.5 bg-white text-[11.5px]" placeholder="e.g. Agreed to reinstate on probationary credit limit" value={reviewForm.committeeDecision} onChange={e => setReviewForm(f => ({ ...f, committeeDecision: e.target.value }))} />
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[11px] font-bold text-slate-500 mb-1">Review Remarks / Notes</label>
                          <input type="text" required className="input-enterprise p-2 bg-white" placeholder="Decision reasoning remarks..." value={reviewForm.reviewNotes} onChange={e => setReviewForm(f => ({ ...f, reviewNotes: e.target.value }))} />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button type="button" onClick={() => setShowReviewForm(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[12px] font-bold">Cancel</button>
                          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[12px] font-bold">{saving ? 'Saving...' : 'Confirm Decision'}</button>
                        </div>
                      </form>
                    </div>
                  )}

                </div>
              )}

              {/* INCIDENTS TAB */}
              {activeTab === 'incidents' && (
                <div className="space-y-4">
                  {incidents.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 text-[12.5px] italic">No incidents recorded for this partner.</p>
                  ) : (
                    incidents.map((inc) => (
                      <div key={inc.id} className="border border-slate-100 rounded-xl p-4 bg-white flex flex-col justify-between md:flex-row md:items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">{inc.category}</span>
                            <span className="text-[11px] font-bold text-slate-400">{new Date(inc.incident_date).toLocaleDateString()}</span>
                            {inc.resolved ? (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 border border-emerald-100 rounded">RESOLVED</span>
                            ) : (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-100 rounded">ACTIVE RISK</span>
                            )}
                          </div>
                          <p className="text-[13.5px] font-semibold text-slate-800 mt-1">{inc.reason}</p>
                          <p className="text-[12px] font-bold text-red-500 font-mono">
                            Loss Amount: PKR {parseFloat(inc.loss_amount).toLocaleString()}
                            {inc.resolved && (
                              <span className="text-emerald-600 ml-3">Recovered: PKR {parseFloat(inc.recovered_amount).toLocaleString()}</span>
                            )}
                          </p>
                          {inc.notes && <p className="text-[11px] text-slate-400 italic">Notes: {inc.notes}</p>}
                        </div>

                        {!inc.resolved && (
                          <button onClick={() => handleResolveIncident(inc.id, inc.loss_amount)}
                            className="mt-3 md:mt-0 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-colors">
                            Resolve Incident
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PAYMENT PLANS TAB */}
              {activeTab === 'payment-plans' && (
                <div className="space-y-5">
                  {plans.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 text-[12.5px] italic">No active settlement schedules.</p>
                  ) : (
                    plans.map((plan) => (
                      <div key={plan.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div>
                            <p className="text-[12.5px] font-bold text-slate-800">Settlement Plan (Frequency: {plan.frequency})</p>
                            <p className="text-[11px] text-slate-500 font-semibold font-mono">Total Settlement Amount: PKR {parseFloat(plan.total_amount).toLocaleString()}</p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 border rounded uppercase ${plan.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {plan.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {plan.installments.map((inst, index) => (
                            <div key={inst.id} className="border border-slate-100 rounded-lg p-3 bg-white space-y-2">
                              <div className="flex justify-between items-center text-[11.5px] font-bold text-slate-700">
                                <span>Installment #{index + 1}</span>
                                <span className={`text-[9px] font-bold border rounded px-1.5 py-0.5 uppercase ${inst.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {inst.status}
                                </span>
                              </div>
                              
                              <p className="text-[12px] font-extrabold text-slate-900 font-mono">PKR {parseFloat(inst.amount).toLocaleString()}</p>
                              
                              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-bold">
                                <Calendar size={12} /> Due: {new Date(inst.due_date).toLocaleDateString()}
                              </div>

                              {inst.status !== 'PAID' && plan.status === 'ACTIVE' && (
                                <button onClick={() => handlePayInstallment(inst.id, inst.amount)}
                                  className="w-full mt-2 text-[10px] font-bold text-center py-1 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors">
                                  Mark as Paid
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* AUDIT TRAIL TAB */}
              {activeTab === 'history' && (
                <div className="relative pl-6 border-l border-slate-100 space-y-4">
                  {history.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 text-[12.5px] italic">No audit records.</p>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="relative space-y-1">
                        <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white" />
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">{h.action}</span>
                          <span className="text-[11px] font-bold text-slate-400">{new Date(h.created_at).toLocaleString()}</span>
                          {h.performer_name && <span className="text-[11px] font-bold text-slate-500">by {h.performer_name}</span>}
                        </div>
                        <p className="text-[12.5px] text-slate-700 font-medium">{h.remarks}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}
