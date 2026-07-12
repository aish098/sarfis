import React, { useState, useEffect, useRef } from 'react';
import { Mail, Send, RefreshCw, User, MessageSquare, Shield } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function EmployeeMessagesPage() {
  const { activeCompany } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const threadEndRef = useRef(null);

  const fetchConversations = async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await api.get(`/communications/employee/${activeCompany.id}`);
      setConversations(res.data || []);
    } catch (err) {
      console.error('Failed to fetch communications', err);
    }
    setLoadingList(false);
  };

  useEffect(() => {
    setLoadingList(true);
    fetchConversations();
  }, [activeCompany?.id]);

  const loadThread = async (parentId) => {
    if (!activeCompany?.id) return;
    setLoadingThread(true);
    try {
      const res = await api.get(`/communications/employee/${activeCompany.id}/thread/${parentId}`);
      setActiveThread(res.data);
      // Mark read locally
      setConversations(prev => prev.map(c => c.id === parentId ? { ...c, unreadCount: 0 } : c));
    } catch (err) {
      console.error('Failed to load conversation thread', err);
    }
    setLoadingThread(false);
  };

  useEffect(() => {
    if (activeThread) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !activeThread || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      const parentId = activeThread.conversation.id;
      const res = await api.post(`/communications/employee/${activeCompany.id}/reply`, {
        parentId,
        body: replyBody
      });
      // Append to local thread state
      setActiveThread(prev => ({
        ...prev,
        replies: [...prev.replies, res.data]
      }));
      setReplyBody('');
      fetchConversations();
    } catch (err) {
      console.error('Failed to submit reply', err);
    }
    setSendingReply(false);
  };

  return (
    <div className="p-5 lg:p-7 space-y-6 pb-16 min-h-full" style={{ background: '#faf9f8' }}>
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-[20px] font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Mail size={22} className="text-emerald-500" /> Communications & Messages
        </h2>
        <p className="text-[12px] text-slate-500 font-semibold mt-1">Receive official company communications and reply directly to HR.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] items-stretch">
        {/* Left Panel: Conversation List */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs flex flex-col h-full">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Inbox</h3>
            <button
              onClick={() => { setLoadingList(true); fetchConversations(); }}
              className="p-1 border border-slate-200 hover:bg-slate-50 rounded text-slate-500 cursor-pointer"
            >
              <RefreshCw size={12} className={loadingList ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-8 text-center text-slate-400 font-semibold flex flex-col gap-2 items-center">
                <RefreshCw size={20} className="animate-spin text-emerald-600" />
                <span>Loading messages...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium italic">Your inbox is empty.</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadThread(conv.id)}
                  className={`w-full p-4 text-left transition hover:bg-slate-50/50 flex flex-col gap-1 cursor-pointer ${
                    activeThread?.conversation.id === conv.id ? 'bg-slate-50 border-r-2 border-emerald-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-[12.5px] text-slate-900 truncate max-w-[150px]">
                      {conv.subject}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                      {new Date(conv.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate max-w-[240px] font-semibold">
                    {conv.lastMessageBody || conv.body}
                  </p>
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 inline-flex items-center gap-1">
                      <Shield size={10} /> HR Admin
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

        {/* Right Panel: Conversation Thread */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs flex flex-col h-full">
          {activeThread ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-black text-[13.5px] text-slate-900">{activeThread.conversation.subject}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wide">
                    Reference: MSG-{(activeThread.conversation.id + 10000)} • Status: {activeThread.conversation.status}
                  </p>
                </div>
              </div>

              {/* Thread Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
                {/* Initial HR Message */}
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500">
                    <Shield size={14} />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs text-xs font-semibold text-slate-800 leading-normal">
                    <p className="whitespace-pre-line">{activeThread.conversation.body}</p>
                    <span className="block text-[9.5px] text-slate-400 font-bold mt-2 uppercase tracking-wide">
                      HR Admin • {new Date(activeThread.conversation.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Replies */}
                {activeThread.replies.map((reply) => {
                  const isAdmin = reply.sender_type === 'ADMIN';
                  return (
                    <div
                      key={reply.id}
                      className={`flex gap-3 max-w-[85%] ${!isAdmin ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${
                        isAdmin ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600'
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
                          {isAdmin ? 'HR Admin' : 'You'} • {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {/* Thread Editor */}
              <form onSubmit={handleSendReply} className="p-3 border-t border-slate-100 bg-white flex items-end gap-3">
                <textarea
                  required
                  rows={2}
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Write your reply message here..."
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
              <MessageSquare size={48} className="text-slate-350 stroke-1 mb-3" />
              <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">No Message Selected</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Select an inbox item from the left panel to display the conversation thread and respond to HR.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}