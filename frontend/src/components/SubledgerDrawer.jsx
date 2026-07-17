import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, FileText, DollarSign, Check, Info, ShieldAlert, Award, TrendingUp, User, Phone, Mail, Edit3, Save, Printer, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function SubledgerDrawer({ isOpen, onClose, partnerId, partnerType, companyId, virtualCode, partnerName, onSaveSuccess }) {
  const [activeTab, setActiveTab] = useState('statement'); // 'statement' or 'card'
  const [statementData, setStatementData] = useState(null);
  const [agingData, setAgingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', credit_limit: '0' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch statement & aging
  useEffect(() => {
    if (!isOpen || !partnerId) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const type = partnerType === 'CUSTOMER' ? 'customer' : 'supplier';
        
        // 1. Get Statement
        const statementRes = await api.get(`/subledger/statement/${type}/${partnerId}`);
        setStatementData(statementRes.data);

        // 2. Get Aging
        const agingRes = await api.get(`/subledger/aging/${type}/${partnerId}`);
        setAgingData(agingRes.data);

        // 3. Populate form fields
        setForm({
          name: partnerName,
          email: statementRes.data.email || statementRes.data.statement?.[0]?.email || '',
          phone: statementRes.data.phone || statementRes.data.statement?.[0]?.phone || '',
          address: statementRes.data.address || '',
          credit_limit: String(statementRes.data.credit_limit || '0')
        });
      } catch (err) {
        console.error('Failed to load subledger details:', err);
        setError('Failed to load subledger ledger statement.');
      }
      setIsLoading(false);
    };

    fetchData();
  }, [isOpen, partnerId, partnerType, partnerName]);

  const handleSaveCard = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (partnerType === 'CUSTOMER') {
        await api.put(`/clients/${companyId}/${partnerId}`, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          credit_limit: parseFloat(form.credit_limit || 0)
        });
      } else {
        await api.put(`/vendors/${companyId}/${partnerId}`, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address
        });
      }
      setSuccess('Business partner details saved successfully!');
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update partner details.');
    }
    setSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const currentBalance = statementData?.currentBalance || 0;
  const creditLimit = parseFloat(form.credit_limit || 0);
  const availableCredit = creditLimit - currentBalance;

  // Credit Status Indicator logic
  let creditStatus = { label: 'Active', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' };
  if (partnerType === 'CUSTOMER' && creditLimit > 0) {
    const ratio = currentBalance / creditLimit;
    if (ratio > 1.0) {
      creditStatus = { label: 'Credit Hold', bg: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' };
    } else if (ratio >= 0.8) {
      creditStatus = { label: 'Near Limit', bg: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' };
    } else {
      creditStatus = { label: 'Within Limit', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' };
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end no-print">
        {/* Backdrop overlay */}
        <Motion.div 
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Drawer Box */}
        <Motion.div 
          className="relative w-full max-w-2xl h-full bg-slate-50 shadow-2xl border-l border-slate-200 flex flex-col z-10"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border bg-slate-100 text-slate-500">
                  Sub-Ledger
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${creditStatus.bg} flex items-center gap-1.5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${creditStatus.dot}`} />
                  {creditStatus.label}
                </span>
              </div>
              <h2 className="font-display font-extrabold text-[17px] text-slate-900 mt-1 flex items-center gap-2">
                <span className="text-slate-400 font-mono text-[15px]">{virtualCode}</span>
                <span>{partnerName}</span>
              </h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 bg-white border-b border-slate-100 flex gap-4 flex-shrink-0">
            <button 
              onClick={() => setActiveTab('statement')} 
              className={`py-3 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'statement' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Statement & Ledger
            </button>
            <button 
              onClick={() => setActiveTab('card')} 
              className={`py-3 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'card' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Partner Card (Edit Details)
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-indigo-600 border-r-indigo-600 animate-spin" />
                <span className="text-[12px] text-slate-400 font-semibold">Loading statements...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-[13px] text-red-700 font-medium">{error}</p>
              </div>
            ) : activeTab === 'statement' ? (
              <>
                {/* Financial KPI Summary */}
                <div className="grid grid-cols-3 gap-3.5">
                  <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Outstanding Balance</span>
                    <p className="font-mono font-extrabold text-[15.5px] text-slate-900 leading-tight">
                      PKR {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  {partnerType === 'CUSTOMER' ? (
                    <>
                      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Credit Limit</span>
                        <p className="font-mono font-extrabold text-[15.5px] text-slate-900 leading-tight">
                          PKR {creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Available Credit</span>
                        <p className={`font-mono font-extrabold text-[15.5px] leading-tight ${availableCredit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          PKR {availableCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm col-span-2 space-y-1">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Statements Count</span>
                        <p className="font-mono font-extrabold text-[15.5px] text-slate-900 leading-tight">
                          {statementData?.statement?.length || 0} Transactions
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Aging Analysis Bar Chart */}
                {agingData && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-[11.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-indigo-500" /> Aging Analysis
                    </h3>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {[
                        { label: 'Current', value: agingData.current },
                        { label: '1-30 Days', value: agingData.days_30 },
                        { label: '31-60 Days', value: agingData.days_60 },
                        { label: '61-90 Days', value: agingData.days_90 },
                        { label: '90+ Days', value: agingData.days_over_90 }
                      ].map((b, i) => (
                        <div key={i} className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">{b.label}</span>
                          <span className="text-[11px] font-mono font-extrabold text-slate-700 block">
                            PKR {parseFloat(b.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Statement Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[11.5px] font-black uppercase text-slate-800 tracking-wider">Statement Ledger Lines</h3>
                    <button 
                      onClick={handlePrint}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                      title="Print Statement"
                    >
                      <Printer size={15} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[9.5px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-5 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Doc Ref</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5 text-right">Debit</th>
                          <th className="px-4 py-2.5 text-right">Credit</th>
                          <th className="px-5 py-2.5 text-right">Running Bal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[12px] font-medium text-slate-700">
                        {statementData?.statement?.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-slate-450 font-semibold">
                              No statement entries found.
                            </td>
                          </tr>
                        ) : (
                          statementData?.statement?.map((tx, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-5 py-3 text-slate-500 font-mono">
                                {new Date(tx.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <Link 
                                  to={`/dashboard/vouchers/details/${tx.id}`}
                                  className="text-indigo-600 hover:text-indigo-800 font-mono font-bold hover:underline inline-flex items-center gap-0.5"
                                >
                                  {tx.reference}
                                  <ArrowRight size={10} className="opacity-0 group-hover:opacity-100" />
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-semibold text-[10.5px]">
                                <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold ${
                                  tx.type === 'SALES' || tx.type === 'PURCHASE' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                {tx.debit > 0 ? tx.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                {tx.credit > 0 ? tx.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                              </td>
                              <td className="px-5 py-3 text-right font-mono font-black text-slate-900">
                                PKR {tx.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              /* Master Card (Edit Details) Tab */
              <form onSubmit={handleSaveCard} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                <h3 className="text-[11.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <Edit3 size={13} className="text-indigo-500" /> Business Partner Master Card
                </h3>

                {success && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-[13px] font-bold flex items-center gap-2">
                    <Check size={15} /> {success}
                  </div>
                )}

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-[13px] font-bold">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Partner Name *</label>
                    <div className="relative">
                      <User size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        required 
                        className="input-enterprise !pl-10" 
                        value={form.name} 
                        onChange={e => setForm({ ...form, name: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="email" 
                          className="input-enterprise !pl-10" 
                          value={form.email} 
                          onChange={e => setForm({ ...form, email: e.target.value })} 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Contact Phone</label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          className="input-enterprise !pl-10" 
                          value={form.phone} 
                          onChange={e => setForm({ ...form, phone: e.target.value })} 
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Billing / Shipping Address</label>
                    <textarea 
                      className="input-enterprise py-2.5 h-20 resize-none" 
                      value={form.address} 
                      onChange={e => setForm({ ...form, address: e.target.value })} 
                    />
                  </div>

                  {partnerType === 'CUSTOMER' && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Approved Credit Limit (PKR)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          className="input-enterprise !pl-10 font-mono font-semibold" 
                          value={form.credit_limit} 
                          onChange={e => setForm({ ...form, credit_limit: e.target.value })} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="btn btn-primary flex items-center gap-1.5 text-[12.5px] cursor-pointer"
                  >
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Card Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  );
}
