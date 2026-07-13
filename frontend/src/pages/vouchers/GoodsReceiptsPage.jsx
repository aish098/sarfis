import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, FileText, CheckCircle, RefreshCw, Trash2, Calendar, ShieldAlert, ArrowRight, User, X, FilePlus, Eye, Clock, CheckCircle2, AlertCircle, AlertTriangle, Building2, Package, Inbox, Layers } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  RECEIVED: { label: 'Goods Received', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100' }
};

export default function GoodsReceiptsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { activeCompany } = useAuthStore();

  const [receipts, setReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedGrn, setSelectedGrn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [grnForm, setGrnForm] = useState({
    purchaseOrderId: '',
    vendorId: '',
    warehouseId: '',
    receivedDate: new Date().toISOString().split('T')[0],
    supplierReference: '',
    notes: '',
    items: []
  });

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [grnsRes, posRes, whRes, vendRes] = await Promise.all([
        api.get(`/goods-receipts/${activeCompany.id}`),
        api.get(`/purchase-orders/${activeCompany.id}`),
        api.get(`/warehouses/${activeCompany.id}`),
        api.get(`/vendors/${activeCompany.id}`)
      ]);
      setReceipts(grnsRes.data);
      // Only POs that are approved, partially received, or goods received can have GRNs created
      setPurchaseOrders(posRes.data.filter(po => ['APPROVED', 'PARTIALLY_RECEIVED', 'GOODS_RECEIVED'].includes(po.status)));
      setWarehouses(whRes.data.filter(w => w.is_active));
      setVendors(vendRes.data.filter(v => v.is_active));
    } catch (err) {
      console.error('Failed to load goods receipts:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Deep linking / Auto-opening PO link from Next Action
  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get('id') || params.get('open');
    const poId = params.get('po_id');

    if (id && receipts.length > 0) {
      const match = receipts.find(r => String(r.id) === String(id));
      if (match) handleSelectGrn(match);
    }

    if (poId && purchaseOrders.length > 0) {
      const matchPo = purchaseOrders.find(po => String(po.id) === String(poId));
      if (matchPo) {
        handleOpenCreateFromPo(matchPo);
      }
    }
  }, [search, receipts, purchaseOrders]);

  const handleSelectGrn = async (grn) => {
    setSelectedGrn(null);
    try {
      const res = await api.get(`/goods-receipts/${activeCompany.id}/${grn.id}`);
      setSelectedGrn(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreateFromPo = async (po) => {
    try {
      const res = await api.get(`/purchase-orders/${activeCompany.id}/${po.id}`);
      const poDetails = res.data;

      // Find first warehouse
      const defaultWh = warehouses[0]?.id || '';

      // Map lines
      const grnLines = poDetails.items.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_sku,
        quantityOrdered: parseFloat(item.quantity),
        quantityReceived: parseFloat(item.quantity),
        quantityRejected: 0,
        notes: ''
      }));

      setGrnForm({
        purchaseOrderId: po.id,
        vendorId: po.vendor_id,
        warehouseId: defaultWh,
        receivedDate: new Date().toISOString().split('T')[0],
        supplierReference: '',
        notes: '',
        items: grnLines
      });

      setCreateModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePoChange = async (poId) => {
    if (!poId) {
      setGrnForm(f => ({ ...f, purchaseOrderId: '', items: [] }));
      return;
    }

    try {
      const res = await api.get(`/purchase-orders/${activeCompany.id}/${poId}`);
      const poDetails = res.data;

      const grnLines = poDetails.items.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_sku,
        quantityOrdered: parseFloat(item.quantity),
        quantityReceived: parseFloat(item.quantity),
        quantityRejected: 0,
        notes: ''
      }));

      setGrnForm(f => ({
        ...f,
        purchaseOrderId: poId,
        vendorId: poDetails.vendor_id,
        items: grnLines
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...grnForm.items];
    items[idx][field] = value;
    setGrnForm(f => ({ ...f, items }));
  };

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      if (!grnForm.vendorId) throw new Error('Vendor is required.');
      if (!grnForm.warehouseId) throw new Error('Warehouse is required.');
      if (grnForm.items.length === 0) throw new Error('At least one item line is required.');

      const payload = {
        ...grnForm,
        items: grnForm.items.map(i => ({
          productId: i.productId,
          quantityOrdered: parseFloat(i.quantityOrdered),
          quantityReceived: parseFloat(i.quantityReceived || 0),
          quantityRejected: parseFloat(i.quantityRejected || 0),
          notes: i.notes
        }))
      };

      const res = await api.post(`/goods-receipts/${activeCompany.id}`, payload);
      setCreateModal(false);
      loadData();
      handleSelectGrn(res.data);
    } catch (err) {
      setFormError(err.response?.data?.error || err.message);
    }
    setIsSaving(false);
  };

  const handleReceiveGoods = async (id) => {
    if (!window.confirm("Confirm receipt of goods? This will update warehouse stock levels.")) return;
    try {
      const res = await api.post(`/goods-receipts/${activeCompany.id}/${id}/post`);
      loadData();
      setSelectedGrn(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to receive goods.');
    }
  };

  const handleConvertToVoucher = async (id) => {
    try {
      const res = await api.post(`/goods-receipts/${activeCompany.id}/${id}/convert`);
      loadData();
      navigate(`/dashboard/vouchers/details/${res.data.voucherId}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert Goods Receipt to Voucher.');
    }
  };

  // KPI calculations
  const pendingReceipts = receipts.filter(r => r.status === 'DRAFT').length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const receivedToday = receipts.filter(r => r.status === 'RECEIVED' && r.received_date.split('T')[0] === todayStr).length;
  
  const partialReceipts = purchaseOrders.filter(po => po.status === 'PARTIALLY_RECEIVED').length;
  
  const awaitingInvoice = receipts.filter(r => r.status === 'RECEIVED' && !r.relatedVoucher).length;

  const filteredGrns = receipts.filter(r => {
    const matchesSearch = r.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.vendor_name && r.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.supplier_reference && r.supplier_reference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans pb-20">
      
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Goods Receipts (GRN)</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Operations</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Verify vendor shipments, manage warehouse intake quantities, and restock inventory.
            </p>
          </div>
        </div>

        <button 
          onClick={() => {
            setGrnForm({
              purchaseOrderId: '',
              vendorId: '',
              warehouseId: warehouses[0]?.id || '',
              receivedDate: new Date().toISOString().split('T')[0],
              supplierReference: '',
              notes: '',
              items: []
            });
            setCreateModal(true);
          }}
          className="mt-3 md:mt-0 flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={14} /> Receive Goods
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock size={20} />
          </div>
          <div>
            <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Pending Receipts</span>
            <span className="text-[20px] font-black text-slate-800">{pendingReceipts}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Received Today</span>
            <span className="text-[20px] font-black text-slate-800">{receivedToday}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Layers size={20} />
          </div>
          <div>
            <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Partial Receipts</span>
            <span className="text-[20px] font-black text-slate-800">{partialReceipts}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <FileText size={20} />
          </div>
          <div>
            <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Invoice</span>
            <span className="text-[20px] font-black text-slate-800">{awaitingInvoice}</span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-9 text-[13px] py-2.5" 
            placeholder="Search GRN No, supplier ref, vendor name..." 
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
          <option value="RECEIVED">Goods Received</option>
        </select>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Table List Card */}
        <div className="card overflow-hidden lg:col-span-8 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F0F4F1', borderBottom: '2px solid #D5DDD6' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">GRN Number</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Vendor</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Warehouse</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Received Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Supplier Reference</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE8] text-[13px] text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-350" /> Loading goods receipts...
                    </td>
                  </tr>
                ) : filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 italic">No goods receipts found.</td>
                  </tr>
                ) : filteredGrns.map(gr => {
                  const statusConf = STATUS_CONFIG[gr.status] || { label: gr.status, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
                  
                  return (
                    <tr key={gr.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => handleSelectGrn(gr)}>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#2E4D3F]">{gr.grn_number}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{gr.vendor_name}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-650">{gr.warehouse_name}</td>
                      <td className="px-4 py-3.5 font-mono">{new Date(gr.received_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3.5 text-slate-600 font-semibold">{gr.supplier_reference || 'N/A'}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusConf.bg}`}>
                          {statusConf.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Sidebar Drawer */}
        <div className="lg:col-span-4 space-y-6">
          {selectedGrn ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
                <div>
                  <h3 className="font-mono font-black text-slate-850 text-[15px]">{selectedGrn.grn_number}</h3>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Goods Receipt Note</p>
                </div>
                <button onClick={() => setSelectedGrn(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-50 border-none bg-transparent cursor-pointer"><X size={15} /></button>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-[12px] text-slate-600 border-b border-slate-100 pb-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vendor</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedGrn.vendor_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warehouse</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedGrn.warehouse_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Supplier Ref / Challan</span>
                  <span className="font-bold text-slate-800 mt-0.5 block font-mono">{selectedGrn.supplier_reference || 'None'}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Received Date</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{new Date(selectedGrn.received_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Received By</span>
                  <span className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                    <User size={12} className="text-slate-400" />
                    {selectedGrn.received_by_name || 'System'}
                  </span>
                </div>
              </div>

              {selectedGrn.notes && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Notes</span>
                  <p className="text-[12px] italic text-slate-650 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">{selectedGrn.notes}</p>
                </div>
              )}

              {/* Items grid */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Verified Quantities</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden text-[11.5px] bg-white">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Product</th>
                        <th className="px-2 py-2 text-right">Ordered</th>
                        <th className="px-2 py-2 text-right">Recv</th>
                        <th className="px-2 py-2 text-right">Rej</th>
                        <th className="px-2 py-2 text-right text-indigo-600">Rem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {selectedGrn.items?.map((item, idx) => {
                        const ordered = parseFloat(item.quantity_ordered);
                        const received = parseFloat(item.quantity_received);
                        const rejected = parseFloat(item.quantity_rejected);
                        const remaining = Math.max(0, ordered - received - rejected);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/30">
                            <td className="px-2.5 py-2">
                              <span className="block font-bold text-slate-800">{item.product_name}</span>
                              {item.notes && <span className="block text-[9.5px] text-red-500 italic">Rej: {item.notes}</span>}
                            </td>
                            <td className="px-2 py-2 text-right font-mono">{ordered}</td>
                            <td className="px-2 py-2 text-right font-mono text-emerald-600 font-bold">{received}</td>
                            <td className="px-2 py-2 text-right font-mono text-red-500">{rejected}</td>
                            <td className={`px-2 py-2 text-right font-mono font-bold ${remaining > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {remaining}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Journey timeline */}
              {(() => {
                const relatedDocs = [];
                if (selectedGrn.relatedPo) {
                  relatedDocs.push({
                    type: 'PURCHASE_ORDER',
                    id: selectedGrn.relatedPo.id,
                    number: selectedGrn.relatedPo.po_number,
                    status: selectedGrn.relatedPo.status,
                    created_at: selectedGrn.relatedPo.created_at,
                    creator_name: selectedGrn.relatedPo.creator_name,
                    link: `/dashboard/purchase-orders?id=${selectedGrn.relatedPo.id}`
                  });

                  if (selectedGrn.relatedPo.purchase_requisition_id) {
                    relatedDocs.push({
                      type: 'PURCHASE_REQUISITION',
                      id: selectedGrn.relatedPo.purchase_requisition_id,
                      number: 'Source Requisition',
                      status: 'CONVERTED_TO_PO',
                      link: `/dashboard/purchase-requisitions?id=${selectedGrn.relatedPo.purchase_requisition_id}`
                    });
                  }
                }
                if (selectedGrn.relatedVoucher) {
                  relatedDocs.push({
                    type: 'VOUCHER',
                    id: selectedGrn.relatedVoucher.id,
                    number: selectedGrn.relatedVoucher.voucher_number,
                    status: selectedGrn.relatedVoucher.status,
                    created_at: selectedGrn.relatedVoucher.created_at,
                    creator_name: selectedGrn.relatedVoucher.creator_name,
                    link: `/dashboard/vouchers/details/${selectedGrn.relatedVoucher.id}`
                  });
                }
                return <RelatedDocuments documents={relatedDocs} currentType="DELIVERY" />; // Injected as Delivery to map correctly
              })()}

              {/* Next Action Cards */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {selectedGrn.status === 'DRAFT' && (
                  <button 
                    onClick={() => handleReceiveGoods(selectedGrn.id)}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                  >
                    <CheckCircle size={14} /> Receive Goods
                  </button>
                )}
                {selectedGrn.status === 'RECEIVED' && !selectedGrn.relatedVoucher && (
                  <div className="bg-indigo-50/50 border border-indigo-150 p-3.5 rounded-2xl space-y-2 shadow-sm">
                    <span className="block text-[10px] font-black uppercase text-indigo-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Confirm receiving of physical inventory. Generate the Purchase Voucher to post financial journal entries to Ledger.
                    </p>
                    <button 
                      onClick={() => handleConvertToVoucher(selectedGrn.id)}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer border-none mt-1"
                    >
                      Create Purchase Voucher
                    </button>
                  </div>
                )}
                {selectedGrn.status === 'RECEIVED' && selectedGrn.relatedVoucher && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[12px] font-semibold text-slate-650">
                    <span>Voucher created successfully</span>
                    <button 
                      onClick={() => navigate(`/dashboard/vouchers/details/${selectedGrn.relatedVoucher.id}`)}
                      className="text-[11.5px] font-bold text-emerald-600 border-none bg-transparent cursor-pointer hover:underline flex items-center gap-0.5"
                    >
                      Open Voucher <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400 italic text-[12.5px] shadow-inner select-none">
              <Package size={30} className="mx-auto mb-2 text-slate-300 opacity-60" />
              Select a receipt from the list to display details, verified quantities, and conversion actions.
            </div>
          )}
        </div>
      </div>

      {/* ─── New Goods Receipt Modal ─── */}
      {createModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="font-display font-extrabold text-[16px] text-slate-900">Goods Receipt Note (GRN)</h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">Receive supplier shipments, check quantity ordered, and log rejected units.</p>
              </div>
              <button 
                onClick={() => setCreateModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-650 font-medium">
                  <AlertTriangle size={14} className="text-red-500" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Reference Purchase Order</label>
                  <select 
                    className="input-enterprise" 
                    value={grnForm.purchaseOrderId} 
                    onChange={e => handlePoChange(e.target.value)}
                  >
                    <option value="">— Create Direct Receipt —</option>
                    {purchaseOrders.map(po => <option key={po.id} value={po.id}>{po.po_number} - {po.vendor_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Vendor / Supplier *</label>
                  <select 
                    required 
                    disabled={!!grnForm.purchaseOrderId}
                    className="input-enterprise" 
                    value={grnForm.vendorId} 
                    onChange={e => setGrnForm({ ...grnForm, vendorId: e.target.value })}
                  >
                    <option value="">— Choose vendor —</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="field-label">Target Warehouse *</label>
                  <select 
                    required
                    className="input-enterprise" 
                    value={grnForm.warehouseId} 
                    onChange={e => setGrnForm({ ...grnForm, warehouseId: e.target.value })}
                  >
                    <option value="">— Choose warehouse —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Received Date *</label>
                  <input 
                    type="date" 
                    required
                    className="input-enterprise font-mono" 
                    value={grnForm.receivedDate} 
                    onChange={e => setGrnForm({ ...grnForm, receivedDate: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="field-label">Supplier Challan / Ref</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. Challan #4521" 
                    value={grnForm.supplierReference} 
                    onChange={e => setGrnForm({ ...grnForm, supplierReference: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Receipt Notes</label>
                <input 
                  className="input-enterprise" 
                  placeholder="e.g. Received undamaged, logged 2 cracked units" 
                  value={grnForm.notes} 
                  onChange={e => setGrnForm({ ...grnForm, notes: e.target.value })} 
                />
              </div>

              {/* Items grid */}
              {grnForm.items.length > 0 && (
                <div className="space-y-2">
                  <label className="field-label font-bold text-slate-800 uppercase tracking-wider text-[10.5px]">Product Quantities Checklist</label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <div className="min-w-[700px] divide-y divide-slate-100 text-[12px] bg-white">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-3.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[9.5px] font-black uppercase tracking-widest text-slate-500">
                          <div className="col-span-4">Product</div>
                          <div className="col-span-2 text-right">Ordered</div>
                          <div className="col-span-2 text-right">Received *</div>
                          <div className="col-span-2 text-right">Rejected</div>
                          <div className="col-span-2 text-right text-indigo-600">Remaining</div>
                        </div>

                        {/* Rows */}
                        {grnForm.items.map((item, idx) => {
                          const ordered = parseFloat(item.quantityOrdered);
                          const received = parseFloat(item.quantityReceived || 0);
                          const rejected = parseFloat(item.quantityRejected || 0);
                          const remaining = Math.max(0, ordered - received - rejected);

                          return (
                            <div key={idx} className="grid grid-cols-12 gap-3.5 px-4 py-2.5 items-center hover:bg-slate-50/30">
                              <div className="col-span-4">
                                <span className="block font-bold text-slate-800">{item.productName}</span>
                                <span className="block text-[10px] text-slate-400 font-mono">{item.productSku}</span>
                              </div>
                              <div className="col-span-2 text-right font-mono font-bold text-slate-650">{ordered}</div>
                              <div className="col-span-2">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  required 
                                  placeholder="0.00" 
                                  className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                                  value={item.quantityReceived} 
                                  onChange={e => handleItemChange(idx, 'quantityReceived', e.target.value)} 
                                />
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="0.00" 
                                  className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                                  value={item.quantityRejected} 
                                  onChange={e => handleItemChange(idx, 'quantityRejected', e.target.value)} 
                                />
                              </div>
                              <div className="col-span-2 text-right font-mono font-bold text-indigo-600">{remaining}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  {isSaving ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : 'Save Goods Receipt Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
