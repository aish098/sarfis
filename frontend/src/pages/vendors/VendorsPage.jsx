import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, X, AlertCircle, Edit2, Phone, Mail, MapPin, Building2 } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const cardAnim = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }
};

export default function VendorsPage() {
  const { activeCompany } = useAuthStore();
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', isActive: true });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/vendors/${activeCompany.id}`);
      setVendors(res.data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const filtered = vendors.filter(v => {
    const q = searchQuery.toLowerCase();
    return v.name.toLowerCase().includes(q) || 
           (v.email && v.email.toLowerCase().includes(q)) ||
           (v.phone && v.phone.toLowerCase().includes(q));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Supplier Name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/vendors/${activeCompany.id}/${editingId}`, form);
      } else {
        await api.post(`/vendors/${activeCompany.id}`, form);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm({ name: '', email: '', phone: '', address: '', isActive: true });
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save vendor');
    }
    setSaving(false);
  };

  const handleEdit = (vendor) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      isActive: vendor.is_active !== undefined ? vendor.is_active : true
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier? All current accounts payable history will be preserved.')) return;
    try {
      await api.delete(`/vendors/${activeCompany.id}/${id}`);
      load();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="p-6 lg:p-8 pb-16 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900 leading-tight">Supplier Directory</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage your corporate accounts payable suppliers, terms and procurement settings.
          </p>
        </div>
        <Motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setModalOpen(true)}
          className="btn btn-primary">
          <Plus size={16} /> Add Supplier
        </Motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Suppliers</p>
          <p className="font-display font-black text-2xl text-slate-800 mt-1.5">{isLoading ? '...' : vendors.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Accounts Payable (AP)</p>
          <p className="font-display font-black text-2xl text-slate-800 mt-1.5">
            {isLoading ? '...' : '$' + vendors.reduce((s, v) => s + parseFloat(v.current_balance || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Active Procurement</p>
          <p className="font-display font-black text-2xl text-emerald-600 mt-1.5">
            {isLoading ? '...' : vendors.filter(v => v.is_active).length} Suppliers
          </p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-enterprise text-[13px]"
            style={{ paddingLeft: '44px' }}
            placeholder="Search suppliers by name, phone or email..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Supplier Grid */}
      <Motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-slate-100 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-3.5 w-full bg-slate-50 rounded" />
              <div className="h-3.5 w-1/2 bg-slate-50 rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-400 shadow-sm">
            <Building2 size={36} className="mx-auto mb-2 text-slate-200" />
            <p className="text-[13px] font-bold">No suppliers found in this company.</p>
          </div>
        ) : (
          filtered.map(vendor => (
            <Motion.div key={vendor.id} variants={cardAnim} whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
              className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-500">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-extrabold text-[15px] text-slate-800 leading-tight truncate">{vendor.name}</h3>
                      <span className={`inline-block text-[10px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full ${vendor.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(vendor)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(vendor.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2.5 py-1 border-t border-b border-slate-50 my-4 text-[12.5px] text-slate-500 font-medium">
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-slate-400 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{vendor.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Balances */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Total Owed (AP)</span>
                <span className="font-mono font-extrabold text-[14px] text-slate-800">
                  ${parseFloat(vendor.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </Motion.div>
          ))
        )}
      </Motion.div>

      {/* Supplier Modal */}
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
                  {editingId ? 'Edit Supplier' : 'New Supplier'}
                </h2>
                <button onClick={() => { setModalOpen(false); setEditingId(null); setForm({ name: '', email: '', phone: '', address: '', isActive: true }); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Supplier Name</label>
                  <input className="input-enterprise" placeholder="e.g. Acme Corp Inc." required
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                  <input type="email" className="input-enterprise" placeholder="supplier@company.com"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phone Number</label>
                  <input className="input-enterprise" placeholder="e.g. +1 555-0199"
                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Mailing Address</label>
                  <textarea className="input-enterprise h-20 py-2.5 resize-none" placeholder="Enter physical street address..."
                    value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="hidden" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-[13px] font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Is Active for Procurement?</span>
                  </label>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <Motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit"
                    disabled={saving} className="btn btn-primary flex-[2]">
                    {saving ? 'Saving...' : 'Save Supplier'}
                  </Motion.button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
