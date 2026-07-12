import { useState, useEffect, useCallback } from 'react';
import { 
  Mail, RefreshCw, Search, CheckCircle, XCircle, AlertTriangle, 
  Send, ShieldAlert, ArrowRight, Play, Eye
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RightDrawer from '../../components/ui/RightDrawer';

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

  // New Communication Compose Panel States
  const [isComposing, setIsComposing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [composingMsg, setComposingMsg] = useState({
    employeeId: '',
    subject: '',
    body: ''
  });
  const [sending, setSending] = useState(false);

  // Email Settings & Subscriptions states
  const [activeSubTab, setActiveSubTab] = useState('monitor');
  const [employeesSettings, setEmployeesSettings] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loadingSettings, setLoadingSettings] = useState(false);

  const fetchSettingsData = async () => {
    if (!activeCompany?.id) return;
    setLoadingSettings(true);
    setError(null);
    try {
      const res = await api.get(`/employees/${activeCompany.id}`);
      const validEmployees = res.data || [];
      setEmployeesSettings(validEmployees);

      const subData = {};
      await Promise.all(validEmployees.map(async (emp) => {
        try {
          const subRes = await api.get(`/employees/${activeCompany.id}/${emp.id}/notification-subscriptions`);
          subData[emp.id] = subRes.data || [];
        } catch (e) {
          console.error(`Failed to load subscriptions for employee ${emp.id}:`, e);
          subData[emp.id] = [];
        }
      }));
      setSubscriptions(subData);
    } catch (err) {
      console.error("Failed to load settings data:", err);
      setError('Failed to load employee list or preferences.');
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'settings') {
      fetchSettingsData();
    }
  }, [activeSubTab, activeCompany?.id]);

  const handleToggleSubscription = async (empId, eventCode, isChecked) => {
    const empSubs = subscriptions[empId] || [];
    let eventSub = empSubs.find(s => s.eventCode === eventCode);
    let updatedSubs;
    
    if (eventSub) {
      updatedSubs = empSubs.map(s => {
        if (s.eventCode === eventCode) {
          return {
            ...s,
            channels: {
              ...s.channels,
              EMAIL: isChecked,
              APP: s.channels.APP !== undefined ? !!s.channels.APP : true
            }
          };
        }
        return s;
      });
    } else {
      let eventId = null;
      Object.values(subscriptions).forEach(subsList => {
        const found = subsList.find(s => s.eventCode === eventCode);
        if (found) eventId = found.eventId;
      });
      if (!eventId) {
        const fallbackIds = {
          'LOW_STOCK_ALERT': 1,
          'JOURNAL_POSTED': 10,
          'BUDGET_EXCEEDED': 13,
          'PAYROLL_POSTED': 14,
          'RISK_OVERRIDE_REQUESTED': 3
        };
        eventId = fallbackIds[eventCode];
      }
      updatedSubs = [
        ...empSubs,
        {
          eventId,
          eventCode,
          channels: {
            EMAIL: isChecked,
            APP: true,
            SMS: false,
            WHATSAPP: false,
            SLACK: false,
            TEAMS: false
          }
        }
      ];
    }
    
    setSubscriptions(prev => ({
      ...prev,
      [empId]: updatedSubs
    }));
    
    try {
      const apiPayload = updatedSubs.map(s => ({
        eventId: s.eventId,
        channels: s.channels
      }));
      await api.put(`/employees/${activeCompany.id}/${empId}/notification-subscriptions`, {
        subscriptions: apiPayload
      });
    } catch (err) {
      console.error("Failed to save subscription update:", err);
      setSubscriptions(prev => ({
        ...prev,
        [empId]: empSubs
      }));
      setError("Failed to update email preferences.");
      setTimeout(() => setError(null), 4000);
    }
  };

  const fetchEmployees = async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await api.get(`/employees/${activeCompany.id}`);
      // Filter out employees without email addresses to avoid dispatch errors
      const validEmployees = (res.data || []).filter(emp => emp.user_email || emp.email);
      setEmployees(validEmployees);
    } catch (err) {
      console.error('Failed to fetch employees list for communication:', err);
    }
  };

  useEffect(() => {
    if (isComposing) {
      fetchEmployees();
    }
  }, [isComposing, activeCompany?.id]);

  const handleSendCommunication = async (e) => {
    e.preventDefault();
    if (!composingMsg.employeeId || !composingMsg.subject || !composingMsg.body) {
      alert('Recipient employee, subject, and message body are required.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.post(`/notifications/admin/email-queue/compose/${activeCompany.id}`, composingMsg);
      setSuccessMsg('Communication email queued successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      setIsComposing(false);
      setComposingMsg({ employeeId: '', subject: '', body: '' });
      loadQueue();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSending(false);
    }
  };

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
        
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button 
            onClick={() => setIsComposing(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5 text-[11px] uppercase tracking-wider"
          >
            <Send size={12} /> Send Communication
          </button>
          <button onClick={loadQueue} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
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

      {/* Sub tabs */}
      <div className="flex border-b border-slate-200 gap-1 mt-1">
        <button
          onClick={() => setActiveSubTab('monitor')}
          className={`pb-2.5 px-4 font-bold text-[12px] border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'monitor'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          SMTP Monitor Queue
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`pb-2.5 px-4 font-bold text-[12px] border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'settings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Employee Email Settings
        </button>
      </div>

      {activeSubTab === 'monitor' && (
        <>
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
                className="input-enterprise !pl-9 py-2.5 text-[12px]" 
                style={{ paddingLeft: '34px' }}
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
        </>
      )}

      {activeSubTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold text-[13px] text-slate-800 uppercase">Employee Outbound Email Preferences</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Toggle checkboxes to subscribe or unsubscribe employees from automated system emails.</p>
            </div>
            <button 
              onClick={fetchSettingsData} 
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
            >
              <RefreshCw size={12} className={loadingSettings ? "animate-spin" : ""} /> Reload Preferences
            </button>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-3xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3.5 w-1/3">Employee Profile</th>
                    <th className="px-4 py-3.5 text-center">Inventory Alerts</th>
                    <th className="px-4 py-3.5 text-center">Finance & Journals</th>
                    <th className="px-4 py-3.5 text-center">Budget Alerts</th>
                    <th className="px-4 py-3.5 text-center">Payroll runs</th>
                    <th className="px-4 py-3.5 text-center">Risk Alerts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11.5px] font-semibold text-slate-600">
                  {loadingSettings ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto mb-2" />
                        <span>Fetching preferences from ledger...</span>
                      </td>
                    </tr>
                  ) : employeesSettings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-slate-400 italic">
                        No active employees found. Please register employees first.
                      </td>
                    </tr>
                  ) : employeesSettings.map(emp => {
                    const subList = subscriptions[emp.id] || [];
                    const getEmailChecked = (eventCode) => {
                      const sub = subList.find(s => s.eventCode === eventCode);
                      return sub ? !!sub.channels?.EMAIL : false;
                    };
                    
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/40">
                        <td className="px-4 py-3">
                          <span className="font-extrabold text-slate-800 block">{emp.name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{emp.designation || 'Staff'} • {emp.department || 'General'}</span>
                          <span className="text-[9.5px] text-slate-400 font-mono font-medium block mt-0.5">{emp.user_email || emp.email || 'No Email'}</span>
                        </td>
                        
                        {[
                          { code: 'LOW_STOCK_ALERT', label: 'Inventory' },
                          { code: 'JOURNAL_POSTED', label: 'Finance' },
                          { code: 'BUDGET_EXCEEDED', label: 'Budgets' },
                          { code: 'PAYROLL_POSTED', label: 'Payroll' },
                          { code: 'RISK_OVERRIDE_REQUESTED', label: 'Risk' }
                        ].map(col => (
                          <td key={col.code} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={getEmailChecked(col.code)}
                                disabled={!(emp.user_email || emp.email)}
                                onChange={e => handleToggleSubscription(emp.id, col.code, e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={`Toggle email notifications for ${col.label}`}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

      <RightDrawer
        isOpen={isComposing}
        onClose={() => {
          setIsComposing(false);
          setComposingMsg({ employeeId: '', subject: '', body: '' });
        }}
        title="Send Communication"
        subtitle="Compose and queue direct email messages to your employees using enterprise mail settings."
      >
        <form onSubmit={handleSendCommunication} className="space-y-4 font-semibold text-xs text-slate-600 pr-1">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Recipient Employee *</label>
            <select
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer text-xs"
              value={composingMsg.employeeId}
              onChange={e => setComposingMsg({...composingMsg, employeeId: e.target.value})}
            >
              <option value="">— Select Employee —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.user_email || emp.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Subject *</label>
            <input
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-xs"
              value={composingMsg.subject}
              onChange={e => setComposingMsg({...composingMsg, subject: e.target.value})}
              placeholder="e.g. August performance review invitation"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Message Body *</label>
            <textarea
              required
              rows={12}
              className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-xs leading-normal"
              value={composingMsg.body}
              onChange={e => setComposingMsg({...composingMsg, body: e.target.value})}
              placeholder="Write your email message here..."
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs cursor-pointer shadow-sm transition-colors mt-2"
          >
            {sending ? 'Queueing Message...' : 'Send Communication Now'}
          </button>
        </form>
      </RightDrawer>
    </div>
  );
}
