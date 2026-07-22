import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, RefreshCw, CheckCircle, Send, ShieldAlert,
  Trash2, RotateCcw, AlertTriangle, CheckCircle2, User,
  FileSignature, CheckSquare, Sliders, Shield, Settings, Info, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RightDrawer from '../../components/ui/RightDrawer';

const TEMPLATES = [
  {
    id: 'payslip',
    name: 'Salary Payslip Release Notification',
    subject: 'Salary Payslip Released - [Month/Year]',
    body: 'Dear [Employee Name],\n\nYour salary payslip for the month of [Month] has been generated and released. Please login to your employee portal to view and download it.\n\nBest regards,\nHR Department'
  },
  {
    id: 'leave',
    name: 'Leave Request Approved Notification',
    subject: 'Leave Request Approved',
    body: 'Dear [Employee Name],\n\nYour leave application starting from [Start Date] to [End Date] has been Approved.\n\nBest regards,\nHR Department'
  },
  {
    id: 'promotion',
    name: 'Performance Appraisal & Promotion Notice',
    subject: 'Appraisal & Promotion Notification',
    body: 'Dear [Employee Name],\n\nWe are pleased to notify you that based on your performance review, you have been promoted to [New Designation] with effect from [Effective Date].\n\nBest regards,\nManagement'
  },
  {
    id: 'warning',
    name: 'Official Policy Compliance Warning',
    subject: 'Official Warning Letter',
    body: 'Dear [Employee Name],\n\nThis is an official warning letter regarding [Reason]. Please ensure compliance with company policies to avoid disciplinary action.\n\nBest regards,\nHR Department'
  }
];

function MessageSquareIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function EmailCenterPage() {
  const { activeCompany } = useAuthStore();
  const [activeTab, setActiveTab] = useState('communications');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // List of employees for selection
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Communications tab states
  const [convs, setConvs] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Compose Drawer state
  const [isComposing, setIsComposing] = useState(false);
  const [composingMsg, setComposingMsg] = useState({
    employeeId: '',
    subject: '',
    body: ''
  });
  const [sendingCompose, setSendingCompose] = useState(false);



  // SMTP Settings states
  const [smtpConfig, setSmtpConfig] = useState({
    provider: 'MOCK',
    host: '',
    port: '587',
    username: '',
    password: '',
    encryption: 'TLS',
    from_name: 'Accountellence',
    from_email: '',
    status: 'ACTIVE'
  });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Preferences preferences grid
  const [subscriptions, setSubscriptions] = useState({});
  const [loadingSettings, setLoadingSettings] = useState(false);

  const threadEndRef = useRef(null);

  useEffect(() => {
    if (activeThread) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread]);

  const loadInitialData = async () => {
    if (!activeCompany?.id) return;
    setLoadingEmployees(true);
    try {
      const res = await api.get(`/employees/${activeCompany.id}`);
      setEmployees(res.data || []);
    } catch (err) {
      console.error('Failed to load employees', err);
    }
    setLoadingEmployees(false);

    if (activeTab === 'communications') {
      fetchConvs();
    } else if (activeTab === 'settings') {
      fetchSmtpSettings();
      fetchPreferencesGrid();
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [activeCompany?.id, activeTab]);

  // Communications Actions
  const fetchConvs = async () => {
    if (!activeCompany?.id) return;
    setLoadingConvs(true);
    try {
      const res = await api.get(`/communications/admin/${activeCompany.id}`);
      setConvs(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoadingConvs(false);
  };

  const loadThread = async (parentId) => {
    if (!activeCompany?.id) return;
    setLoadingThread(true);
    try {
      const res = await api.get(`/communications/admin/${activeCompany.id}/thread/${parentId}`);
      setActiveThread(res.data);
      setConvs(prev => prev.map(c => c.id === parentId ? { ...c, unreadCount: 0 } : c));
    } catch (err) {
      console.error(err);
    }
    setLoadingThread(false);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !activeThread || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      const parentId = activeThread.conversation.id;
      const res = await api.post(`/communications/admin/${activeCompany.id}/reply`, {
        parentId,
        body: replyBody
      });
      setActiveThread(prev => ({
        ...prev,
        replies: [...prev.replies, res.data]
      }));
      setReplyBody('');
      fetchConvs();
    } catch (err) {
      console.error(err);
    }
    setSendingReply(false);
  };

  const handleSendCompose = async (e) => {
    e.preventDefault();
    if (!composingMsg.employeeId || !composingMsg.subject || !composingMsg.body) return;
    setSendingCompose(true);
    try {
      await api.post(`/communications/admin/${activeCompany.id}/compose`, composingMsg);
      setSuccessMsg('Communication queued and dispatched!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsComposing(false);
      setComposingMsg({ employeeId: '', subject: '', body: '' });
      fetchConvs();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setTimeout(() => setError(null), 4000);
    }
    setSendingCompose(false);
  };



  // Settings: SMTP Actions
  const fetchSmtpSettings = async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await api.get(`/settings/${activeCompany.id}/mail-config`);
      setSmtpConfig(res.data || { provider: 'MOCK', encryption: 'TLS', status: 'ACTIVE' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      await api.put(`/settings/${activeCompany.id}/mail-config`, smtpConfig);
      setSuccessMsg('SMTP configurations saved successfully.');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setTimeout(() => setError(null), 4500);
    }
    setSavingSmtp(false);
  };

  const handleTestSmtp = async (e) => {
    e.preventDefault();
    if (!testEmail) return;
    setTestingSmtp(true);
    try {
      const res = await api.post(`/settings/${activeCompany.id}/mail-config/test`, {
        ...smtpConfig,
        testEmail
      });
      setSuccessMsg(res.data.message || 'SMTP Connection Test Succeeded!');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setError(err.response?.data?.error || 'Test Connection Failed.');
      setTimeout(() => setError(null), 4500);
    }
    setTestingSmtp(false);
  };

  // Settings: Preferences matrix
  const fetchPreferencesGrid = async () => {
    if (!activeCompany?.id) return;
    setLoadingSettings(true);
    try {
      const res = await api.get(`/employees/${activeCompany.id}`);
      const validEmployees = res.data || [];
      const subData = {};
      await Promise.all(validEmployees.map(async (emp) => {
        try {
          const subRes = await api.get(`/employees/${activeCompany.id}/${emp.id}/notification-subscriptions`);
          subData[emp.id] = subRes.data || [];
        } catch (e) {
          subData[emp.id] = [];
        }
      }));
      setSubscriptions(subData);
    } catch (err) {
      console.error(err);
    }
    setLoadingSettings(false);
  };

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
      console.error(err);
      setSubscriptions(prev => ({ ...prev, [empId]: empSubs }));
    }
  };

  const handleUseTemplate = (template) => {
    setComposingMsg({
      employeeId: '',
      subject: template.subject,
      body: template.body
    });
    setIsComposing(true);
  };



  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[11.5px] text-slate-400 font-semibold no-print mb-3">
        {['ACCOUNTELLENCE', 'Admin', 'Email Center'].map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight size={11} className="text-slate-350" />}
            <span className={idx === 2 ? 'text-slate-650 font-bold' : ''}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </nav>

      {/* Top Header Banner */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Mail size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Enterprise Email Hub</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Communications</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5 font-sans">
              Manage communications, monitor background SMTP queues, and configure alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 md:mt-0">
          <button
            onClick={() => setIsComposing(true)}
            className="px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5 text-xs uppercase tracking-wider border-none outline-none"
          >
            <Send size={13} /> Compose Message
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { id: 'communications', label: 'Communications', icon: MessageSquareIcon },
          { id: 'templates', label: 'Templates', icon: CheckSquare },
          { id: 'settings', label: 'Settings & Config', icon: Sliders }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle size={14} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <ShieldAlert size={14} /> {error}
        </div>
      )}

      <style>{`
        .chats-scrollbar::-webkit-scrollbar {
          width: 5px !important;
        }
        .chats-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc !important;
          border-radius: 99px !important;
        }
        .chats-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3) !important;
          border-radius: 99px !important;
        }
        .chats-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5) !important;
        }
        .chats-scrollbar {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(16, 185, 129, 0.3) #f8fafc !important;
        }
      `}</style>

      {/* Communications Tab */}
      {activeTab === 'communications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[550px] items-stretch">
          {/* Conversation List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Employee Chats</h3>
              <button
                onClick={fetchConvs}
                className="p-1 border border-slate-200 hover:bg-slate-50 rounded text-slate-500 cursor-pointer"
              >
                <RefreshCw size={12} className={loadingConvs ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 chats-scrollbar">
              {loadingConvs ? (
                <div className="p-8 text-center text-slate-400 font-semibold flex flex-col gap-2 items-center">
                  <RefreshCw size={20} className="animate-spin text-emerald-600" />
                  <span>Loading conversations...</span>
                </div>
              ) : convs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium italic">No conversations found. Use "Compose Message" to start one.</div>
              ) : (
                convs.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadThread(conv.id)}
                    className={`w-full p-4 text-left transition hover:bg-slate-50/50 flex flex-col gap-1 cursor-pointer ${
                      activeThread?.conversation.id === conv.id ? 'bg-slate-50 border-r-2 border-emerald-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-extrabold text-[12.5px] text-slate-900 truncate max-w-[150px]">
                        {conv.employee_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                        {new Date(conv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 truncate max-w-[240px]">
                      {conv.subject}
                    </p>
                    <p className="text-[10.5px] text-slate-500 truncate max-w-[240px]">
                      {conv.lastMessageBody || conv.body}
                    </p>
                    <div className="flex items-center justify-between w-full mt-1.5">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400">
                        {conv.department || 'General'}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          {conv.unreadCount} New
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs flex flex-col h-full">
            {activeThread ? (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-[13.5px] text-slate-900">
                      Conversation with {activeThread.conversation.employee_name}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wide">
                      Subject: {activeThread.conversation.subject}
                    </p>
                  </div>
                </div>

                {/* Thread Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 chats-scrollbar">
                  {/* Initial Message */}
                  <div className={`flex gap-3 max-w-[85%] ${activeThread.conversation.sender_type !== 'ADMIN' ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${
                      activeThread.conversation.sender_type === 'ADMIN' ? 'bg-slate-350 text-slate-700' : 'bg-emerald-600'
                    }`}>
                      {activeThread.conversation.sender_type === 'ADMIN' ? <Shield size={14} /> : <User size={14} />}
                    </div>
                    <div className={`rounded-2xl p-4 shadow-3xs text-xs font-semibold leading-normal ${
                      activeThread.conversation.sender_type === 'ADMIN'
                        ? 'bg-white border border-slate-200 text-slate-800'
                        : 'bg-emerald-650 text-white'
                    }`}>
                      <p className="whitespace-pre-line">{activeThread.conversation.body}</p>
                      <span className={`block text-[9.5px] font-bold mt-2 uppercase tracking-wide ${
                        activeThread.conversation.sender_type === 'ADMIN' ? 'text-slate-400' : 'text-emerald-200'
                      }`}>
                        {activeThread.conversation.sender_type === 'ADMIN' ? 'HR Admin' : 'Employee'} • {new Date(activeThread.conversation.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Replies */}
                  {activeThread.replies.map((reply) => {
                    const isAdmin = reply.sender_type === 'ADMIN';
                    return (
                      <div
                        key={reply.id}
                        className={`flex gap-3 max-w-[85%] ${isAdmin ? '' : 'ml-auto flex-row-reverse'}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${
                          isAdmin ? 'bg-slate-350 text-slate-700' : 'bg-emerald-600'
                        }`}>
                          {isAdmin ? <Shield size={14} /> : <User size={14} />}
                        </div>
                        <div className={`rounded-2xl p-4 shadow-3xs text-xs font-semibold leading-normal ${
                          isAdmin
                            ? 'bg-white border border-slate-200 text-slate-800'
                            : 'bg-emerald-650 text-white'
                        }`}>
                          <p className="whitespace-pre-line">{reply.body}</p>
                          <span className={`block text-[9.5px] font-bold mt-2 uppercase tracking-wide ${
                            isAdmin ? 'text-slate-400' : 'text-emerald-200'
                          }`}>
                            {isAdmin ? 'HR Admin' : 'Employee'} • {new Date(reply.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply Composer */}
                <form onSubmit={handleSendReply} className="p-3 border-t border-slate-100 bg-white flex items-end gap-3">
                  <textarea
                    required
                    rows={2}
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    placeholder="Write your reply to employee..."
                    className="flex-1 p-2.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-emerald-500 resize-none h-16 leading-normal"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyBody.trim()}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-bold transition shrink-0"
                  >
                    {sendingReply ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                    Send Reply
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Info size={48} className="text-slate-300 stroke-1 mb-3" />
                <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">No Chat Selected</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Select an employee chat from the list to view history and post replies.
                </p>
              </div>
            )}
          </div>
        </div>
      )}



      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tmpl) => (
            <div key={tmpl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col justify-between gap-4">
              <div>
                <span className="inline-flex px-2 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-500 border border-slate-200 mb-2 uppercase">
                  HR Template
                </span>
                <h4 className="font-extrabold text-[13.5px] text-slate-900">{tmpl.name}</h4>
                <p className="text-[11px] font-bold text-slate-500 mt-1">Subject: {tmpl.subject}</p>
                <p className="text-[11px] text-slate-400 mt-2 line-clamp-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[10.5px]">
                  {tmpl.body}
                </p>
              </div>
              <button
                onClick={() => handleUseTemplate(tmpl)}
                className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Settings & Config Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs max-w-4xl">
          <div>
            <h3 className="text-[13.5px] font-black text-slate-900 border-b border-slate-100 pb-2">Outbound Preferences</h3>
            <p className="text-[11px] text-slate-400 mt-1">Toggle checkboxes to subscribe or unsubscribe employees from automated system emails.</p>
          </div>

          <div className="divide-y divide-slate-100 space-y-4 pt-2">
            {loadingSettings ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw size={18} className="animate-spin text-emerald-600 mx-auto" />
              </div>
            ) : employees.length === 0 ? (
              <p className="italic text-slate-400 text-xs">No employees found.</p>
            ) : (
              employees.map(emp => {
                const subList = subscriptions[emp.id] || [];
                const getEmailChecked = (eventCode) => {
                  const sub = subList.find(s => s.eventCode === eventCode);
                  return sub ? !!sub.channels?.EMAIL : false;
                };

                return (
                  <div key={emp.id} className="pt-3 first:pt-0 space-y-2">
                    <div>
                      <span className="font-extrabold text-[12px] text-slate-800 block">{emp.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{emp.user_email || emp.email || 'No email registered'}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] font-semibold text-slate-600">
                      {[
                        { code: 'LOW_STOCK_ALERT', label: 'Inventory Alerts' },
                        { code: 'JOURNAL_POSTED', label: 'Finance & Journals' },
                        { code: 'BUDGET_EXCEEDED', label: 'Budget Alerts' },
                        { code: 'PAYROLL_POSTED', label: 'Payroll runs' }
                      ].map(col => (
                        <label key={col.code} className="flex items-center gap-2 cursor-pointer hover:text-slate-800">
                          <input
                            type="checkbox"
                            checked={getEmailChecked(col.code)}
                            disabled={!(emp.user_email || emp.email)}
                            onChange={e => handleToggleSubscription(emp.id, col.code, e.target.checked)}
                            className="w-3.5 h-3.5 border-slate-300 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Compose Drawer */}
      <RightDrawer
        isOpen={isComposing}
        onClose={() => {
          setIsComposing(false);
          setComposingMsg({ employeeId: '', subject: '', body: '' });
        }}
        title="Compose Message"
        subtitle="Write a manual text communication and dispatch it directly to employee."
      >
        <form onSubmit={handleSendCompose} className="space-y-4 font-semibold text-xs text-slate-600 pr-1">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Recipient Employee *</label>
            <select
              required
              className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-semibold cursor-pointer text-xs"
              value={composingMsg.employeeId}
              onChange={e => setComposingMsg({...composingMsg, employeeId: e.target.value})}
            >
              <option value="">— Select Recipient —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.user_email || emp.email || 'Internal Chat'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Subject *</label>
            <input
              required
              className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-semibold text-xs"
              value={composingMsg.subject}
              onChange={e => setComposingMsg({...composingMsg, subject: e.target.value})}
              placeholder="e.g. Annual Performance Evaluation Notice"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Message Body *</label>
            <textarea
              required
              rows={12}
              className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-semibold text-xs leading-normal"
              value={composingMsg.body}
              onChange={e => setComposingMsg({...composingMsg, body: e.target.value})}
              placeholder="Write your message here..."
            />
          </div>

          <button
            type="submit"
            disabled={sendingCompose}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold rounded-lg text-xs cursor-pointer shadow-sm transition-colors mt-2"
          >
            {sendingCompose ? 'Queueing Message...' : 'Disptach Message'}
          </button>
        </form>
      </RightDrawer>

    </div>
  );
}
