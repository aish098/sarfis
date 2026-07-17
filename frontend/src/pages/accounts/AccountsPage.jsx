import React, { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Trash2, X, AlertCircle, Edit2, ChevronDown, Database, CheckCircle2, AlertTriangle, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import SubledgerDrawer from '../../components/SubledgerDrawer';

const TYPE_BADGES = {
  Asset: 'badge-asset', Liability: 'badge-liability', Equity: 'badge-equity',
  Revenue: 'badge-revenue', Income: 'badge-revenue', Expense: 'badge-expense',
};

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const row = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export default function AccountsPage({ globalSearch = "" }) {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const search = globalSearch || localSearch;
  const [filterType, setFilterType] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', category: 'Asset', normal_balance: 'Debit', is_contra: false });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Subledger state
  const [expandedControlAccounts, setExpandedControlAccounts] = useState({});
  const [subledgerData, setSubledgerData] = useState({});
  const [subledgerLoading, setSubledgerLoading] = useState({});
  const [subledgerSearch, setSubledgerSearch] = useState({});
  const [subledgerSorting, setSubledgerSorting] = useState({});
  const [selectedSubledgerPartner, setSelectedSubledgerPartner] = useState(null);

  const handleToggleExpand = async (acc) => {
    const code = acc.code;
    const isExpanded = !!expandedControlAccounts[code];
    setExpandedControlAccounts(prev => ({ ...prev, [code]: !isExpanded }));

    if (!isExpanded && !subledgerData[code]) {
      setSubledgerLoading(prev => ({ ...prev, [code]: true }));
      try {
        const isAR = acc.is_control && acc.name.toLowerCase().includes('receivable');
        const endpoint = isAR ? '/subledger/receivables' : '/subledger/payables';
        const res = await api.get(endpoint);
        setSubledgerData(prev => ({ ...prev, [code]: res.data }));
      } catch (err) {
        console.error('Failed to load subledger:', err);
      }
      setSubledgerLoading(prev => ({ ...prev, [code]: false }));
    }
  };

  const getSortedSubledger = (code) => {
    const list = subledgerData[code] || [];
    const searchVal = (subledgerSearch[code] || '').toLowerCase();
    const sortBy = subledgerSorting[code] || 'Alpha';

    const filteredList = list.filter(item => 
      item.name.toLowerCase().includes(searchVal) || 
      item.code.toLowerCase().includes(searchVal)
    );

    if (sortBy === 'Alpha') {
      return [...filteredList].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'BalanceHigh') {
      return [...filteredList].sort((a, b) => b.balance - a.balance);
    } else if (sortBy === 'BalanceLow') {
      return [...filteredList].sort((a, b) => a.balance - b.balance);
    }
    return filteredList;
  };

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/accounts/company/${activeCompany.id}`);
      setAccounts(res.data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Find account"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
    const matchType = filterType === 'All' || a.category === filterType || (filterType === 'Revenue' && a.category === 'Income');
    return matchSearch && matchType;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const prefix = form.code[0];
    const valid = { '1': ['Asset'], '2': ['Liability'], '3': ['Equity'], '4': ['Revenue', 'Income'], '5': ['Expense'] };
    if (!valid[prefix]?.includes(form.category)) {
      setFormError(`Code prefix '${prefix}' doesn't match category '${form.category}'`);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/accounts/${editingId}`, form);
      } else {
        await api.post('/accounts', { ...form, company_id: activeCompany.id });
      }
      setModalOpen(false);
      setEditingId(null);
      setForm({ code: '', name: '', category: 'Asset', normal_balance: 'Debit', is_contra: false });
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save account');
    }
    setSaving(false);
  };

  const handleEdit = (acc) => {
    setEditingId(acc.id);
    setForm({ code: acc.code, name: acc.name, category: acc.category || acc.type, normal_balance: acc.normal_balance || 'Debit', is_contra: acc.is_contra || false });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account?')) return;
    try { await api.delete(`/accounts/${id}`); load(); } catch (err) { console.error('Delete failed:', err); }
  };

  const countTotal = accounts.length;
  const countActive = accounts.filter(a => a.is_active !== false).length;
  const countInactive = accounts.filter(a => a.is_active === false).length;
  const countAssets = accounts.filter(a => a.category === 'Asset').length;
  const countLiabilities = accounts.filter(a => a.category === 'Liability').length;

  const kpisList = [
    { label: 'Total Accounts', value: countTotal, icon: Database, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650' },
    { label: 'Active', value: countActive, icon: CheckCircle2, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' },
    { label: 'Inactive', value: countInactive, icon: AlertTriangle, iconBgClass: 'bg-slate-50', iconColorClass: 'text-slate-400' },
    { label: 'Assets', value: countAssets, icon: Database, iconBgClass: 'bg-indigo-50', iconColorClass: 'text-indigo-655' },
    { label: 'Liabilities', value: countLiabilities, icon: Database, iconBgClass: 'bg-rose-50', iconColorClass: 'text-rose-600' }
  ];

  return (
    <>
      <WorkspaceLayout
        title="Chart of Accounts"
        subtitle={`Manage and organize your financial structure for ${activeCompany?.name || 'your company'}`}
        icon={Database}
        badgeText="Master Data"
        breadcrumbs={['ACCOUNTELLENCE', 'Finance', 'Chart of Accounts']}
        primaryAction={
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/dashboard/accounts/opening-balances')}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 px-4.5 py-2 text-[12.5px] font-bold rounded-xl transition cursor-pointer select-none"
            >
              <Sliders size={14} /> Opening Balances
            </button>
            <button 
              onClick={() => setModalOpen(true)} 
              className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none"
            >
              <Plus size={14} /> Add Account
            </button>
          </div>
        }
        searchQuery={search}
        onSearchChange={setLocalSearch}
        searchPlaceholder="Search by name or code..."
        kpis={kpisList}
      >
        {/* Category Filters */}
        <div className="col-span-full mb-3 flex items-center gap-3">
          <div className="relative w-[260px]">
            <select
              style={{ paddingLeft: '38px' }}
              className="input-enterprise pr-10 text-[13px] cursor-pointer appearance-none"
              value={filterType} onChange={e => setFilterType(e.target.value)}
            >
              <option value="All">All Categories</option>
              {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Filter size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table Card */}
        <div className="col-span-full">
          <div className="card overflow-hidden bg-white border border-slate-100 rounded-3xl">
            <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                <th style={{ width: '15%' }} className="!pl-5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Code</th>
                <th style={{ width: '40%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Account Name</th>
                <th style={{ width: '15%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Category</th>
                <th style={{ width: '15%' }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Balance Type</th>
                <th style={{ width: '15%' }} className="!text-left !pr-5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Actions</th>
              </tr>
            </thead>
            <Motion.tbody variants={stagger} initial="initial" animate="animate">
              {isLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="skeleton h-3.5 w-16" /></td>
                    <td><div className="skeleton h-3.5 w-48" /></td>
                    <td><div className="skeleton h-5 w-20 rounded-full" /></td>
                    <td />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-400">
                    <Search size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-[13px]">No accounts found</p>
                  </td>
                </tr>
              ) : (
                filtered.map(acc => {
                  const isAR = acc.is_control && acc.name.toLowerCase().includes('receivable');
                  const isAP = acc.is_control && acc.name.toLowerCase().includes('payable');
                  const isControlAcc = isAR || isAP;
                  const isExpanded = !!expandedControlAccounts[acc.code];

                  return (
                    <React.Fragment key={acc.id}>
                      <Motion.tr variants={row}>
                        <td>
                          <span className="font-mono font-semibold text-[13px] text-slate-600">{acc.code}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {isControlAcc && (
                              <button 
                                type="button"
                                onClick={() => handleToggleExpand(acc)}
                                className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-650 transition-all border-none bg-transparent cursor-pointer"
                              >
                                <ChevronDown 
                                  size={13} 
                                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} 
                                />
                              </button>
                            )}
                            <span className={`font-medium text-[14px] text-slate-800 ${isControlAcc ? 'font-bold' : ''}`}>{acc.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className={`badge ${TYPE_BADGES[acc.category || acc.type] || 'badge-asset'} w-fit`}>
                              {acc.category || acc.type}
                            </span>
                            {acc.is_contra && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contra</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`font-mono text-[12px] font-semibold ${acc.normal_balance === 'Debit' ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {acc.normal_balance}
                          </span>
                        </td>
                        <td className="!text-left">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEdit(acc)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(acc.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </Motion.tr>

                      {/* Expanded Subledger Rows */}
                      {isControlAcc && isExpanded && (
                        <>
                          {/* Search & Sort Panel */}
                          <tr className="bg-slate-50/50">
                            <td />
                            <td colSpan={4} className="py-2 px-5">
                              <div className="flex flex-wrap items-center gap-4">
                                {/* Compact Search box */}
                                <div className="relative w-[180px]">
                                  <Search size={12} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input 
                                    type="text" 
                                    placeholder="Search partners..."
                                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-indigo-500"
                                    value={subledgerSearch[acc.code] || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setSubledgerSearch(prev => ({ ...prev, [acc.code]: val }));
                                    }}
                                  />
                                </div>

                                {/* Compact Sort dropdown */}
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                                  <span>Sort:</span>
                                  <select 
                                    className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                                    value={subledgerSorting[acc.code] || 'Alpha'}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setSubledgerSorting(prev => ({ ...prev, [acc.code]: val }));
                                    }}
                                  >
                                    <option value="Alpha">Alphabetical</option>
                                    <option value="BalanceHigh">Balance (Highest)</option>
                                    <option value="BalanceLow">Balance (Lowest)</option>
                                  </select>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Subledger lines loading state */}
                          {subledgerLoading[acc.code] ? (
                            <tr>
                              <td />
                              <td colSpan={4} className="py-6 text-center text-slate-400">
                                <div className="w-5 h-5 rounded-full border-2 border-transparent border-t-indigo-600 border-r-indigo-600 animate-spin mx-auto mb-1.5" />
                                <span className="text-[11px] font-semibold">Loading sub-accounts...</span>
                              </td>
                            </tr>
                          ) : getSortedSubledger(acc.code).length === 0 ? (
                            <tr>
                              <td />
                              <td colSpan={4} className="py-6 text-center text-slate-400 text-[11.5px] font-semibold">
                                No sub-accounts found matching criteria.
                              </td>
                            </tr>
                          ) : (
                            getSortedSubledger(acc.code).map(sub => {
                              const typeCode = sub.type === 'CUSTOMER' ? `CUS-${String(sub.id).padStart(4, '0')}` : `SUP-${String(sub.id).padStart(4, '0')}`;
                              return (
                                <tr key={`sub-${sub.type}-${sub.id}`} className="bg-slate-50/20 border-l-4 border-indigo-500 hover:bg-slate-50/50">
                                  <td className="!pl-8">
                                    <span className="font-mono text-[11.5px] text-slate-450 font-bold">{sub.code}</span>
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9.5px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border">
                                        {typeCode}
                                      </span>
                                      <span 
                                        onClick={() => setSelectedSubledgerPartner({ ...sub, virtualCode: sub.code, typeCode })}
                                        className="text-[12.5px] font-bold text-slate-700 hover:text-indigo-650 cursor-pointer hover:underline"
                                      >
                                        {sub.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                      {sub.type}
                                    </span>
                                  </td>
                                  <td className="font-mono text-[12px] font-bold text-slate-900">
                                    PKR {sub.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="!text-left">
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        onClick={() => setSelectedSubledgerPartner({ ...sub, virtualCode: sub.code, typeCode })}
                                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 hover:border-indigo-200 text-[10.5px] font-black rounded-lg transition shadow-sm cursor-pointer"
                                      >
                                        Statement
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const route = '/dashboard/vouchers';
                                          navigate(route);
                                        }}
                                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 text-[10.5px] font-bold rounded-lg transition shadow-sm cursor-pointer"
                                      >
                                        {sub.type === 'CUSTOMER' ? '+ Invoice' : '+ Bill'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </Motion.tbody>
          </table>
        </div>

        {!isLoading && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
            <p className="text-[12px] text-slate-400">{filtered.length} accounts</p>
          </div>
        )}
      </div>
      </div>
      </WorkspaceLayout>

      {/* Add Account Modal */}
      <AnimatePresence>
        {modalOpen && (
          <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
            <Motion.div
              className="modal-box w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <h2 className="font-display font-extrabold text-[18px] text-slate-900">
                  {editingId ? 'Edit Account' : 'New Account'}
                </h2>
                <button onClick={() => { setModalOpen(false); setEditingId(null); setForm({ code: '', name: '', category: 'Asset', normal_balance: 'Debit', is_contra: false }); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-7 space-y-5">
                {formError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-100">
                    <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[13px] text-red-600 font-medium">{formError}</p>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Code</label>
                  <input className="input-enterprise font-mono" placeholder="e.g. 1001" required
                    value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Name</label>
                  <input className="input-enterprise" placeholder="e.g. Cash at Bank" required
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category</label>
                  <select className="input-enterprise" value={form.category} onChange={e => {
                    const newCategory = e.target.value;
                    const newStdBalance = ['Asset', 'Expense'].includes(newCategory) ? 'Debit' : 'Credit';
                    setForm({ ...form, category: newCategory, normal_balance: form.is_contra ? (newStdBalance === 'Debit' ? 'Credit' : 'Debit') : newStdBalance });
                  }}>
                    <option value="Asset">Asset (1xxx)</option>
                    <option value="Liability">Liability (2xxx)</option>
                    <option value="Equity">Equity (3xxx)</option>
                    <option value="Revenue">Revenue (4xxx)</option>
                    <option value="Expense">Expense (5xxx)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Normal Balance</label>
                    <select className="input-enterprise" value={form.normal_balance} onChange={e => setForm({ ...form, normal_balance: e.target.value })}>
                      <option value="Debit">Debit</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={form.is_contra} onChange={e => {
                        const isContra = e.target.checked;
                        const stdBalance = ['Asset', 'Expense'].includes(form.category) ? 'Debit' : 'Credit';
                        setForm({ ...form, is_contra: isContra, normal_balance: isContra ? (stdBalance === 'Debit' ? 'Credit' : 'Debit') : stdBalance });
                      }} />
                      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_contra ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_contra ? 'translate-x-4' : 'translate-x-1'}`} />
                      </div>
                      <span className="text-[13px] font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Is Contra Account?</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <Motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit"
                    disabled={saving} className="btn btn-primary flex-[2]">
                    {saving ? 'Saving...' : 'Save Account'}
                  </Motion.button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <SubledgerDrawer 
        isOpen={!!selectedSubledgerPartner}
        onClose={() => setSelectedSubledgerPartner(null)}
        partnerId={selectedSubledgerPartner?.id}
        partnerType={selectedSubledgerPartner?.type}
        companyId={activeCompany?.id}
        virtualCode={selectedSubledgerPartner?.virtualCode}
        partnerName={selectedSubledgerPartner?.name}
        onSaveSuccess={() => {
          const isCustomer = selectedSubledgerPartner?.type === 'CUSTOMER';
          const arAcc = accounts.find(a => a.is_control && a.name.toLowerCase().includes('receivable'));
          const apAcc = accounts.find(a => a.is_control && a.name.toLowerCase().includes('payable'));
          const parentCode = isCustomer ? arAcc?.code : apAcc?.code;

          if (parentCode) {
            setSubledgerData(prev => {
              const next = { ...prev };
              delete next[parentCode];
              return next;
            });
            setExpandedControlAccounts(prev => ({ ...prev, [parentCode]: false }));
          }
          setSelectedSubledgerPartner(null);
        }}
      />
    </>
  );
}
