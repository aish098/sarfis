import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, CheckCircle, RefreshCw, Trash2, Calendar, ShieldAlert, ArrowRight, User, X, FilePlus, Eye, Clock, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import DocumentHeader from '../../components/ui/DocumentHeader';
import NextActionCard from '../../components/ui/NextActionCard';
import ActivityFeed from '../../components/ui/ActivityFeed';

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
  const [lineageDocs, setLineageDocs] = useState([]);
  const [loadingLineage, setLoadingLineage] = useState(false);

  const loadLineage = async (poId) => {
    if (!activeCompany) return;
    setLoadingLineage(true);
    try {
      const res = await api.get(`/purchase-orders/${activeCompany.id}/PURCHASE_ORDER/${poId}/lineage`);
      setLineageDocs(res.data);
    } catch (err) {
      console.error('Failed to load lineage:', err);
      setLineageDocs([]);
    }
    setLoadingLineage(false);
  };

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
      loadLineage(po.id);
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
        loadLineage(id);
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

  const countTotal = purchaseOrders.length;
  const countPending = purchaseOrders.filter(po => po.status === 'PENDING_APPROVAL').length;
  const countApproved = purchaseOrders.filter(po => po.status === 'APPROVED').length;
  const countReceived = purchaseOrders.filter(po => po.status === 'GOODS_RECEIVED' || po.status === 'PARTIALLY_RECEIVED').length;

  const kpiList = [
    { label: 'Total Orders', value: countTotal, icon: FileText, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650' },
    { label: 'Pending Approval', value: countPending, icon: Clock, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600' },
    { label: 'Approved', value: countApproved, icon: CheckCircle2, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' },
    { label: 'Received / Partial', value: countReceived, icon: ArrowRight, iconBgClass: 'bg-slate-100', iconColorClass: 'text-slate-650' }
  ];

  return (
    <>
      <WorkspaceLayout
        title="Purchase Orders"
        subtitle="Draft, approve, and convert purchase orders cleanly."
        icon={FileText}
        badgeText="Procurement"
        breadcrumbs={['ACCOUNTELLENCE', 'Procurement', 'Purchase Orders']}
        primaryAction={
          <button 
            onClick={() => { resetForm(); setShowFormModal(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none"
          >
            <Plus size={14} /> New Purchase Order
          </button>
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search PO number or vendor..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={[
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'CONVERTED', label: 'Converted' }
        ]}
        kpis={kpiList}
      >
        {/* Table List */}
        <div className="card overflow-hidden lg:col-span-8 shadow-sm">
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
              <tbody className="divide-y divide-[#E6EBE8] text-[13px] text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-355" /> Loading...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 italic">No purchase orders found.</td>
                  </tr>
                ) : filteredOrders.map(po => {
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => handleSelectPo(po)}>
                      <td className="px-4 py-3.5 font-mono text-[12px] font-bold text-slate-700">{po.po_number}</td>
                      <td className="px-4 py-3.5 text-[13px] font-semibold text-slate-800">{po.vendor_name || 'System Auto-PO'}</td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500">{new Date(po.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-[13px] text-right font-mono font-bold text-slate-800">
                        PKR {parseFloat(po.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-center">
                          <button 
                            onClick={() => handleSelectPo(po)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-655 hover:bg-slate-200"
                          >
                            View
                          </button>
                          {po.status === 'DRAFT' && (
                            <button 
                              onClick={() => handleEditPo(po)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100/50"
                            >
                              Edit
                            </button>
                          )}
                          {po.status === 'APPROVED' && (
                            <button 
                              onClick={() => handleConvertPo(po.id)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 border-none cursor-pointer"
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
                    <h3 className="font-mono font-bold text-slate-800 text-[14px] flex items-center gap-2">
                      {selectedPo.po_number}
                      <StatusBadge status={selectedPo.status} />
                    </h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Purchase Order Details</p>
                  </div>
                  <button onClick={() => setSelectedPo(null)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"><X size={15} /></button>
                </div>

                <DocumentHeader 
                  title="Purchase Order"
                  number={selectedPo.po_number}
                  status={selectedPo.status}
                  metadata={[
                    { label: 'Vendor / Supplier', value: selectedPo.vendor_name || 'System Auto', icon: Building2 },
                    { label: 'Order Date', value: new Date(selectedPo.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), icon: Calendar },
                    { label: 'Generated By', value: selectedPo.creator_name || 'System', icon: User },
                    { label: 'Requisition Link', value: selectedPo.source_requisition_number ? selectedPo.source_requisition_number : 'None (Direct)', icon: FileText },
                    { label: 'Current Stage', value: selectedPo.currentStageName || (selectedPo.status === 'APPROVED' ? 'Approved' : selectedPo.status === 'CONVERTED' ? 'Completed' : 'Draft'), icon: ShieldAlert }
                  ]}
                />

                {selectedPo.notes && (
                  <div className="border-t border-slate-100 pt-2">
                    <span className="block font-bold text-slate-400 text-[10px] uppercase">Notes</span>
                    <p className="italic text-slate-600 font-semibold">{selectedPo.notes}</p>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-2">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Ordered Items</span>
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px] bg-white">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-slate-500 font-bold">Product</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Qty</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {selectedPo.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 text-slate-700 font-semibold">{item.product_name}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-700">{parseFloat(item.quantity)} {item.unit_of_measure}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-700 font-mono">PKR {parseFloat(item.unit_price).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between font-bold text-[13px] pt-1">
                    <span>Total Amount</span>
                    <span className="font-mono text-slate-900">PKR {parseFloat(selectedPo.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Related Documents */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Document Journey & Relationships</span>
                  {loadingLineage ? (
                    <div className="text-[11px] text-slate-450 italic font-semibold"><RefreshCw size={11} className="animate-spin inline mr-1" /> Loading journey...</div>
                  ) : (
                    <RelatedDocuments documents={lineageDocs} currentType="PURCHASE_ORDER" />
                  )}
                </div>

                {/* Workflow timeline */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Approval Workflow</span>
                  {loadingTimeline ? (
                    <div className="text-[11px] text-slate-400 italic"><RefreshCw size={11} className="animate-spin inline mr-1" /> Loading timeline...</div>
                  ) : poTimeline.length === 0 ? (
                    <div className="text-[11px] text-slate-450 italic bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">No workflow history for this document yet.</div>
                  ) : (
                    <ActivityFeed
                      events={(poTimeline || []).map((item, idx) => {
                        let statusColor = 'blue';
                        if (item.action === 'APPROVED') statusColor = 'green';
                        else if (item.action === 'REJECTED') statusColor = 'red';
                        else if (item.action === 'SUBMIT') statusColor = 'blue';
                        else if (item.action === 'SKIPPED') statusColor = 'gray';

                        return {
                          id: item.id || idx,
                          title: `${item.stage_name || 'Workflow Step'}: ${item.action}`,
                          description: item.comments ? `"${item.comments}"` : 'No comments provided.',
                          timestamp: item.action_date || item.created_at,
                          statusColor,
                          meta: `Processed by ${item.approver_name || 'System'}`
                        };
                      })}
                    />
                  )}
                </div>

                {/* Details Actions */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  {selectedPo.status === 'DRAFT' && (
                    <NextActionCard 
                      status={selectedPo.status}
                      description="Submit this Purchase Order draft for workflow authorization."
                    >
                      <button 
                        onClick={() => handleSendForApproval(selectedPo.id)}
                        className="w-full py-2.5 bg-indigo-65 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer border-none"
                      >
                        Submit for Approval
                      </button>
                    </NextActionCard>
                  )}
                  {['APPROVED', 'PARTIALLY_RECEIVED'].includes(selectedPo.status) && (
                    <NextActionCard 
                      status={selectedPo.status}
                      description="This Purchase Order is approved. Record the arrival of items at the warehouse using a Goods Receipt Note (GRN)."
                    >
                      <button 
                        onClick={() => navigate(`/dashboard/goods-receipts?po_id=${selectedPo.id}`)}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer border-none mt-1"
                      >
                        Receive Goods
                      </button>
                    </NextActionCard>
                  )}
                  {selectedPo.status === 'GOODS_RECEIVED' && (
                    <NextActionCard 
                      status={selectedPo.status}
                      description="All items have been received successfully. Click below to view the linked goods receipt transactions."
                    >
                      <button 
                        onClick={() => navigate(`/dashboard/goods-receipts`)}
                        className="text-[11.5px] font-bold text-emerald-600 border-none bg-transparent cursor-pointer hover:underline flex items-center gap-0.5"
                      >
                        Open Receipts <ArrowRight size={12} />
                      </button>
                    </NextActionCard>
                  )}
                  {selectedPo.status === 'CONVERTED' && (
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[12px] font-semibold text-slate-650">
                      <span>Voucher created for this PO</span>
                    </div>
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
      </WorkspaceLayout>

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
    </>
  );
}
