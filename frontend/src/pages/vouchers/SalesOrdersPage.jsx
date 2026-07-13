import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, FileText, CheckCircle, RefreshCw, X, Calendar, User, ArrowRight, Package, AlertTriangle, ChevronRight, ShoppingBag, Layers, Truck, CheckCircle2, Clock } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-50 text-slate-700 border border-slate-100' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50 text-blue-700 border border-blue-100' },
  PICKING: { label: 'Picking', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  PACKED: { label: 'Packed', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  READY_FOR_DISPATCH: { label: 'Ready for Dispatch', bg: 'bg-orange-50 text-orange-700 border border-orange-100' },
  DISPATCHED: { label: 'Dispatched', bg: 'bg-orange-50 text-orange-700 border border-orange-100' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-100 text-slate-600 border border-slate-200' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border border-rose-150' }
};

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { activeCompany } = useAuthStore();

  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [soForm, setSoForm] = useState({
    clientId: '',
    warehouseId: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' }]
  });

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [ordersRes, clientsRes, whRes, prodRes] = await Promise.all([
        api.get(`/sales-orders/${activeCompany.id}`),
        api.get(`/clients/${activeCompany.id}`),
        api.get(`/warehouses/${activeCompany.id}`),
        api.get(`/products/${activeCompany.id}`)
      ]);
      setOrders(ordersRes.data);
      setClients(clientsRes.data.filter(c => c.is_active));
      setWarehouses(whRes.data.filter(w => w.is_active));
      setProducts(prodRes.data.filter(p => p.is_active));
    } catch (err) {
      console.error('Failed to load sales orders data:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Deep linking support
  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get('id') || params.get('open');
    if (id && orders.length > 0) {
      const match = orders.find(o => String(o.id) === String(id));
      if (match) handleSelectOrder(match);
    }
  }, [search, orders]);

  const handleSelectOrder = async (order) => {
    setSelectedOrder(null);
    try {
      const res = await api.get(`/sales-orders/${activeCompany.id}/${order.id}`);
      setSelectedOrder(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProductChange = (idx, prodId) => {
    const matched = products.find(p => String(p.id) === String(prodId));
    const items = [...soForm.items];
    items[idx].productId = prodId;
    items[idx].unitPrice = matched ? parseFloat(matched.unit_price) : 0;
    setSoForm({ ...soForm, items });
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...soForm.items];
    items[idx][field] = value;
    setSoForm({ ...soForm, items });
  };

  const handleAddItem = () => {
    setSoForm({
      ...soForm,
      items: [...soForm.items, { productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' }]
    });
  };

  const handleRemoveItem = (idx) => {
    if (soForm.items.length === 1) return;
    setSoForm({
      ...soForm,
      items: soForm.items.filter((_, i) => i !== idx)
    });
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      if (!soForm.clientId) throw new Error('Customer is required.');
      if (!soForm.warehouseId) throw new Error('Warehouse is required.');
      if (soForm.items.some(i => !i.productId)) throw new Error('All item lines must have a selected product.');

      const payload = {
        ...soForm,
        items: soForm.items.map(i => ({
          productId: parseInt(i.productId),
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unitPrice),
          discount: parseFloat(i.discount || 0),
          notes: i.notes
        }))
      };

      const res = await api.post(`/sales-orders/${activeCompany.id}`, payload);
      setCreateModal(false);
      loadData();
      handleSelectOrder(res.data);
    } catch (err) {
      setFormError(err.response?.data?.error || err.message);
    }
    setIsSaving(false);
  };

  const handleConfirmOrder = async (id) => {
    try {
      const res = await api.post(`/sales-orders/${activeCompany.id}/${id}/confirm`);
      loadData();
      setSelectedOrder(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm Sales Order.');
    }
  };

  const handleCreateInvoice = async (id) => {
    try {
      const res = await api.post(`/sales-orders/${activeCompany.id}/${id}/convert`);
      loadData();
      navigate(`/dashboard/vouchers/details/${res.data.voucherId}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to invoice Sales Order.');
    }
  };

  // KPI summaries
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysOrders = orders.filter(o => o.delivery_date.split('T')[0] === todayStr || o.created_at.split('T')[0] === todayStr).length;
  const pickingCount = orders.filter(o => o.status === 'PICKING').length;
  const readyCount = orders.filter(o => o.status === 'READY_FOR_DISPATCH' || o.status === 'PACKED').length;
  const dispatchedCount = orders.filter(o => o.status === 'DISPATCHED').length;
  const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length;

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.notes && o.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans pb-20">
      
      {/* Title Block */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900 tracking-tight">Sales Orders</h1>
          <p className="text-[12.5px] text-slate-500 mt-1">Book customer orders, lock in pricing snapshots, and dispatch warehouse shipments.</p>
        </div>
        <button 
          onClick={() => {
            setSoForm({
              clientId: '',
              warehouseId: warehouses[0]?.id || '',
              deliveryDate: new Date().toISOString().split('T')[0],
              notes: '',
              items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' }]
            });
            setCreateModal(true);
          }}
          className="btn btn-primary px-4.5 py-2.5 rounded-xl shadow-sm text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer hover:shadow"
        >
          <Plus size={14} /> New Sales Order
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <ShoppingBag size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Today's Orders</span>
            <span className="text-[17px] font-black text-slate-800">{todaysOrders}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <Clock size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Picking</span>
            <span className="text-[17px] font-black text-slate-800">{pickingCount}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Layers size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Ready to Ship</span>
            <span className="text-[17px] font-black text-slate-800">{readyCount}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600">
            <Truck size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Dispatched</span>
            <span className="text-[17px] font-black text-slate-800">{dispatchedCount}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Delivered</span>
            <span className="text-[17px] font-black text-slate-800">{deliveredCount}</span>
          </div>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-9 text-[13px] py-2.5" 
            placeholder="Search SO Number, customer name, notes..." 
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
          {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {/* Workspace Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Table List Card */}
        <div className="card overflow-hidden lg:col-span-8 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F5F5FA', borderBottom: '2px solid #D5D5E0' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E2E4D] text-left">SO Number</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E2E4D] text-left">Customer</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E2E4D] text-left">Warehouse</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E2E4D] text-left">Delivery Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E2E4D] text-right">Total Amount</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E2E4D] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6EB] text-[13px] text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-300" /> Loading orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 italic">No sales orders found.</td>
                  </tr>
                ) : filteredOrders.map(so => {
                  const statusConf = STATUS_CONFIG[so.status] || { label: so.status, bg: 'bg-slate-50' };
                  
                  return (
                    <tr key={so.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => handleSelectOrder(so)}>
                      <td className="px-4 py-3.5 font-mono font-bold text-indigo-600">{so.so_number}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{so.client_name}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-650">{so.warehouse_name}</td>
                      <td className="px-4 py-3.5 font-mono">{new Date(so.delivery_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-850">
                        PKR {parseFloat(so.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
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

        {/* Details Drawer */}
        <div className="lg:col-span-4 space-y-6">
          {selectedOrder ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-mono font-black text-slate-850 text-[15px]">{selectedOrder.so_number}</h3>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Sales Order Details</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-50 border-none bg-transparent cursor-pointer"><X size={15} /></button>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-[12px] text-slate-600 border-b border-slate-100 pb-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrder.client_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fulfillment Warehouse</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrder.warehouse_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Delivery Target Date</span>
                  <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                    {new Date(selectedOrder.delivery_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Booked By</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrder.creator_name || 'System'}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order Notes</span>
                  <p className="text-[12px] italic text-slate-650 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order Items</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden text-[11.5px] bg-white">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Product</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30">
                          <td className="px-2.5 py-2">
                            <span className="block font-bold text-slate-800">{item.product_name}</span>
                            <span className="block text-[9px] text-slate-400 font-mono">{item.product_sku}</span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono">{parseFloat(item.quantity)}</td>
                          <td className="px-2 py-2 text-right font-mono">
                            {parseFloat(item.unit_price).toFixed(2)}
                            {parseFloat(item.discount) > 0 && <span className="block text-[9.5px] text-red-500 font-bold font-sans">-${parseFloat(item.discount).toFixed(2)}</span>}
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-slate-800">{parseFloat(item.line_total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between font-bold text-[13px] pt-1.5">
                  <span className="text-slate-650">Total Amount</span>
                  <span className="font-mono text-slate-900">PKR {parseFloat(selectedOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Journey Timeline */}
              {(() => {
                const relatedDocs = [];
                relatedDocs.push({
                  type: 'PURCHASE_ORDER', // visual map to sales order
                  id: selectedOrder.id,
                  number: selectedOrder.so_number,
                  status: selectedOrder.status,
                  created_at: selectedOrder.created_at,
                  creator_name: selectedOrder.creator_name,
                  link: `/dashboard/sales-orders?id=${selectedOrder.id}`
                });

                if (selectedOrder.relatedDelivery) {
                  relatedDocs.push({
                    type: 'DELIVERY',
                    id: selectedOrder.relatedDelivery.id,
                    number: selectedOrder.relatedDelivery.delivery_number,
                    status: selectedOrder.relatedDelivery.status,
                    created_at: selectedOrder.relatedDelivery.created_at,
                    creator_name: selectedOrder.relatedDelivery.creator_name,
                    link: `/dashboard/distribution?id=${selectedOrder.relatedDelivery.id}`
                  });
                }
                if (selectedOrder.relatedVoucher) {
                  relatedDocs.push({
                    type: 'VOUCHER',
                    id: selectedOrder.relatedVoucher.id,
                    number: selectedOrder.relatedVoucher.voucher_number,
                    status: selectedOrder.relatedVoucher.status,
                    created_at: selectedOrder.relatedVoucher.created_at,
                    creator_name: selectedOrder.relatedVoucher.creator_name,
                    link: `/dashboard/vouchers/details/${selectedOrder.relatedVoucher.id}`
                  });
                }
                return <RelatedDocuments documents={relatedDocs} currentType="PURCHASE_ORDER" />; // Injected as purchase order to map Sales Order correctly
              })()}

              {/* Next Action CTA Card */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {selectedOrder.status === 'DRAFT' && (
                  <button 
                    onClick={() => handleConfirmOrder(selectedOrder.id)}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-blue-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                  >
                    Confirm Order
                  </button>
                )}
                {['CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH'].includes(selectedOrder.status) && (
                  <div className="bg-amber-50/50 border border-amber-150 p-3.5 rounded-2xl space-y-2.5 shadow-sm text-left">
                    <span className="block text-[10px] font-black uppercase text-amber-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      This order is ready for logistics preparation. Go to the warehouse **Order Tracking** workspace to perform picking, packing, and dispatch operations.
                    </p>
                    <button 
                      onClick={() => navigate('/dashboard/order-tracking')}
                      className="w-full py-2 bg-amber-600 text-white rounded-xl text-[12px] font-bold shadow-sm hover:bg-amber-700 transition cursor-pointer border-none flex items-center justify-center gap-0.5"
                    >
                      Open Order Tracking <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'DISPATCHED' && (
                  <div className="bg-orange-50/50 border border-orange-150 p-3.5 rounded-2xl space-y-2 shadow-sm text-left">
                    <span className="block text-[10px] font-black uppercase text-orange-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Order is in transit. Go to the **Order Tracking** workspace to confirm receipt and mark as Delivered.
                    </p>
                    <button 
                      onClick={() => navigate('/dashboard/order-tracking')}
                      className="w-full py-2 bg-orange-600 text-white rounded-xl text-[12px] font-bold shadow-sm hover:bg-orange-700 transition cursor-pointer border-none mt-1"
                    >
                      Open Order Tracking
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'DELIVERED' && !selectedOrder.relatedVoucher && (
                  <div className="bg-indigo-50/50 border border-indigo-150 p-3.5 rounded-2xl space-y-2 shadow-sm text-left">
                    <span className="block text-[10px] font-black uppercase text-indigo-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Fulfillment is complete. Generate the financial Sales Invoice Voucher to post revenue and account receivables to the General Ledger.
                    </p>
                    <button 
                      onClick={() => handleCreateInvoice(selectedOrder.id)}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer border-none mt-1"
                    >
                      Create Sales Invoice
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'CLOSED' && selectedOrder.relatedVoucher && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[12px] font-semibold text-slate-650">
                    <span>Invoice generated successfully</span>
                    <button 
                      onClick={() => navigate(`/dashboard/vouchers/details/${selectedOrder.relatedVoucher.id}`)}
                      className="text-[11.5px] font-bold text-[#0284c7] border-none bg-transparent cursor-pointer hover:underline flex items-center gap-0.5"
                    >
                      Open Invoice <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400 italic text-[12.5px] shadow-inner select-none">
              <ShoppingBag size={30} className="mx-auto mb-2 text-slate-300 opacity-60" />
              Select a Sales Order from the list to display details, prices snapshot, and next action workflows.
            </div>
          )}
        </div>
      </div>

      {/* ─── New Sales Order Modal ─── */}
      {createModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="font-display font-extrabold text-[16px] text-slate-900">New Sales Order</h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">Create customer order bookings and lock in transaction prices.</p>
              </div>
              <button 
                onClick={() => setCreateModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-650 font-medium">
                  <AlertTriangle size={14} className="text-red-500" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Customer / Client *</label>
                  <select 
                    required 
                    className="input-enterprise" 
                    value={soForm.clientId} 
                    onChange={e => setSoForm({ ...soForm, clientId: e.target.value })}
                  >
                    <option value="">— Select Customer —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Warehouse (Stock Reserve Target) *</label>
                  <select 
                    required 
                    className="input-enterprise" 
                    value={soForm.warehouseId} 
                    onChange={e => setSoForm({ ...soForm, warehouseId: e.target.value })}
                  >
                    <option value="">— Select Warehouse —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Requested Delivery Date *</label>
                  <input 
                    type="date" 
                    required
                    className="input-enterprise font-mono" 
                    value={soForm.deliveryDate} 
                    onChange={e => setSoForm({ ...soForm, deliveryDate: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="field-label">Reference Notes</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. Po Ref #9932, urgent dispatch request" 
                    value={soForm.notes} 
                    onChange={e => setSoForm({ ...soForm, notes: e.target.value })} 
                  />
                </div>
              </div>

              {/* Items checklist */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="field-label font-bold text-slate-800 uppercase tracking-wider text-[10.5px]">Order Line Items</label>
                  <button 
                    type="button" 
                    onClick={handleAddItem}
                    className="text-[11.5px] font-bold text-indigo-650 hover:underline border-none bg-transparent cursor-pointer flex items-center gap-0.5"
                  >
                    + Add Product Line
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-[12px] bg-white">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="px-3 py-2 text-left">Product *</th>
                        <th className="px-3 py-2 text-right w-24">Qty *</th>
                        <th className="px-3 py-2 text-right w-28">Price *</th>
                        <th className="px-3 py-2 text-right w-24">Discount</th>
                        <th className="px-3 py-2 text-right w-28">Total</th>
                        <th className="px-3 py-2 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {soForm.items.map((item, idx) => {
                        const qty = parseFloat(item.quantity || 0);
                        const price = parseFloat(item.unitPrice || 0);
                        const disc = parseFloat(item.discount || 0);
                        const total = (qty * price) - disc;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/20">
                            <td className="p-2">
                              <select 
                                required
                                className="input-enterprise py-1.5 text-[12px]" 
                                value={item.productId}
                                onChange={e => handleProductChange(idx, e.target.value)}
                              >
                                <option value="">— Select —</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                required
                                min="0.0001"
                                step="0.0001"
                                className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                                value={item.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                required
                                step="0.01"
                                className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                                value={item.unitPrice}
                                onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                step="0.01"
                                className="input-enterprise py-1.5 font-mono text-[12px] text-right text-red-500" 
                                value={item.discount}
                                onChange={e => handleItemChange(idx, 'discount', e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-800">${total.toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <button 
                                type="button" 
                                disabled={soForm.items.length === 1}
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-red-500 disabled:opacity-30 border-none bg-transparent cursor-pointer"
                              >
                                <X size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                  {isSaving ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : 'Save Sales Order Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
