import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, XCircle, Clock, FileText, ChevronRight, RefreshCw, 
  MessageSquare, User, Calendar, Shield, Inbox, CheckSquare, Search, Eye
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function ApprovalsInboxPage() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Selected item modal / detail pane
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [docPayload, setDocPayload] = useState(null);
  const [loadingPayload, setLoadingPayload] = useState(false);
  const [comments, setComments] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (activeCompany) {
      loadApprovals();
    }
  }, [activeCompany, activeTab]);

  const loadApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'pending') {
        const { data } = await api.get('/workflows/pending');
        setPendingApprovals(data);
      } else {
        const { data } = await api.get('/workflows/history');
        setHistory(data);
      }
    } catch (err) {
      setError('Failed to fetch approvals data.');
    }
    setLoading(false);
  };

  const handleSelectApproval = async (item) => {
    setSelectedApproval(item);
    setComments('');
    setError(null);
    setSuccess(null);
    setTimeline([]);
    setDocPayload(null);

    // Load timeline
    setLoadingTimeline(true);
    try {
      const { data } = await api.get(`/workflows/timeline/${item.instance_id}`);
      setTimeline(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingTimeline(false);

    // Load document payload details
    setLoadingPayload(true);
    try {
      if (item.document_type_code === 'VOUCHER') {
        const { data } = await api.get(`/vouchers/${activeCompany.id}/${item.document_id}/details`);
        setDocPayload(data);
      } else if (item.document_type_code === 'JOURNAL') {
        const { data } = await api.get(`/journal/${item.document_id}`);
        setDocPayload(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingPayload(false);
  };

  const handleAction = async (action) => {
    if (!selectedApproval) return;
    setSubmittingReview(true);
    setError(null);
    try {
      await api.post(`/workflows/review/${selectedApproval.instance_id}`, {
        action,
        comments
      });
      setSuccess(`Workflow stage successfully ${action === 'APPROVE' ? 'Approved' : 'Rejected'}.`);
      setSelectedApproval(null);
      loadApprovals();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete review action.');
    }
    setSubmittingReview(false);
  };

  const filteredPending = pendingApprovals.filter(p => 
    p.docSummary?.toLowerCase().includes(search.toLowerCase()) ||
    p.stage_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.submitter_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHistory = history.filter(h => 
    h.stage_name?.toLowerCase().includes(search.toLowerCase()) ||
    h.actioned_name?.toLowerCase().includes(search.toLowerCase()) ||
    h.comments?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CheckSquare className="text-emerald-600" size={24} /> Approvals & Workflows Inbox
          </h1>
          <p className="text-slate-500 text-sm font-semibold">Review, approve, and track workflows, document states, and delegations.</p>
        </div>
        
        {/* Navigation / Refresh */}
        <button onClick={loadApprovals} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-100 shadow-sm transition-all">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm text-xs font-bold text-slate-400">
          <p className="uppercase tracking-wider">Pending Approvals</p>
          <p className="text-2xl font-black text-slate-800 mt-1 font-mono">{pendingApprovals.length}</p>
        </div>
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm text-xs font-bold text-slate-400">
          <p className="uppercase tracking-wider">Active Delegations</p>
          <p className="text-2xl font-black text-indigo-600 mt-1 font-mono">1 Active</p>
        </div>
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm text-xs font-bold text-slate-400">
          <p className="uppercase tracking-wider">Processed Today</p>
          <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">14 Completed</p>
        </div>
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm text-xs font-bold text-slate-400">
          <p className="uppercase tracking-wider">Average Approval Time</p>
          <p className="text-2xl font-black text-slate-800 mt-1 font-mono">2.8 Hours</p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pending' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Pending Review ({pendingApprovals.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Approval History
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search approvals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold rounded-xl">
          {success}
        </div>
      )}

      {/* Master Detail Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inbox Table/List */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[350px]">
          {loading ? (
            <div className="text-center py-20 text-slate-400 text-xs">
              <RefreshCw className="animate-spin mx-auto mb-3 text-emerald-500" size={24} /> Loading approvals inbox...
            </div>
          ) : activeTab === 'pending' ? (
            filteredPending.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-2">
                <Inbox className="mx-auto text-slate-200" size={40} />
                <p className="text-xs font-bold">Your pending approvals folder is clean.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPending.map(p => (
                  <div 
                    key={p.approval_id} 
                    onClick={() => handleSelectApproval(p)}
                    className={`p-5 text-xs transition-all hover:bg-slate-50 cursor-pointer flex justify-between items-start gap-4 ${
                      selectedApproval?.approval_id === p.approval_id ? 'bg-emerald-50/30 border-l-4 border-emerald-600 pl-4' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-black text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                          {p.document_type_code}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 font-bold flex items-center gap-1">
                          <Clock size={12} /> {p.stage_name}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-[13px] text-slate-800 leading-snug">{p.docSummary}</h3>
                      <div className="flex items-center gap-2 text-slate-400 font-semibold mt-1">
                        <span className="flex items-center gap-0.5"><User size={11} /> {p.submitter_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Calendar size={11} /> {new Date(p.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-1 flex-shrink-0">
                      <p className="font-mono font-bold text-slate-800 text-[13px]">PKR {fmt(p.amount)}</p>
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold hover:underline">
                        Review <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredHistory.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-2">
                <History className="mx-auto text-slate-200" size={40} />
                <p className="text-xs font-bold">No historical approval actions logged.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredHistory.map(h => (
                  <div key={h.id} className="p-5 text-xs">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            h.action === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>{h.action}</span>
                          <span className="text-slate-400 font-bold">Stage: {h.stage_name}</span>
                        </div>
                        <h4 className="font-extrabold text-[13px] text-slate-800">
                          {h.document_type_code} #{h.document_id}
                        </h4>
                        {h.comments && <p className="text-slate-500 font-medium italic mt-1">"{h.comments}"</p>}
                      </div>
                      <div className="text-right text-slate-400 font-semibold space-y-1">
                        <p className="flex items-center gap-1 justify-end"><User size={11} /> {h.actioned_name}</p>
                        <p className="text-[10px]">{new Date(h.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Action Detail Panel */}
        <div className="lg:col-span-5 space-y-6">
          <AnimatePresence mode="wait">
            {selectedApproval ? (
              <motion.div 
                key={selectedApproval.approval_id}
                initial={{ opacity: 0, x: 12 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -12 }} 
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6"
              >
                {/* Header info */}
                <div className="border-b border-slate-100 pb-4 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                      {selectedApproval.document_type_code} Review
                    </span>
                    <span className="font-mono font-black text-slate-800 text-sm">PKR {fmt(selectedApproval.amount)}</span>
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-[14px]">{selectedApproval.docSummary}</h3>
                </div>

                {/* Document details container */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><FileText size={13} /> Document Payload</h4>
                  
                  {loadingPayload ? (
                    <div className="text-slate-400 text-xs italic"><RefreshCw className="animate-spin inline mr-1" size={12} />Loading details...</div>
                  ) : docPayload ? (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl max-h-48 overflow-y-auto space-y-3 font-semibold text-slate-600 text-[11px]">
                      {selectedApproval.document_type_code === 'VOUCHER' ? (
                        <>
                          <div className="flex justify-between"><span>Number:</span><span className="font-bold text-slate-800">{docPayload.document?.voucherNumber}</span></div>
                          <div className="flex justify-between"><span>Type:</span><span className="font-bold text-slate-800">{docPayload.document?.type}</span></div>
                          <div className="border-t border-slate-200/50 pt-2 space-y-1">
                            {docPayload.financial?.journalLines?.map((line, idx) => (
                              <div key={idx} className="flex justify-between gap-2">
                                <span className="truncate">{line.account_name}</span>
                                <span className="font-mono font-bold shrink-0 text-slate-800">
                                  {parseFloat(line.debit) > 0 ? `DR ${fmt(line.debit)}` : `CR ${fmt(line.credit)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between"><span>ID:</span><span className="font-bold text-slate-800">#{docPayload.id}</span></div>
                          <div className="flex justify-between"><span>Date:</span><span className="font-bold text-slate-800">{new Date(docPayload.entry_date).toLocaleDateString()}</span></div>
                          <div className="border-t border-slate-200/50 pt-2 space-y-1">
                            {docPayload.lines?.map((line, idx) => (
                              <div key={idx} className="flex justify-between gap-2">
                                <span>{line.account_code || line.account_id}</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {parseFloat(line.debit) > 0 ? `DR ${fmt(line.debit)}` : `CR ${fmt(line.credit)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs italic">Failed to resolve payload details.</p>
                  )}
                </div>

                {/* Workflow Timeline history */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Clock size={13} /> Process Timeline</h4>
                  
                  {loadingTimeline ? (
                    <div className="text-slate-400 text-xs italic"><RefreshCw className="animate-spin inline mr-1" size={12} />Loading timeline...</div>
                  ) : (
                    <div className="space-y-3.5 border-l border-slate-100 pl-4 py-1">
                      {timeline.map((t, idx) => (
                        <div key={t.id} className="relative text-xs">
                          <span className={`absolute -left-[21.5px] top-0.5 w-3.5 h-3.5 rounded-full border bg-white flex items-center justify-center ${
                            t.action === 'SUBMITTED' ? 'border-indigo-400 text-indigo-500' :
                            t.action === 'APPROVED' ? 'border-emerald-400 text-emerald-500' :
                            'border-rose-400 text-rose-500'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          </span>
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-slate-800">{t.action} - {t.stage_name}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">By {t.actioned_name || 'System'} • {new Date(t.created_at).toLocaleTimeString()}</p>
                            {t.comments && <p className="text-[11px] text-slate-500 italic mt-0.5">"{t.comments}"</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input action fields */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Comments / Remarks</label>
                    <textarea 
                      rows={2.5}
                      placeholder="Add remarks supporting your decision..."
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-[13px] font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-rose-600 font-bold animate-pulse">{error}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      disabled={submittingReview}
                      onClick={() => handleAction('REJECT')}
                      className="flex items-center justify-center gap-1.5 py-3 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-[13px] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      disabled={submittingReview}
                      onClick={() => handleAction('APPROVE')}
                      className="flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[13px] transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> Approve
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty-detail"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="p-8 border border-dashed border-slate-200 rounded-3xl text-center text-slate-400 space-y-3 py-20"
              >
                <Shield size={36} className="mx-auto text-slate-300" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Review Panel</h3>
                  <p className="text-[11px] font-semibold mt-1">Select an item from the inbox to display detailed payload composition and execute approval reviews.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
