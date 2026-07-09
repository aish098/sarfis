import { useState, useEffect, useCallback } from 'react';
import { 
  Mail, RefreshCw, Search, CheckCircle, XCircle, AlertTriangle, 
  Send, ShieldAlert, ArrowRight, Play, Eye
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function EmailCenterPage() {
  const { activeCompany } = useAuthStore();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [resendingId, setResendingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Selected detail modal
  const [selectedItem, setSelectedItem] = useState(null);

  const loadQueue = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/notifications/admin/email-queue/${activeCompany.id}`, {
        params: { status: statusFilter, search: searchTerm }
      });
      setQueue(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  }, [activeCompany, statusFilter, searchTerm]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleResend = async (id) => {
    setResendingId(id);
    setSuccessMsg('');
    setError(null);
    try {
      await api.post(`/notifications/admin/email-queue/${id}/resend/${activeCompany.id}`);
      setSuccessMsg('Email successfully re-queued for delivery.');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadQueue();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setResendingId(null);
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6 text-xs font-semibold text-slate-600">
      
      {/* Top Banner */}
      <div className="w-full bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <Mail size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-slate-800 tracking-tight uppercase">Email Center</h1>
              <span className="text-[10px] font-extrabold uppercase bg-indigo-500/10 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-500/20">SMTP Monitor</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Monitor queued transactional emails, track delivery logs, and trigger manual retries.</p>
          </div>
        </div>
        
        <button onClick={loadQueue} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer self-end md:self-auto">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2 font-bold">
          <CheckCircle size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg flex items-center gap-2 font-bold">
          <ShieldAlert size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-3xs">
        <div className="flex flex-wrap items-center gap-3">
          <select 
            className="input-enterprise max-w-[150px] text-[11px] font-bold" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Delivery Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="RETRY">Retry</option>
          </select>
        </div>

        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-10 py-2.5 text-[12px]" 
            placeholder="Search email or subject..."
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-3xs">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3">Recipient Employee</th>
              <th className="px-4 py-3">Subject / Event</th>
              <th className="px-4 py-3 text-center">Module</th>
              <th className="px-4 py-3 text-center">Priority</th>
              <th className="px-4 py-3 text-center">Attempts</th>
              <th className="px-4 py-3">Last Attempt</th>
              <th className="px-4 py-3">Delivery Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white text-[11px] font-bold text-slate-600">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto mb-2" />
                  <span>Scanning queue ledger...</span>
                </td>
              </tr>
            ) : queue.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 italic">
                  No queued notification emails found matching current filters.
                </td>
              </tr>
            ) : queue.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <span className="font-extrabold text-slate-800 block">{item.recipient_name}</span>
                  <span className="text-[10px] text-slate-400 font-mono font-medium block mt-0.5">{item.recipient_email}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-extrabold text-slate-800 block max-w-xs truncate">{item.subject}</span>
                  <span className="text-[9.5px] font-mono text-slate-400 block mt-0.5">{item.event_code}</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-500">{item.module}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${
                    item.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                    item.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {item.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono">{item.attempts} / {item.max_attempts}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                  {item.last_attempt_at ? new Date(item.last_attempt_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[9.5px] uppercase font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    item.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' :
                    item.status === 'FAILED' ? 'bg-rose-100 text-rose-800' :
                    item.status === 'RETRY' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {item.status === 'SENT' && <CheckCircle size={10} />}
                    {item.status === 'FAILED' && <XCircle size={10} />}
                    {item.status === 'RETRY' && <AlertTriangle size={10} />}
                    <span>{item.status}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => setSelectedItem(item)}
                      className="p-1.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                      title="Inspect Email"
                    >
                      <Eye size={12} />
                    </button>
                    {(item.status === 'FAILED' || item.status === 'RETRY') && (
                      <button 
                        onClick={() => handleResend(item.id)}
                        disabled={resendingId === item.id}
                        className="p-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 rounded-lg cursor-pointer disabled:opacity-50"
                        title="Force Resend"
                      >
                        <Send size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inspect Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-[#FAFBFB] flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-slate-800 text-[13px] uppercase">Inspect Email Payload</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">SMTP Delivery Trace #{selectedItem.id}</p>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 text-[11px] font-bold border px-3 py-1 bg-white rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Recipient</span>
                  <span className="font-extrabold text-slate-800">{selectedItem.recipient_name}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Email</span>
                  <span className="font-mono text-slate-700">{selectedItem.recipient_email}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Subject</span>
                  <span className="font-extrabold text-slate-800">{selectedItem.subject}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Event Code</span>
                  <span className="font-mono text-indigo-600">{selectedItem.event_code}</span>
                </div>
              </div>

              {selectedItem.error_log && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl space-y-1">
                  <span className="font-black uppercase text-[9px] tracking-wider text-rose-500 block">SMTP Exception Log</span>
                  <p className="font-mono text-[10.5px] leading-relaxed font-bold">{selectedItem.error_log}</p>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">HTML Body Output</span>
                <div 
                  className="p-4 bg-slate-50 border border-slate-100 text-[11.5px] rounded-xl font-normal text-slate-600 leading-relaxed max-h-60 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedItem.body }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
