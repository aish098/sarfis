import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, CheckCircle, RefreshCw, Trash2, Calendar, ShieldAlert, ArrowRight, User, X, FilePlus, Eye, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-indigo-50 text-indigo-700 border border-indigo-100' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border border-rose-100' },
  CONVERTED: { label: 'Converted', bg: 'bg-slate-50 text-slate-600 border border-slate-200' }
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { activeCompany } = useAuthStore();

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPo, setEditingPo] = useState(null);
  const [selectedPo, setSelectedPo] = useState(null);
  const [poTimeline, setPoTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Form State
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: 0.00 }]);

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [poRes, vendorRes, prodRes] = await Promise.all([
        api.get(`/purchase-orders/${activeCompany.id}`),
        api.get(`/vendors/${activeCompany.id}`),
        api.get(`/products/${activeCompany.id}`)
      ]);
      setPurchaseOrders(poRes.data);
      setVendors(vendorRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error('Failed to load purchase order data:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get('id') || params.get('open');
    if (id && purchaseOrders.length > 0) {
      const match = purchaseOrders.find(po => String(po.id) === String(id));
      if (match) {
        handleSelectPo(match);
      }
    }
  }, [search, purchaseOrders]);

  const loadTimeline = async (poId) => {
    setLoadingTimeline(true);
    try {
      // Find active workflow instance for PO
      const approvalsRes = await api.get('/workflows/pending').catch(() => ({ data: [] }));
      const historyRes = await api.get('/workflows/history').catch(() => ({ data: [] }));
      
      const allInstances = [...approvalsRes.data, ...historyRes.data];
      const match = allInstances.find(inst => inst.document_type_code === 'PURCHASE_ORDER' && inst.document_id === poId);
      
      if (match) {
        const { data } = await api.get(`/workflows/timeline/${match.instance_id}`);
        setPoTimeline(data);
      } else {
        setPoTimeline([]);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setPoTimeline([]);
    }
    setLoadingTimeline(false);
  };

  const handleSelectPo = async (po) => {
    try {
      const { data } = await api.get(`/purchase-orders/${activeCompany.id}/${po.id}`);
      setSelectedPo(data);
      loadTimeline(po.id);
    } catch (err) {
      alert('Failed to load purchase order details.');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitPrice: 0.00 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'productId') {
      const prod = products.find(p => String(p.id) === String(value));
      if (prod) {
        updated[index].unitPrice = parseFloat(prod.cost_price || 0.00);
      }
    }
    setItems(updated);
  };

  const resetForm = () => {
    setVendorId('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setItems([{ productId: '', quantity: 1, unitPrice: 0.00 }]);
    setEditingPo(null);
    setFormError('');
  };

  const handleEditPo = async (po) => {
    try {
      const { data } = await api.get(`/purchase-orders/${activeCompany.id}/${po.id}`);
      setEditingPo(data);
      setVendorId(data.vendor_id || '');
      setNotes(data.notes || '');
      setDate(data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setItems(data.items.map(item => ({
        productId: item.product_id,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price)
      })));
      setShowFormModal(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load purchase order details for editing.');
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');
    
    const validLines = items.filter(i => i.productId && parseFloat(i.quantity) > 0);
    if (validLines.length === 0) {
      setFormError('Please add at least one valid product line.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendorId: vendorId ? parseInt(vendorId) : null,
        date,
        notes,
        items: validLines
      };

      if (editingPo) {
        await api.put(`/purchase-orders/${activeCompany.id}/${editingPo.id}`, payload);
      } else {
        await api.post(`/purchase-orders/${activeCompany.id}`, payload);
      }
      setShowFormModal(false);
      resetForm();
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save purchase order.');
    }
    setSaving(false);
  };

  const handleSendForApproval = async (id) => {
    if (!window.confirm('Submit this Purchase Order for approval?')) return;
    try {
      await api.post(`/purchase-orders/${activeCompany.id}/${id}/submit`);
      loadData();
      if (selectedPo && selectedPo.id === id) {
        const { data } = await api.get(`/purchase-orders/${activeCompany.id}/${id}`);
        setSelectedPo(data);
        loadTimeline(id);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit Purchase Order.');
    }
  };

  const handleConvertPo = async (id) => {
    if (!window.confirm('Convert this approved Purchase Order into a Purchase Voucher? This will create a pre-filled Voucher draft.')) return;
    try {
      const { data } = await api.post(`/purchase-orders/${activeCompany.id}/${id}/convert-to-voucher`);
      alert(`Successfully converted! Draft Purchase Voucher ${data.voucher.voucher_number} created.`);
      navigate('/dashboard/vouchers');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert Purchase Order.');
    }
  };

  const orderTotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);

  const filteredOrders = purchaseOrders.filter(po => {
    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    const matchesSearch = po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (po.vendor_name && po.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      
      {/* Top Banner */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Purchase Orders</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Procurement</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Draft, approve, and convert purchase orders cleanly.
            </p>
          </div>
        </div>

        <button 
          onClick={() => { resetForm(); setShowFormModal(true); }}
          className="mt-3 md:mt-0 flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={14} /> New Purchase Order
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-9 text-[13px] py-2.5" 
            placeholder="Search PO number or vendor..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select 
          className="input-enterprise text-[13px] py-2.5 w-auto"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CONVERTED">Converted</option>
        </select>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Table List */}
        <div className="card overflow-hidden lg:col-span-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">PO Number</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Vendor</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE8]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-300" /> Loading...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 italic">No purchase orders found.</td>
                  </tr>
                ) : filteredOrders.map(po => {
                  const conf = STATUS_CONFIG[po.status] || { label: po.status, bg: 'bg-slate-100 text-slate-700' };
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => handleSelectPo(po)}>
                      <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-700">{po.po_number}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-slate-800">{po.vendor_name || 'System Auto-PO'}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">{new Date(po.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[13px] text-right font-mono font-bold text-slate-800">
                        ${parseFloat(po.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${conf.bg}`}>
                          {conf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-center">
                          <button 
                            onClick={() => handleSelectPo(po)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            View
                          </button>
                          {po.status === 'DRAFT' && (
                            <button 
                              onClick={() => handleEditPo(po)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded bg-blue-55 text-blue-600 border border-blue-100 hover:bg-blue-50"
                            >
                              Edit
                            </button>
                          )}
                          {po.status === 'APPROVED' && (
                            <button 
                              onClick={() => handleConvertPo(po.id)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                            >
                              Convert
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected PO Details panel */}
        <div className="lg:col-span-4 space-y-6">
          <AnimatePresence mode="wait">
            {selectedPo ? (
              <Motion.div 
                key={selectedPo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-mono font-bold text-slate-800 text-[14px]">{selectedPo.po_number}</h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Purchase Order Details</p>
                  </div>
                  <button onClick={() => setSelectedPo(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                </div>

                <div className="space-y-2 text-[12px] text-slate-600">
                  <div className="flex justify-between"><span>Vendor:</span><span className="font-bold text-slate-800">{selectedPo.vendor_name || 'System Auto'}</span></div>
                  <div className="flex justify-between"><span>Date:</span><span className="font-bold text-slate-800">{new Date(selectedPo.date).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span>Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_CONFIG[selectedPo.status]?.bg}`}>
                      {STATUS_CONFIG[selectedPo.status]?.label}
                    </span>
                  </div>
                  {selectedPo.notes && <div className="border-t border-slate-100 pt-2"><span className="block font-bold text-slate-400 text-[10px] uppercase">Notes</span><p className="italic text-slate-500">{selectedPo.notes}</p></div>}
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Ordered Items</span>
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px]">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-slate-500 font-bold">Product</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Qty</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPo.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 text-slate-700 font-semibold">{item.product_name}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-700">{parseFloat(item.quantity)} {item.unit_of_measure}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-700">${parseFloat(item.unit_price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between font-bold text-[13px] pt-1">
                    <span>Total Amount</span>
                    <span className="font-mono text-slate-900">${parseFloat(selectedPo.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Related Documents */}
                {(() => {
                  const relatedDocs = [];
                  if (selectedPo?.relatedVouchers && selectedPo.relatedVouchers.length > 0) {
                    selectedPo.relatedVouchers.forEach(v => {
                      relatedDocs.push({
                        type: 'VOUCHER',
                        id: v.id,
                        number: v.voucher_number,
                        status: v.status,
                        created_at: v.created_at,
                        creator_name: v.creator_name,
                        link: `/dashboard/vouchers/details/${v.id}`
                      });
                    });
                  }
                  return <RelatedDocuments documents={relatedDocs} currentType="PURCHASE_ORDER" />;
                })()}

                {/* Workflow timeline */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Approval Workflow</span>
                  {loadingTimeline ? (
                    <div className="text-[11px] text-slate-400 italic"><RefreshCw size={11} className="animate-spin inline mr-1" /> Loading timeline...</div>
                  ) : poTimeline.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">No workflow history for this document yet.</div>
                  ) : (
                    <div className="space-y-3 border-l border-slate-100 pl-4 py-0.5">
                      {poTimeline.map((item, idx) => (
                        <div key={item.id} className="relative text-[11px]">
                          <span className={`absolute -left-[21.5px] top-0.5 w-3.5 h-3.5 rounded-full border bg-white flex items-center justify-center ${
                            item.action === 'SUBMITTED' ? 'border-indigo-400 text-indigo-500' :
                            item.action === 'APPROVED' ? 'border-emerald-400 text-emerald-500' :
                            'border-rose-400 text-rose-500'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          </span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800">{item.action} — {item.stage_name}</p>
                            <p className="text-[9px] text-slate-400 font-semibold">By {item.actioned_name || 'System'} • {new Date(item.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details Actions */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  {selectedPo.status === 'DRAFT' && (
                    <button 
                      onClick={() => handleSendForApproval(selectedPo.id)}
                      className="w-full py-2.5 bg-indigo-65 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Submit for Approval
                    </button>
                  )}
                  {selectedPo.status === 'APPROVED' && (
                    <button 
                      onClick={() => handleConvertPo(selectedPo.id)}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Convert to Purchase Voucher
                    </button>
                  )}
                </div>
              </Motion.div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8 text-center text-slate-400 text-[12.5px] italic">
                Select a Purchase Order to view items, timeline, and actions.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New / Edit PO Modal */}
      <AnimatePresence>
        {showFormModal && (
          <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Motion.div 
              className="modal-box w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-100"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-display font-extrabold text-[17px] text-slate-900">{editingPo ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Prepare procurement request for workflow routing</p>
                </div>
                <button onClick={() => { setShowFormModal(false); resetForm(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={15} /></button>
              </div>

              <div className="p-7 overflow-y-auto max-h-[75vh]">
                <form onSubmit={handleSubmitForm} className="space-y-4">
                  {formError && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[12px] text-red-600 font-medium"><AlertCircle size={14} />{formError}</div>}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="field-label text-[11px] font-bold text-slate-500 uppercase">Vendor / Supplier *</label>
                      <select 
                        required 
                        className="input-enterprise" 
                        value={vendorId} 
                        onChange={e => setVendorId(e.target.value)}
                      >
                        <option value="">— Select vendor —</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label text-[11px] font-bold text-slate-500 uppercase">Date *</label>
                      <input 
                        type="date" 
                        required 
                        className="input-enterprise" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="field-label text-[11px] font-bold text-slate-500 uppercase">Items *</label>
                      <button 
                        type="button" 
                        onClick={handleAddItem} 
                        className="text-[12px] font-semibold text-[#10b981] hover:text-emerald-700 flex items-center gap-1"
                      >
                        <Plus size={12} /> Add item
                      </button>
                    </div>

                    <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2.5 bg-[#EBF2EE] border-b-[2px] border-[#D1E0D8] text-[9px] font-black uppercase tracking-widest text-[#2E4D3F]">
                        <div className="col-span-6">Product</div>
                        <div className="col-span-2 text-right">Quantity</div>
                        <div className="col-span-3 text-right">Unit Price ($)</div>
                        <div className="col-span-1" />
                      </div>

                      {items.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-2 px-3 py-3 sm:py-2 border-t border-slate-100 last:border-b-0 items-center">
                          <div className="flex flex-col gap-1 sm:col-span-6 w-full">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">Product</span>
                            <select 
                              required 
                              className="input-enterprise text-[12px] py-1.5" 
                              value={item.productId} 
                              onChange={e => handleItemChange(idx, 'productId', e.target.value)}
                            >
                              <option value="">Select product</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1 sm:col-span-2 w-full">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">Qty</span>
                            <input 
                              type="number" 
                              required 
                              step="any"
                              placeholder="1" 
                              className="input-enterprise text-[12px] py-1.5 text-right font-mono" 
                              value={item.quantity} 
                              onChange={e => handleItemChange(idx, 'quantity', e.target.value)} 
                            />
                          </div>
                          <div className="flex flex-col gap-1 sm:col-span-3 w-full">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">Price</span>
                            <input 
                              type="number" 
                              required 
                              step="any"
                              placeholder="0.00" 
                              className="input-enterprise text-[12px] py-1.5 text-right font-mono" 
                              value={item.unitPrice} 
                              onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)} 
                            />
                          </div>
                          <div className="flex items-center justify-end sm:justify-center sm:col-span-1 pt-1 sm:pt-0">
                            {items.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => handleRemoveItem(idx)}
                                className="w-8 h-8 sm:w-6 sm:h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center border border-red-100 sm:border-0"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Estimate</span>
                        <span className="font-mono font-extrabold text-[15px] text-slate-900">${orderTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="field-label text-[11px] font-bold text-slate-500 uppercase">Notes / Remarks</label>
                    <textarea 
                      className="input-enterprise py-2 resize-none h-20" 
                      value={notes} 
                      onChange={e => setNotes(e.target.value)} 
                      placeholder="Add descriptions or internal instructions..."
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setShowFormModal(false); resetForm(); }} className="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" disabled={saving} className="btn btn-primary flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 font-bold cursor-pointer flex justify-center items-center gap-1.5">
                      {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : (editingPo ? 'Update Purchase Order' : 'Create Purchase Order')}
                    </button>
                  </div>
                </form>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
