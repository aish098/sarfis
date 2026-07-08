import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle, Clock, ShieldCheck, 
  DollarSign, Activity, FileText, ChevronRight, UserCheck, Trash2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const STATUS_BADGES = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  WATCHLIST: 'bg-amber-50 text-amber-700 border-amber-100',
  RESTRICTED: 'bg-orange-50 text-orange-700 border-orange-100',
  BLACKLISTED: 'bg-red-50 text-red-700 border-red-100',
  REINSTATED: 'bg-blue-50 text-blue-700 border-blue-100'
};

const RISK_LEVELS = {
  LOW: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-orange-50 text-orange-700',
  CRITICAL: 'bg-red-50 text-red-700'
};

export default function RiskDashboard() {
  const { activeCompany } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [blacklisted, setBlacklisted] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [reinstatements, setReinstatements] = useState([]);
  const [pendingOverrides, setPendingOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('summary'); // summary | blacklists | incidents | reinstatements | overrides
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
      const [statsRes, blackRes, incRes, reinRes, overRes] = await Promise.all([
        api.get('/risk/dashboard-stats'),
        api.get('/risk/reports/blacklisted'),
        api.get('/risk/reports/bad-debts'),
        api.get('/risk/reports/reinstatements'),
        api.get('/risk/approval-requests/pending')
      ]);
      setStats(statsRes.data);
      setBlacklisted(blackRes.data);
      setIncidents(incRes.data);
      setReinstatements(reinRes.data);
      setPendingOverrides(overRes.data);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] font-bold text-slate-400">Loading risk dashboard analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md">
            <ShieldAlert size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-amber-900 tracking-tight uppercase">
              Credit Risk & Governance Dashboard
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Monitor active customer defaults, collection recovery analytics, bad debts, and relationship reinstatements.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Partners at Risk</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{stats.customersAtRisk}</span>
            <span className="text-[10.5px] font-semibold text-red-500 block mt-1">High / Critical Risk Levels</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Active Blacklists</span>
            <span className="text-2xl font-black text-slate-800 font-mono">{stats.blacklisted}</span>
            <span className="text-[10.5px] font-semibold text-slate-500 block mt-1">{stats.watchlist} on Watchlist</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Recovered Debt</span>
            <span className="text-2xl font-black text-emerald-600 font-mono">PKR {stats.recoveredDebt.toLocaleString()}</span>
            <span className="text-[10.5px] font-semibold text-slate-500 block mt-1">From resolved risk incidents</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Outstanding Bad Debt</span>
            <span className="text-2xl font-black text-red-600 font-mono">PKR {stats.outstandingBadDebt.toLocaleString()}</span>
            <span className="text-[10.5px] font-semibold text-slate-500 block mt-1">Avg recovery: {stats.averageRecoveryTime} days</span>
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="bg-white border border-slate-100 rounded-xl p-1 flex w-fit shadow-sm">
        {[
          { id: 'summary', label: 'Governance Overview' },
          { id: 'blacklists', label: `Active Watch/Blocks (${blacklisted.length})` },
          { id: 'incidents', label: `Defaulter Logs (${incidents.length})` },
          { id: 'reinstatements', label: `Reinstatements Review (${reinstatements.filter(r => r.status === 'PENDING').length})` },
          { id: 'overrides', label: `Override Requests (${pendingOverrides.length})` }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-1.5 text-[12px] font-bold rounded-lg transition-all ${activeSubTab === tab.id ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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
                        <button onClick={() => setSelectedRequest(req)} className="text-[11px] font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1">
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
                          <span className={`inline-block text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded border ${STATUS_BADGES[b.status]}`}>{b.status}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-black text-slate-800 font-mono">Score: {b.risk_score} pts</p>
                          <p className={`text-[10px] font-bold ${RISK_LEVELS[b.risk_level]}`}>{b.risk_level} RISK</p>
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
                        <span className={`badge border text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${STATUS_BADGES[b.status]}`}>{b.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10.5px] font-extrabold uppercase px-2 py-0.5 rounded ${RISK_LEVELS[b.risk_level]}`}>{b.risk_level}</span>
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
                        {i.resolved ? (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">RESOLVED</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">UNRESOLVED</span>
                        )}
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
                        <span className={`badge border text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          r.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          r.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>{r.status}</span>
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
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
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
  );
}
