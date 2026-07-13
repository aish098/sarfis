import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, FileText, CheckCircle, RefreshCw, Trash2, Calendar, ShieldAlert, ArrowRight, User, X, FilePlus, Eye, Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-indigo-50 text-indigo-700 border border-indigo-100' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  CONVERTED_TO_PO: { label: 'Converted to PO', bg: 'bg-slate-50 text-slate-600 border border-slate-200' },
  REJECTED: { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border border-rose-100' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-100 text-slate-700 border border-slate-200' }
};

const PRIORITY_CONFIG = {
  LOW: { label: '🟢 Low', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  NORMAL: { label: '🔵 Normal', bg: 'bg-blue-50 text-blue-700 border-blue-100' },
  HIGH: { label: '🟠 High', bg: 'bg-orange-50 text-orange-700 border-orange-100' },
  URGENT: { label: '🔴 Urgent', bg: 'bg-rose-50 text-rose-700 border-rose-100' }
};

export default function PurchaseRequisitionsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { activeCompany } = useAuthStore();

  const [requisitions, setRequisitions] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [reqTimeline, setReqTimeline] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [reqForm, setReqForm] = useState({
    department: 'Finance',
    requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'NORMAL',
    reason: '',
    items: [{ productId: '', quantity: '', estimatedPrice: '', description: '' }]
  });

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [reqsRes, prodsRes] = await Promise.all([
        api.get(`/purchase-requisitions/${activeCompany.id}`),
        api.get(`/products/${activeCompany.id}`)
      ]);
      setRequisitions(reqsRes.data);
      setProducts(prodsRes.data);
    } catch (err) {
      console.error('Failed to load requisitions:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Deep linking
  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get('id') || params.get('open');
    if (id && requisitions.length > 0) {
      const match = requisitions.find(r => String(r.id) === String(id));
      if (match) {
        handleSelectReq(match);
      }
    }
  }, [search, requisitions]);

  const loadTimeline = async (reqId) => {
    setLoadingTimeline(true);
    try {
      const res = await api.get(`/workflows/history/PURCHASE_REQUISITION/${reqId}`);
      setReqTimeline(res.data);
    } catch (err) {
      console.error(err);
      setReqTimeline([]);
    }
    setLoadingTimeline(false);
  };

  const handleSelectReq = async (req) => {
    setSelectedReq(null);
    try {
      const res = await api.get(`/purchase-requisitions/${activeCompany.id}/${req.id}`);
      setSelectedReq(res.data);
      loadTimeline(req.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Items manipulation helpers
  const addFormItem = () => {
    setReqForm(f => ({
      ...f,
      items: [...f.items, { productId: '', quantity: '', estimatedPrice: '', description: '' }]
    }));
  };

  const removeFormItem = (idx) => {
    setReqForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx)
    }));
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...reqForm.items];
    items[idx][field] = value;
    
    // Auto-fill price from product lookup
    if (field === 'productId' && value) {
      const prod = products.find(p => String(p.id) === String(value));
      if (prod) {
        items[idx].estimatedPrice = parseFloat(prod.cost_price || 0).toFixed(2);
        items[idx].description = `Purchase of ${prod.name}`;
      }
    }
    setReqForm(f => ({ ...f, items }));
  };

  const handleSubmitForApproval = async (id) => {
    try {
      await api.post(`/purchase-requisitions/${activeCompany.id}/${id}/submit`);
      loadData();
      if (selectedReq?.id === id) {
        const updated = await api.get(`/purchase-requisitions/${activeCompany.id}/${id}`);
        setSelectedReq(updated.data);
        loadTimeline(id);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit requisition.');
    }
  };

  const handleConvertToPo = async (id) => {
    try {
      const res = await api.post(`/purchase-requisitions/${activeCompany.id}/${id}/convert`);
      loadData();
      // Redirect directly to the converted PO draft
      navigate(`/dashboard/purchase-orders?id=${res.data.purchaseOrderId}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert requisition.');
    }
  };

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const validItems = reqForm.items.filter(i => i.productId && parseFloat(i.quantity) > 0);
      if (validItems.length === 0) throw new Error('Add at least one product line.');

      await api.post(`/purchase-requisitions/${activeCompany.id}`, {
        ...reqForm,
        items: validItems
      });

      setCreateModal(false);
      setReqForm({
        department: 'Finance',
        requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'NORMAL',
        reason: '',
        items: [{ productId: '', quantity: '', estimatedPrice: '', description: '' }]
      });
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message);
    }
    setIsSaving(false);
  };

  const estimatedTotal = reqForm.items.reduce((acc, item) => {
    return acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedPrice) || 0));
  }, 0);

  // Filtered rows
  const filteredReqs = requisitions.filter(r => {
    const matchesSearch = r.requisition_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.requested_by_name && r.requested_by_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans pb-20">
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900 tracking-tight">Purchase Requisitions</h1>
          <p className="text-[12.5px] text-slate-500 mt-1">Request materials, track workflows, and automatically convert to Purchase Orders.</p>
        </div>
        <button 
          onClick={() => setCreateModal(true)}
          className="btn btn-primary px-4.5 py-2.5 rounded-xl shadow-sm text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer hover:shadow"
        >
          <Plus size={14} /> New Requisition
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-9 text-[13px] py-2.5" 
            placeholder="Search Requisition No, department, requested by..." 
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
          <option value="CONVERTED_TO_PO">Converted to PO</option>
          <option value="REJECTED">Rejected</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Table List Card */}
        <div className="card overflow-hidden lg:col-span-8 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Requisition No</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Requested By</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Department</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Priority</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right">Est. Total</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE8] text-[13px] text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-350" /> Loading requisitions...
                    </td>
                  </tr>
                ) : filteredReqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 italic">No requisitions found.</td>
                  </tr>
                ) : filteredReqs.map(req => {
                  const statusConf = STATUS_CONFIG[req.status] || { label: req.status, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
                  const priorityConf = PRIORITY_CONFIG[req.priority] || { label: req.priority, bg: 'bg-slate-50 text-slate-700' };
                  
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => handleSelectReq(req)}>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#2E4D3F]">{req.requisition_number}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{req.requested_by_name || 'System Auto'}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{req.department || 'General'}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] font-black border ${priorityConf.bg}`}>
                          {priorityConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                        PKR {parseFloat(req.estimated_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusConf.bg}`}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button 
                            onClick={() => handleSelectReq(req)}
                            className="text-[11px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Panel Sidebar Drawer */}
        <div className="lg:col-span-4 space-y-6">
          {selectedReq ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
                <div>
                  <h3 className="font-mono font-black text-slate-850 text-[15px]">{selectedReq.requisition_number}</h3>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Purchase Requisition Details</p>
                </div>
                <button onClick={() => setSelectedReq(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-50 border-none bg-transparent cursor-pointer"><X size={15} /></button>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-[12px] text-slate-600 border-b border-slate-100 pb-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Requested By</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <User size={12} className="text-slate-400" />
                    {selectedReq.requested_by_name || 'System Auto'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Department</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedReq.department || 'General'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date Needed</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{new Date(selectedReq.required_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Priority</span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black border ${PRIORITY_CONFIG[selectedReq.priority]?.bg}`}>
                    {PRIORITY_CONFIG[selectedReq.priority]?.label}
                  </span>
                </div>
              </div>

              {selectedReq.reason && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Business Justification</span>
                  <p className="text-[12px] italic text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">{selectedReq.reason}</p>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Requested Items</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden text-[11.5px] bg-white">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {selectedReq.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30">
                          <td className="px-3 py-2">
                            <span className="block font-bold text-slate-800">{item.product_name}</span>
                            {item.description && <span className="block text-[9.5px] text-slate-400">{item.description}</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{parseFloat(item.quantity)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">PKR {parseFloat(item.estimated_price).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between font-black text-[13px] pt-1.5 border-t border-slate-100">
                  <span className="text-slate-850">Estimated Total</span>
                  <span className="font-mono text-slate-900">PKR {parseFloat(selectedReq.estimated_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Document Journey and relationships mapping */}
              {(() => {
                const relatedDocs = [];
                // Purchase order link if converted
                if (selectedReq.relatedPos && selectedReq.relatedPos.length > 0) {
                  selectedReq.relatedPos.forEach(po => {
                    relatedDocs.push({
                      type: 'PURCHASE_ORDER',
                      id: po.id,
                      number: po.po_number,
                      status: po.status,
                      link: `/dashboard/purchase-orders?id=${po.id}`
                    });
                  });
                }
                return <RelatedDocuments documents={relatedDocs} currentType="PURCHASE_REQUISITION" />;
              })()}

              {/* Approvals history timeline */}
              <div className="space-y-3 pt-3.5 border-t border-slate-150">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Approval Workflow Timeline</span>
                {loadingTimeline ? (
                  <div className="text-[11px] text-slate-400 italic"><RefreshCw size={11} className="animate-spin inline mr-1" /> Loading timeline...</div>
                ) : reqTimeline.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">No workflow approvals history generated yet.</div>
                ) : (
                  <div className="space-y-3.5 border-l-2 border-slate-100 pl-4.5 py-0.5 ml-2.5">
                    {reqTimeline.map((item, idx) => (
                      <div key={item.id} className="relative text-[11px]">
                        <span className={`absolute -left-[24.5px] top-0.5 w-3.5 h-3.5 rounded-full border bg-white flex items-center justify-center ${
                          item.action === 'SUBMITTED' ? 'border-indigo-400 text-indigo-500' :
                          item.action === 'APPROVED' ? 'border-emerald-400 text-emerald-500' :
                          'border-rose-400 text-rose-500'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800">{item.action} — {item.stage_name}</p>
                          <p className="text-[9px] text-slate-450 font-bold">By {item.actioned_name || 'System'} • {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Next Action Cards / Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {selectedReq.status === 'DRAFT' && (
                  <button 
                    onClick={() => handleSubmitForApproval(selectedReq.id)}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer border-none"
                  >
                    Submit for Approval
                  </button>
                )}
                {selectedReq.status === 'APPROVED' && (
                  <div className="bg-emerald-50/50 border border-emerald-150 p-3.5 rounded-2xl space-y-2 shadow-sm">
                    <span className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Requisition is fully approved. Convert this requisition into a Purchase Order to send to the vendor.
                    </p>
                    <button 
                      onClick={() => handleConvertToPo(selectedReq.id)}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer border-none mt-1"
                    >
                      Create Purchase Order
                    </button>
                  </div>
                )}
                {selectedReq.status === 'CONVERTED_TO_PO' && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[12px] font-semibold text-slate-650">
                    <span>Requisition converted to PO</span>
                    {selectedReq.relatedPos?.[0] && (
                      <button 
                        onClick={() => navigate(`/dashboard/purchase-orders?id=${selectedReq.relatedPos[0].id}`)}
                        className="text-[11.5px] font-bold text-emerald-600 border-none bg-transparent cursor-pointer hover:underline flex items-center gap-0.5"
                      >
                        Open PO <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400 italic text-[12.5px] shadow-inner select-none">
              <FileText size={30} className="mx-auto mb-2 text-slate-300 opacity-60" />
              Select a requisition from the list to display details, timeline, and actions.
            </div>
          )}
        </div>
      </div>

      {/* ─── New Requisition Modal ─── */}
      {createModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="font-display font-extrabold text-[16px] text-slate-900">New Purchase Requisition</h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">Define your requested materials and submit for internal approval.</p>
              </div>
              <button 
                onClick={() => setCreateModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-650 font-medium">
                  <AlertTriangle size={14} className="text-red-500" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Department / Cost Center *</label>
                  <input 
                    required 
                    className="input-enterprise" 
                    placeholder="e.g. Finance, Procurement, HR" 
                    value={reqForm.department} 
                    onChange={e => setReqForm({ ...reqForm, department: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="field-label">Priority Level</label>
                  <select 
                    className="input-enterprise" 
                    value={reqForm.priority} 
                    onChange={e => setReqForm({ ...reqForm, priority: e.target.value })}
                  >
                    <option value="LOW">🟢 Low</option>
                    <option value="NORMAL">🔵 Normal</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="URGENT">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Needed By Date *</label>
                  <input 
                    type="date" 
                    required
                    className="input-enterprise font-mono" 
                    value={reqForm.requiredDate} 
                    onChange={e => setReqForm({ ...reqForm, requiredDate: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="field-label">Reason / Justification</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. Upgrade for finance team workstation laptops" 
                    value={reqForm.reason} 
                    onChange={e => setReqForm({ ...reqForm, reason: e.target.value })} 
                  />
                </div>
              </div>

              {/* Items grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <label className="field-label font-bold text-slate-800 uppercase tracking-wider text-[10.5px]">Requested Items List</label>
                  <button 
                    type="button" 
                    onClick={addFormItem} 
                    className="text-[11.5px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 border-none bg-transparent cursor-pointer"
                  >
                    <Plus size={12} /> Add Product Line
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[700px] divide-y divide-slate-100 text-[12px] bg-white">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-3.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[9.5px] font-black uppercase tracking-widest text-slate-500">
                        <div className="col-span-4">Product *</div>
                        <div className="col-span-3">Description</div>
                        <div className="col-span-2">Quantity *</div>
                        <div className="col-span-2 text-right">Est. Price *</div>
                        <div className="col-span-1 text-center">Action</div>
                      </div>

                      {/* Rows */}
                      {reqForm.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-3.5 px-4 py-2.5 items-center hover:bg-slate-50/30">
                          <div className="col-span-4">
                            <select 
                              required 
                              className="input-enterprise py-1.5 text-[12px]" 
                              value={item.productId} 
                              onChange={e => handleItemChange(idx, 'productId', e.target.value)}
                            >
                              <option value="">— Choose product —</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <input 
                              type="text" 
                              placeholder="Notes / specs" 
                              className="input-enterprise py-1.5 text-[12px]" 
                              value={item.description} 
                              onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                            />
                          </div>
                          <div className="col-span-2">
                            <input 
                              type="number" 
                              step="0.01" 
                              required 
                              placeholder="0.00" 
                              className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                              value={item.quantity} 
                              onChange={e => handleItemChange(idx, 'quantity', e.target.value)} 
                            />
                          </div>
                          <div className="col-span-2">
                            <input 
                              type="number" 
                              step="0.01" 
                              required 
                              placeholder="0.00" 
                              className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                              value={item.estimatedPrice} 
                              onChange={e => handleItemChange(idx, 'estimatedPrice', e.target.value)} 
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {reqForm.items.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => removeFormItem(idx)}
                                className="w-6 h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center border border-red-100 hover:border-red-200 transition bg-white cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[12.5px] font-bold">
                    <span className="uppercase text-slate-400 tracking-wider">Estimated Total Amount</span>
                    <span className="font-mono text-slate-900 text-[15px]">PKR {estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setCreateModal(false)} 
                  className="btn btn-secondary flex-1 py-2.5 text-[12.5px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="btn btn-primary flex-[2] py-2.5 text-[12.5px] font-bold cursor-pointer"
                >
                  {isSaving ? <><RefreshCw size={13} className="animate-spin" /> Creating...</> : 'Save Draft Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
