import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, CheckCircle2, RefreshCw, KeyRound, Sparkles } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function GoogleSubscriptionCard() {
  const { activeCompany } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [googleEmail, setGoogleEmail] = useState('');
  const [planCode, setPlanCode] = useState('ENTERPRISE');
  const [modules, setModules] = useState({
    financials: true,
    inventory: true,
    payroll: true,
    purchasing: true,
    risk_analytics: true,
    executive_reports: true
  });

  const companyId = activeCompany?.id;

  useEffect(() => {
    if (!companyId) return;
    async function fetchSubscriptionData() {
      try {
        setLoading(true);
        const res = await api.get(`/settings/${companyId}/subscription-modules`);
        const { subscription, authSettings, entitlements, googleEmail: email } = res.data;

        if (email && email !== 'Unlinked') {
          setGoogleEmail(email);
        }
        if (subscription?.plan_code) {
          setPlanCode(subscription.plan_code);
        }

        if (Array.isArray(entitlements) && entitlements.length > 0) {
          const modMap = {};
          entitlements.forEach(e => {
            modMap[e.module_code] = !!e.enabled;
          });
          setModules(prev => ({ ...prev, ...modMap }));
        }
      } catch (err) {
        console.error('Failed to load subscription data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubscriptionData();
  }, [companyId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!companyId || saving) return;

    try {
      setSaving(true);
      setMsg(null);
      await api.put(`/settings/${companyId}/subscription-modules`, {
        planCode,
        googleEmail,
        modules
      });
      setMsg({ type: 'success', text: 'Google Account Subscription & Module Entitlements linked successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update subscription settings.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (code) => {
    setModules(prev => ({ ...prev, [code]: !prev[code] }));
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl animate-pulse flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
        <RefreshCw size={14} className="animate-spin text-emerald-500" /> Loading Subscription Entitlements...
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-black text-slate-900">Google Account Subscription & Licensing</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black tracking-wider uppercase border border-emerald-200">
                ACTIVE PLAN: {planCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Link your Google Account (`ayeshakashif098789@gmail.com`) to activate subscription plans and unlock module access.
            </p>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <CheckCircle2 size={16} /> {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Account & Tier Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Billing Owner Google Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={googleEmail}
                onChange={e => setGoogleEmail(e.target.value)}
                placeholder="ayeshakashif098789@gmail.com"
                className="w-full p-3 pl-10 border border-slate-350 rounded-xl text-[13px] bg-slate-50 focus:bg-white outline-none focus:border-emerald-500 font-semibold"
              />
              <KeyRound size={16} className="absolute left-3 top-3.5 text-slate-400" />
            </div>
            <span className="text-[10.5px] text-slate-400 mt-1 block">
              The Google account that holds the active payment subscription.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Subscription Plan Tier
            </label>
            <select
              value={planCode}
              onChange={e => setPlanCode(e.target.value)}
              className="w-full p-3 border border-slate-350 rounded-xl text-[13px] bg-white outline-none focus:border-emerald-500 font-bold"
            >
              <option value="STARTER">STARTER PLAN (Core Accounting)</option>
              <option value="PROFESSIONAL">PROFESSIONAL PLAN (Financials + Inventory + Purchasing)</option>
              <option value="ENTERPRISE">ENTERPRISE PLAN (All Modules Unlocked + Risk & Analytics)</option>
            </select>
            <span className="text-[10.5px] text-slate-400 mt-1 block">
              Tier features are automatically enforced across your team members.
            </span>
          </div>
        </div>

        {/* Subscribed Module Matrix */}
        <div className="space-y-3">
          <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">
            Subscribed ERP Modules (Google Account Entitlements)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            
            <div
              onClick={() => toggleModule('financials')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${modules.financials ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={modules.financials ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Financial Accounting</span>
                  <span className="text-[10px] text-slate-500 block">GL, Vouchers, Ledger</span>
                </div>
              </div>
              <input type="checkbox" checked={!!modules.financials} onChange={() => {}} className="accent-emerald-600" />
            </div>

            <div
              onClick={() => toggleModule('inventory')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${modules.inventory ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={modules.inventory ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Inventory Valuation</span>
                  <span className="text-[10px] text-slate-500 block">FIFO/LIFO/Average Layers</span>
                </div>
              </div>
              <input type="checkbox" checked={!!modules.inventory} onChange={() => {}} className="accent-emerald-600" />
            </div>

            <div
              onClick={() => toggleModule('payroll')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${modules.payroll ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={modules.payroll ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Payroll & HR Management</span>
                  <span className="text-[10px] text-slate-500 block">Payslips & Compensation</span>
                </div>
              </div>
              <input type="checkbox" checked={!!modules.payroll} onChange={() => {}} className="accent-emerald-600" />
            </div>

            <div
              onClick={() => toggleModule('purchasing')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${modules.purchasing ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={modules.purchasing ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Procurement & Orders</span>
                  <span className="text-[10px] text-slate-500 block">PR, PO, GRN Lineage</span>
                </div>
              </div>
              <input type="checkbox" checked={!!modules.purchasing} onChange={() => {}} className="accent-emerald-600" />
            </div>

            <div
              onClick={() => toggleModule('risk_analytics')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${modules.risk_analytics ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={modules.risk_analytics ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Credit Risk Guard</span>
                  <span className="text-[10px] text-slate-500 block">Blacklists & Bad Debts</span>
                </div>
              </div>
              <input type="checkbox" checked={!!modules.risk_analytics} onChange={() => {}} className="accent-emerald-600" />
            </div>

            <div
              onClick={() => toggleModule('executive_reports')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${modules.executive_reports ? 'bg-emerald-50/50 border-emerald-500 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={modules.executive_reports ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Executive Reports</span>
                  <span className="text-[10px] text-slate-500 block">Automated PDF & XLSX</span>
                </div>
              </div>
              <input type="checkbox" checked={!!modules.executive_reports} onChange={() => {}} className="accent-emerald-600" />
            </div>

          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/10 flex items-center gap-2"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
            {saving ? 'Updating Subscription...' : 'Link & Save Google Subscription'}
          </button>
        </div>
      </form>
    </div>
  );
}
