import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Trash2, X, AlertCircle, Edit2, ChevronDown } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const TYPE_BADGES = {
  Asset: 'badge-asset', Liability: 'badge-liability', Equity: 'badge-equity',
  Revenue: 'badge-revenue', Income: 'badge-revenue', Expense: 'badge-expense',
};

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const row = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export default function AccountsPage() {
  const { activeCompany } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'Asset' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/accounts/company/${activeCompany.id}`);
      setAccounts(res.data);
    } catch {}
    setIsLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
    const matchType = filterType === 'All' || a.type === filterType || (filterType === 'Revenue' && a.type === 'Income');
    return matchSearch && matchType;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const prefix = form.code[0];
    const valid = { '1': ['Asset'], '2': ['Liability'], '3': ['Equity'], '4': ['Revenue', 'Income'], '5': ['Expense'] };
    if (!valid[prefix]?.includes(form.type)) {
      setFormError(`Code prefix '${prefix}' doesn't match type '${form.type}'`);
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
      setForm({ code: '', name: '', type: 'Asset' });
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save account');
    }
    setSaving(false);
  };

  const handleEdit = (acc) => {
    setEditingId(acc.id);
    setForm({ code: acc.code, name: acc.name, type: acc.type });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account?')) return;
    try { await api.delete(`/accounts/${id}`); load(); } catch {}
  };

  return (
    <div className="p-6 lg:p-8 pb-16">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900 leading-tight">Chart of Accounts</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage and organize your financial structure for {activeCompany?.name}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setModalOpen(true)}
          className="btn btn-primary">
          <Plus size={16} /> Add Account
        </motion.button>
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-enterprise text-[13px]"
              style={{ paddingLeft: '44px' }}
              placeholder="Search by name or code..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full sm:w-[260px]">
            <select
              className="input-enterprise pr-10 text-[13px] cursor-pointer appearance-none"
              value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ paddingLeft: '44px', paddingTop: '0px', paddingBottom: '0px' }}
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }} className="!pl-5">Code</th>
                <th style={{ width: '40%' }}>Account Name</th>
                <th style={{ width: '25%' }}>Category</th>
                <th style={{ width: '20%' }} className="!text-left !pr-5">Actions</th>
              </tr>
            </thead>
            <motion.tbody variants={stagger} initial="initial" animate="animate">
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
                filtered.map(acc => (
                  <motion.tr key={acc.id} variants={row}>
                    <td>
                      <span className="font-mono font-semibold text-[13px] text-slate-600">{acc.code}</span>
                    </td>
                    <td>
                      <span className="font-medium text-[14px] text-slate-800">{acc.name}</span>
                    </td>
                    <td>
                      <div className="flex items-center">
                        <span className={`badge ${TYPE_BADGES[acc.type] || 'badge-asset'} min-w-[100px] !justify-start`}>
                          {acc.type}
                        </span>
                      </div>
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
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>

        {!isLoading && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
            <p className="text-[12px] text-slate-400">{filtered.length} accounts</p>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
            <motion.div
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
                <button onClick={() => { setModalOpen(false); setEditingId(null); setForm({ code: '', name: '', type: 'Asset' }); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Type</label>
                  <select className="input-enterprise" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="Asset">Asset (1xxx)</option>
                    <option value="Liability">Liability (2xxx)</option>
                    <option value="Equity">Equity (3xxx)</option>
                    <option value="Revenue">Revenue (4xxx)</option>
                    <option value="Expense">Expense (5xxx)</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit"
                    disabled={saving} className="btn btn-primary flex-[2]">
                    {saving ? 'Saving...' : 'Save Account'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
