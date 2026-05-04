import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse, Plus, MapPin, Search, Edit2, Trash2, 
  AlertTriangle, RefreshCw, X, CheckCircle2, Building2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function WarehousePage({ globalSearch = "" }) {
  const { activeCompany, user } = useAuthStore();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Role check: Admin, Inventory Manager, Company Admin or Super Admin can manage
  const canManage = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'Inventory Manager' || user?.role === 'Company Admin';
  const [loadError, setLoadError] = useState(null);
  const [localSearch, setLocalSearch] = useState('');
  const search = globalSearch || localSearch;

  // Modal & Form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', location: '', description: '', is_active: true });

  const load = useCallback(async () => {
    if (!activeCompany) return;
    
    // Defer state updates to avoid synchronous setState in effect warnings
    await Promise.resolve();
    
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/warehouses/${activeCompany.id}`);
      setWarehouses(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    const init = async () => {
      await load();
    };
    init();
  }, [load]);

  const handleOpenModal = (wh = null) => {
    setEditingWh(wh);
    if (wh) {
      setForm({ name: wh.name, location: wh.location || '', description: wh.description || '', is_active: wh.is_active });
    } else {
      setForm({ name: '', location: '', description: '', is_active: true });
    }
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingWh) {
        await api.put(`/warehouses/${activeCompany.id}/${editingWh.id}`, form);
      } else {
        await api.post(`/warehouses/${activeCompany.id}`, form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save warehouse');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this warehouse? This might fail if there is existing stock.')) return;
    try {
      await api.delete(`/warehouses/${activeCompany.id}/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete warehouse');
    }
  };

  const filtered = warehouses.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    (w.location && w.location.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 lg:p-8 pb-16">
      <AnimatePresence>
        {loadError && (
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 shadow-sm">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <div className="flex-1 text-[13px] font-medium">{loadError}</div>
            <button onClick={load} className="p-2 hover:bg-rose-100 rounded-lg transition-colors">
              <RefreshCw size={14} />
            </button>
          </Motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900">Warehouses & Locations</h1>
          <p className="text-[13px] text-slate-500 mt-1">Manage physical storage facilities and inventory points</p>
        </div>
        {canManage && (
          <Motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenModal()}
            className="btn btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Warehouse
          </Motion.button>
        )}
      </div>

      <div className="relative max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input-enterprise pl-12 py-2.5 text-[13px]" placeholder="Search warehouses..."
          value={localSearch} onChange={e => setLocalSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 space-y-4">
              <div className="skeleton h-6 w-2/3" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <Warehouse size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No warehouses found</p>
            <button onClick={() => handleOpenModal()} className="text-emerald-600 text-[13px] font-bold mt-2 hover:underline">
              Create your first warehouse
            </button>
          </div>
        ) : filtered.map((wh) => (
          <Motion.div key={wh.id} variants={fadeUp} initial="initial" animate="animate"
            className="card group hover:border-emerald-200 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:border-emerald-100 group-hover:text-emerald-500 transition-colors">
                  <Warehouse size={20} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(wh)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="font-display font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{wh.name}</h3>
              <div className="flex items-center gap-2 mt-2 text-slate-500">
                <MapPin size={13} className="flex-shrink-0" />
                <span className="text-[12px] truncate">{wh.location || 'No location specified'}</span>
              </div>
              {wh.description && (
                <p className="mt-3 text-[12px] text-slate-400 line-clamp-2 leading-relaxed italic border-l-2 border-slate-100 pl-3">
                  "{wh.description}"
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${wh.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {wh.is_active ? 'Active' : 'Inactive'}
              </span>
              <span className="text-[11px] font-medium text-slate-400">ID: {wh.id}</span>
            </div>
          </Motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <Motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="font-display font-bold text-slate-900">{editingWh ? 'Edit Warehouse' : 'New Warehouse'}</h2>
                  <p className="text-[11px] text-slate-500">Define storage location parameters</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-[12px] font-medium">{formError}</div>}
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Warehouse Name *</label>
                  <input required className="input-enterprise" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Distribution Center" />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location / Address</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input className="input-enterprise pl-10" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. 123 Logistics Way, NY" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea className="input-enterprise min-h-[80px] py-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Internal notes or specific details about this site..." />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${form.is_active ? 'left-6' : 'left-1'}`} />
                  </button>
                  <span className="text-[13px] font-medium text-slate-700">Active and available for stock</span>
                </div>

                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                    {saving ? <RefreshCw className="animate-spin" size={16} /> : (editingWh ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
