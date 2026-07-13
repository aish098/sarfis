import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, CheckCircle, RefreshCw, Trash2, Calendar, ShieldAlert, ArrowRight, User } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import VoucherForm from './VoucherForm';
import VoucherDetails from './VoucherDetails';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';

const STATUS_BADGES = {
  DRAFT: 'bg-amber-55 bg-amber-50 text-amber-600 border border-amber-100',
  PENDING_APPROVAL: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  POSTED: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
};

const TYPE_LABELS = {
  PURCHASE: 'Purchase Voucher',
  SALES: 'Sales Invoice',
  RECEIPT: 'Cash Receipt',
  PAYMENT: 'Payment Voucher',
  JOURNAL: 'Journal Adjustment',
};

const stagger = { animate: { transition: { staggerChildren: 0.03 } } };
const rowAnim = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25 } }
};

function VoucherList() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittingId, setSubmittingId] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/vouchers/${activeCompany.id}`);
      setVouchers(res.data);
    } catch (err) {
      console.error('Failed to load vouchers:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const handlePost = async (id) => {
    if (!window.confirm('Post this voucher to the General Ledger? This will lock the document and immediately update ledger and inventory balances.')) return;
    setSubmittingId(id);
    try {
      await api.post(`/vouchers/${activeCompany.id}/${id}/post`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post voucher.');
    }
    setSubmittingId(null);
  };

  const handleSubmitApproval = async (id) => {
    if (!window.confirm('Submit this voucher for manager approval?')) return;
    setSubmittingId(id);
    try {
      await api.post(`/vouchers/${activeCompany.id}/${id}/submit`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit voucher for approval.');
    }
    setSubmittingId(null);
  };

  const handleReverse = async (id) => {
    if (!window.confirm('Are you sure you want to REVERSE this posted transaction? SCAFIS will write automatic offsetting offset journal entries to zero out ledger and stock logs.')) return;
    setSubmittingId(id);
    try {
      await api.post(`/vouchers/${activeCompany.id}/${id}/reverse`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reverse voucher.');
    }
    setSubmittingId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft voucher? This action is irreversible.')) return;
    try {
      await api.delete(`/vouchers/${activeCompany.id}/${id}`);
      load();
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  };

  const filtered = vouchers.filter(v => {
    const q = searchQuery.toLowerCase();
    const matchSearch = v.voucher_number.toLowerCase().includes(q) || 
                        (v.payload?.notes && v.payload.notes.toLowerCase().includes(q));
    const matchType = filterType === 'ALL' || v.type === filterType;
    const matchStatus = filterStatus === 'ALL' || v.status === filterStatus;
    
    return matchSearch && matchType && matchStatus;
  });

  const countTotal = vouchers.length;
  const countDraft = vouchers.filter(v => v.status === 'DRAFT').length;
  const countPending = vouchers.filter(v => v.status === 'PENDING_APPROVAL').length;
  const countPosted = vouchers.filter(v => v.status === 'POSTED').length;
  const countReversed = vouchers.filter(v => v.is_reversed || v.status === 'REVERSED' || v.status === 'CANCELLED').length;

  const kpisList = [
    { label: 'Total Documents', value: countTotal, icon: FileText, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650' },
    { label: 'Drafts', value: countDraft, icon: FileText, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-500' },
    { label: 'Pending Approval', value: countPending, icon: FileText, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600' },
    { label: 'Posted to Ledger', value: countPosted, icon: CheckCircle, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' },
    { label: 'Reversed/Cancelled', value: countReversed, icon: ShieldAlert, iconBgClass: 'bg-rose-50', iconColorClass: 'text-rose-650' }
  ];

  return (
    <>
      <WorkspaceLayout
        title="ERP Voucher Register"
        subtitle="Create and post transaction-driven business records."
        icon={FileText}
        badgeText="Double-Entry"
        breadcrumbs={['SARFIS', 'Finance', 'ERP Vouchers']}
        primaryAction={
          <button onClick={() => navigate('new')} className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none">
            <Plus size={14} /> New Transaction
          </button>
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by voucher # or remarks..."
        kpis={kpisList}
      >
        {/* Type & Status Filters */}
        <div className="col-span-full mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 border border-slate-100 rounded-xl w-fit">
            {['ALL', 'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4.5 py-2 text-[12.5px] font-bold rounded-lg transition-all border-none bg-transparent cursor-pointer ${
                  filterType === t 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t === 'ALL' ? 'All Documents' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="relative w-[180px]">
            <select
              className="input-enterprise pr-10 text-[13px] cursor-pointer appearance-none pl-3"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Drafts</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="POSTED">Posted to Ledger</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table Card */}
        <div className="col-span-full">
          <div className="card overflow-hidden bg-white border border-slate-100 rounded-3xl">
            <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                <th style={{ width: '12%' }} className="!pl-5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Document No</th>
                <th style={{ width: '15%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Voucher Type</th>
                <th style={{ width: '12%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Fiscal Date</th>
                <th style={{ width: '15%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Amount</th>
                <th style={{ width: '15%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Voucher Status</th>
                <th style={{ width: '31%' }} className="!text-left !pr-5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Posting Operations</th>
              </tr>
            </thead>
            <Motion.tbody variants={stagger} initial="initial" animate="animate" className="divide-y divide-[#E6EBE8]">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 !pl-5"><div className="skeleton h-3.5 w-16" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-3.5 w-24" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-3.5 w-16" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-3.5 w-20" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-6 w-36 rounded" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-[13px] font-bold">No ERP vouchers recorded for this criteria.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((v, idx) => (
                  <Motion.tr key={v.id} variants={rowAnim} className={`group transition-colors relative ${
                    idx % 2 === 0 ? 'bg-[#FFFDFB] hover:bg-emerald-50/15' : 'bg-[#FAFAF9] hover:bg-emerald-50/15'
                  }`}>
                    <td className="px-4 py-3 !pl-5">
                      <Link to={`details/${v.id}`} className="font-mono font-bold text-[13px] text-indigo-600 hover:text-indigo-800 hover:underline">
                        {v.voucher_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[13px] text-slate-800">{TYPE_LABELS[v.type]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[12.5px]">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{new Date(v.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-extrabold text-[13.5px] text-slate-900">
                        ${Math.abs(parseFloat(v.total_amount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex items-center justify-center font-black uppercase text-[10px] tracking-widest px-2.5 py-0.5 rounded-full w-fit ${STATUS_BADGES[v.status]}`}>
                          {v.status.replace('_', ' ')}
                        </span>
                        {v.is_reversed && (
                          <span className="inline-flex items-center justify-center font-black uppercase text-[9px] tracking-widest bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full w-fit">
                            Reversed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="!text-left px-4 py-3 !pr-5">
                      <div className="flex items-center gap-2">
                        {v.status === 'DRAFT' && (
                          <>
                            <Link to={`edit/${v.id}`}
                              className="px-3 py-1.5 text-[11.5px] font-bold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/70 rounded-lg transition-all">
                              Edit Draft
                            </Link>
                            <button
                              disabled={submittingId === v.id}
                              onClick={() => handleSubmitApproval(v.id)}
                              className="px-3 py-1.5 text-[11.5px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle size={12} /> {submittingId === v.id ? 'Submitting...' : 'Submit Approval'}
                            </button>
                            <button
                              disabled={submittingId === v.id}
                              onClick={() => handlePost(v.id)}
                              className="px-3 py-1.5 text-[11.5px] font-bold text-white bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] rounded-lg shadow-sm shadow-emerald-500/10 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            >
                              <CheckCircle size={12} /> {submittingId === v.id ? 'Posting...' : 'Post to Ledger'}
                            </button>
                            <button onClick={() => handleDelete(v.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        {v.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              disabled={submittingId === v.id}
                              onClick={() => handlePost(v.id)}
                              className="px-3 py-1.5 text-[11.5px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg shadow-sm shadow-indigo-500/10 transition-all flex items-center gap-1"
                            >
                              <CheckCircle size={12} /> {submittingId === v.id ? 'Approving...' : 'Approve & Post'}
                            </button>
                          </>
                        )}
                        {v.status === 'POSTED' && !v.is_reversed && (
                          <button
                            disabled={submittingId === v.id}
                            onClick={() => handleReverse(v.id)}
                            className="px-3 py-1.5 text-[11.5px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> {submittingId === v.id ? 'Reversing...' : 'Reverse Posted'}
                          </button>
                        )}
                        {v.status === 'POSTED' && v.is_reversed && (
                          <span className="text-[12px] text-slate-400 font-semibold italic flex items-center gap-1.5">
                            <ShieldAlert size={13} className="text-slate-300" /> Fully reversed & settled
                          </span>
                        )}
                      </div>
                    </td>
                  </Motion.tr>
                ))
              )}
            </Motion.tbody>
          </table>
        </div>
      </div>
      </div>
      </WorkspaceLayout>
    </>
  );
}

export default function VouchersPage() {
  return (
    <Routes>
      <Route index element={<VoucherList />} />
      <Route path="new" element={<VoucherForm />} />
      <Route path="edit/:id" element={<VoucherForm />} />
      <Route path="details/:id" element={<VoucherDetails />} />
    </Routes>
  );
}
