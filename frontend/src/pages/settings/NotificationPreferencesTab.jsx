import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, CheckCircle, Bell, Mail, ShieldAlert, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function NotificationPreferencesTab() {
  const { activeCompany } = useAuthStore();
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/notifications/preferences/${activeCompany.id}`);
      setPreferences(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = (eventId, channel) => {
    setPreferences(prev =>
      prev.map(p => (p.eventId === eventId ? { ...p, [channel]: !p[channel] } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    setError(null);
    try {
      await api.put(`/notifications/preferences/${activeCompany.id}`, { preferences });
      setSuccessMsg('Preferences saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setSaving(false);
  };

  // Group preferences by module
  const grouped = preferences.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-display font-black text-slate-800 text-[14px] uppercase tracking-tight">Notification Channels & Communication Matrix</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Customize how you receive alerts and reports across the ERP.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-5 py-2 text-[12px] font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          <span>Save Changes</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-center gap-2 font-bold animate-fade-in">
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

      {loading ? (
        <div className="p-16 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-400">Loading communication preferences...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([module, items]) => (
            <div key={module} className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
              <h4 className="font-black text-indigo-600 uppercase text-[11px] tracking-wider border-b border-slate-50 pb-2">{module} System Alerts</h4>
              <div className="divide-y divide-slate-50">
                {items.map(item => (
                  <div key={item.eventId} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="max-w-md">
                      <span className="font-extrabold text-slate-800 block text-[12px]">{item.eventName}</span>
                      <span className="text-slate-400 font-medium block mt-0.5 text-[10.5px]">{item.description || 'No description available.'}</span>
                    </div>

                    <div className="flex items-center gap-5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.app}
                          onChange={() => handleToggle(item.eventId, 'app')}
                          className="w-4 h-4 rounded text-indigo-600 border-slate-200 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          <Bell size={13} /> In-App
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.email}
                          onChange={() => handleToggle(item.eventId, 'email')}
                          className="w-4 h-4 rounded text-indigo-600 border-slate-200 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          <Mail size={13} /> Email
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
