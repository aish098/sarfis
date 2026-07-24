import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Laptop, Smartphone, ShieldCheck, LogOut, Loader2, Globe } from 'lucide-react';

export default function ActiveSessionsCard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me/sessions');
      setSessions(res.data || []);
    } catch (err) {
      console.error('Failed to fetch user active sessions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId) => {
    try {
      setActionLoading(true);
      await api.delete(`/auth/me/sessions/${sessionId}`);
      await fetchSessions();
    } catch (err) {
      alert('Failed to revoke session: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Are you sure you want to sign out from all other active devices?')) return;
    try {
      setActionLoading(true);
      await api.delete('/auth/me/sessions');
      await fetchSessions();
    } catch (err) {
      alert('Failed to revoke all sessions: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            Active Devices & Sessions
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage your logged-in devices, audit active locations, and trigger remote session revocations.
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAllSessions}
            disabled={actionLoading}
            className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer disabled:opacity-50"
          >
            <LogOut size={14} />
            <span>Sign Out All Other Devices</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
          <span>Loading active sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">No active secondary sessions found.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, idx) => {
            const isMobile = s.user_agent?.toLowerCase().includes('mobile');
            const Icon = isMobile ? Smartphone : Laptop;
            return (
              <div
                key={s.id || idx}
                className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {s.browser || 'Browser'} on {s.os || 'Desktop'}
                      </span>
                      {idx === 0 && (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Globe size={11} /> {s.ip_address || '127.0.0.1'}
                      </span>
                      <span>• Method: {s.authentication_method || 'GOOGLE'}</span>
                      <span>• Active: {new Date(s.last_activity || s.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {idx !== 0 && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    disabled={actionLoading}
                    className="text-rose-600 hover:text-rose-700 text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer border-none shadow-3xs"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
