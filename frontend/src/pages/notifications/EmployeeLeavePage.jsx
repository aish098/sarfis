import React, { useState, useEffect } from 'react';
import { Calendar, Plus, RefreshCw, Send, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function EmployeeLeavePage() {
  const { activeCompany } = useAuthStore();
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState({ total_allowed: 15, remaining: 15 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [formData, setFormData] = useState({
    leave_type: 'Annual',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const loadData = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const [leavesRes, balRes] = await Promise.all([
        api.get(`/communications/ess/${activeCompany.id}/leaves`),
        api.get(`/communications/ess/${activeCompany.id}/leave-balances`)
      ]);
      setLeaves(leavesRes.data || []);
      setBalance(balRes.data || { total_allowed: 15, remaining: 15 });
    } catch (err) {
      console.error('Failed to load leave history', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeCompany?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post(`/communications/ess/${activeCompany.id}/leaves`, formData);
      setMessage({ type: 'success', text: 'Leave application submitted successfully for HR review!' });
      setFormData({
        leave_type: 'Annual',
        start_date: '',
        end_date: '',
        reason: ''
      });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to submit leave request.' });
    }
    setSubmitting(false);
  };

  const getStatusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle2 size={12} /> Approved
        </span>
      );
    }
    if (s === 'rejected' || s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
          <AlertCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
        <Clock size={12} /> Pending Approval
      </span>
    );
  };

  return (
    <div className="p-5 lg:p-7 space-y-6 pb-16 min-h-full" style={{ background: '#faf9f8' }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[20px] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar size={22} className="text-emerald-500" /> Leave & Absence Manager
          </h2>
          <p className="text-[12px] text-slate-500 font-semibold mt-1">Track your balance, view history, and submit new leave requests.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 transition shadow-2xs cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Balance Widget Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-3xs">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Annual Allowed</span>
          <span className="text-[24px] font-black text-slate-800 mt-2">{balance.total_allowed} Days</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-3xs bg-gradient-to-br from-emerald-50/20 to-white">
          <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider">Remaining Leaves</span>
          <span className="text-[24px] font-black text-emerald-600 mt-2">{balance.remaining} Days</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-3xs">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Leaves Taken</span>
          <span className="text-[24px] font-black text-indigo-600 mt-2">{balance.total_allowed - balance.remaining} Days</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Apply Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs h-fit">
          <h3 className="text-[14px] font-black text-slate-900 flex items-center gap-1.5">
            <Plus size={16} className="text-emerald-500" /> Apply for Leave
          </h3>

          {message && (
            <div className={`p-3 rounded-lg text-xs font-semibold ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-600">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Leave Type</label>
              <select
                required
                value={formData.leave_type}
                onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[13px] text-slate-800 outline-none focus:border-emerald-500 font-semibold cursor-pointer"
              >
                <option value="Annual">Annual Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Casual">Casual Leave</option>
                <option value="Unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Start Date</label>
                <input
                  required
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[13px] text-slate-800 outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">End Date</label>
                <input
                  required
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[13px] text-slate-800 outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Reason</label>
              <textarea
                required
                rows={4}
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Brief justification for your leave application..."
                className="w-full p-3 border border-slate-300 rounded-lg text-[13px] text-slate-800 outline-none focus:border-emerald-500 font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm text-xs"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Submit Leave Request
            </button>
          </form>
        </div>

        {/* Right Column: History List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-[13px] font-black text-slate-900">Leave Applications History</h3>
          </div>

          {loading ? (
            <div className="p-16 text-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
              <p className="text-slate-400 text-xs font-semibold">Loading leave requests history...</p>
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-medium italic">No leave applications found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[9px] tracking-wider border-b border-slate-200">
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">{l.leave_type} Leave</td>
                      <td className="px-4 py-3 font-mono">
                        {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-slate-500" title={l.reason}>{l.reason}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(l.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}