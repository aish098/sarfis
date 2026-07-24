import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, X, AlertCircle, Edit2, Phone, Mail, MapPin, Building2, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelationshipRiskModal from '../../components/risk/RelationshipRiskModal';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';

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
  const [selectedRiskVendor, setSelectedRiskVendor] = useState(null);

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

  const countTotal = vendors.length;
  const countAP = vendors.reduce((s, v) => s + parseFloat(v.current_balance || 0), 0);
  const countActive = vendors.filter(v => v.is_active).length;

  const kpiList = [
    { label: 'Total Suppliers', value: countTotal, icon: Building2, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650' },
    { label: 'Total Owed (AP)', value: `PKR ${countAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Building2, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600' },
    { label: 'Active Suppliers', value: `${countActive} Active`, icon: Building2, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' }
  ];

  return (
    <>
      <WorkspaceLayout
        title="Supplier Directory"
        subtitle="Manage your corporate accounts payable suppliers, terms and procurement settings."
        icon={Building2}
        badgeText="Accounts Payable"
        breadcrumbs={['ACCOUNTELLENCE', 'Procurement', 'Supplier Directory']}
        primaryAction={
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md border-none transition-all active:scale-95 cursor-pointer">
            <Plus size={14} /> Add Supplier
          </button>
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search suppliers by name, phone or email..."
        kpis={kpiList}
      >
        {/* Supplier Grid */}
        <div className="col-span-full">
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
                          <div className="mt-1">
                            <StatusBadge status={vendor.is_active ? 'ACTIVE' : 'INACTIVE'} />
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(vendor)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-none bg-transparent cursor-pointer transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(vendor.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 border-none bg-transparent cursor-pointer transition-all">
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

                  {/* Balances & Risk Details */}
                  <div className="flex items-center justify-between pt-1 border-b border-slate-50 pb-3 mb-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Total Owed (AP)</span>
                    <span className="font-mono font-extrabold text-[14px] text-slate-800">
                      PKR {parseFloat(vendor.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <button onClick={() => setSelectedRiskVendor(vendor)}
                    className="w-full text-center py-2 text-[11.5px] font-bold border border-slate-100 hover:border-emerald-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50/20 text-slate-650 rounded-xl transition-all cursor-pointer">
                    Risk Management & Ratings
                  </button>
                </Motion.div>
              ))
            )}
          </Motion.div>
        </div>
      </WorkspaceLayout>

      {/* Supplier Modal */}
      <AnimatePresence>
        {modalOpen && (
          <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
            <Motion.div
              className="modal-box w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <h2 className="font-display font-extrabold text-[18px] text-slate-900">
                  {editingId ? 'Edit Supplier' : 'New Supplier'}
                </h2>
                <button onClick={() => { setModalOpen(false); setEditingId(null); setForm({ name: '', email: '', phone: '', address: '', isActive: true }); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all border-none bg-transparent cursor-pointer">
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Supplier Name *</label>
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
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-[#10b981]' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-[13px] font-semibold text-slate-700 group-hover:text-[#10b981] transition-colors">Is Active for Procurement?</span>
                  </label>
                </div>
                <div className="flex gap-3 border-t border-slate-100 pt-5 mt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="bg-white border border-slate-200 text-slate-655 hover:bg-slate-50 flex-1 py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl transition-all cursor-pointer">
                    Cancel
                  </button>
                  <Motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit"
                    disabled={saving} className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white flex-[2] py-3 flex items-center justify-center gap-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Supplier'}
                  </Motion.button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <RelationshipRiskModal 
        isOpen={!!selectedRiskVendor} 
        onClose={() => { setSelectedRiskVendor(null); load(); }} 
        entityType="VENDOR" 
        entityId={selectedRiskVendor?.id} 
        entityName={selectedRiskVendor?.name} 
        outstandingBalance={parseFloat(selectedRiskVendor?.current_balance || 0)} 
      />
    </>
  );
}
