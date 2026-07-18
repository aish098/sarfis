import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, FileText, CheckCircle, RefreshCw, X, Calendar, User, ArrowRight, Package, AlertTriangle, ChevronRight, ShoppingBag, Layers, Truck, CheckCircle2, Clock, Printer } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import SubledgerDrawer from '../../components/SubledgerDrawer';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-50 text-slate-700 border border-slate-100' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50 text-blue-700 border border-blue-100' },
  PICKING: { label: 'Picking', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  PACKED: { label: 'Packed', bg: 'bg-amber-50 text-amber-700 border border-amber-100' },
  READY_FOR_DISPATCH: { label: 'Ready for Dispatch', bg: 'bg-orange-50 text-orange-700 border border-orange-100' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered', bg: 'bg-amber-100 text-amber-800 border border-amber-200' },
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
  const [selectedSubledgerPartner, setSelectedSubledgerPartner] = useState(null);
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

  const printAreaRef = useRef(null);

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

  const triggerPrintInvoice = () => {
    const printContent = printAreaRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // KPI summaries
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysOrders = orders.filter(o => o.delivery_date.split('T')[0] === todayStr || o.created_at.split('T')[0] === todayStr).length;
  const pickingCount = orders.filter(o => o.status === 'PICKING').length;
  const readyCount = orders.filter(o => o.status === 'READY_FOR_DISPATCH' || o.status === 'PACKED').length;
  const partialCount = orders.filter(o => o.status === 'PARTIALLY_DELIVERED').length;
  const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length;

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.notes && o.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const kpiList = [
    { label: "Today's Orders", value: todaysOrders, icon: ShoppingBag, iconBgClass: 'bg-blue-50', iconColorClass: 'text-blue-650' },
    { label: 'Picking', value: pickingCount, icon: Clock, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600' },
    { label: 'Ready to Ship', value: readyCount, icon: Layers, iconBgClass: 'bg-indigo-50', iconColorClass: 'text-indigo-655' },
    { label: 'Partial', value: partialCount, icon: Truck, iconBgClass: 'bg-orange-50', iconColorClass: 'text-orange-655' },
    { label: 'Delivered', value: deliveredCount, icon: CheckCircle2, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' }
  ];

  return (
    <>
      {/* Hidden Printable Invoice template */}
      <div style={{ display: 'none' }}>
        <div ref={printAreaRef} className="p-8 max-w-4xl mx-auto text-black font-sans text-xs space-y-6">
          {selectedOrder && (
            <>
              <div className="flex justify-between border-b pb-5">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider">{activeCompany?.name || 'ACCOUNTELLENCE ERP'}</h1>
                  <p className="text-slate-500">Corporate Sales Invoice</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-indigo-750">SALES INVOICE</h2>
                  <p className="font-mono">Invoice #: INV-{selectedOrder.so_number.replace('SO-', '')}</p>
                  <p className="text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Customer Billing Address</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedOrder.client_name}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Source Details</span>
                  <span className="text-slate-700">Order Reference: {selectedOrder.so_number}</span>
                  <span className="block text-slate-700">Fulfillment Warehouse: {selectedOrder.warehouse_name}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold border-b">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Disc.</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {selectedOrder.items?.map(i => (
                      <tr key={i.id} className="border-b">
                        <td className="p-3 font-semibold">{i.product_name}</td>
                        <td className="p-3 text-right">{parseFloat(i.quantity)}</td>
                        <td className="p-3 text-right font-mono">${parseFloat(i.unit_price).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-red-500">-${parseFloat(i.discount || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-bold">${parseFloat(i.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-64 space-y-1.5 text-right font-bold text-sm">
                  <div className="flex justify-between border-b pb-1 text-slate-500">
                    <span>Subtotal</span>
                    <span>${parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1 text-slate-500">
                    <span>Tax (0%)</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900">
                    <span>Total Invoice Amount</span>
                    <span>PKR {parseFloat(selectedOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="pt-20 text-center text-slate-400 text-[10px]">
                Thank you for your business! Please pay within payment term agreements.
              </div>
            </>
          )}
        </div>
      </div>

      <WorkspaceLayout
        title="Sales Orders"
        subtitle="Book customer orders, lock in pricing snapshots, and dispatch warehouse shipments."
        icon={FileText}
        badgeText="Sales"
        breadcrumbs={['ACCOUNTELLENCE', 'Sales', 'Sales Orders']}
        primaryAction={
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
            className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none"
          >
            <Plus size={14} /> New Sales Order
          </button>
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search SO Number, customer name, notes..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={[
          { value: 'DRAFT', label: 'Draft' },
          { value: 'CONFIRMED', label: 'Confirmed' },
          { value: 'PICKING', label: 'Picking' },
          { value: 'PACKED', label: 'Packed' },
          { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
          { value: 'PARTIALLY_DELIVERED', label: 'Partially Delivered' },
          { value: 'DELIVERED', label: 'Delivered' },
          { value: 'CLOSED', label: 'Closed' }
        ]}
        kpis={kpiList}
      >
        
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
                        <StatusBadge status={so.status} />
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
                  <h3 className="font-mono font-black text-slate-850 text-[15px] flex items-center gap-2">
                    {selectedOrder.so_number}
                    <StatusBadge status={selectedOrder.status} />
                  </h3>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Sales Order Details</p>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={triggerPrintInvoice}
                    className="text-slate-500 hover:text-slate-750 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-50 border-none bg-transparent cursor-pointer"
                    title="Print Invoice"
                  >
                    <Printer size={15} />
                  </button>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-50 border-none bg-transparent cursor-pointer"><X size={15} /></button>
                </div>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-[12px] text-slate-600 border-b border-slate-100 pb-4">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSubledgerPartner({
                      id: selectedOrder.client_id,
                      type: 'CUSTOMER',
                      name: selectedOrder.client_name,
                      virtualCode: `CUS-${String(selectedOrder.client_id).padStart(4, '0')}`
                    })}
                    className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 block text-left bg-transparent border-none p-0 cursor-pointer"
                  >
                    {selectedOrder.client_name}
                  </button>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warehouse</span>
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
                  <p className="text-[12px] italic text-slate-655 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Fulfillment Summary with Progress Bar */}
              <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100 space-y-2.5">
                <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Fulfillment Summary</span>
                <div className="grid grid-cols-4 text-center text-[12px] font-bold text-slate-700">
                  <div>
                    <span className="block text-[9px] uppercase font-medium text-slate-400">Ordered</span>
                    <span>{selectedOrder.total_ordered}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-medium text-slate-400">Dispatched</span>
                    <span className="text-emerald-600">{selectedOrder.total_dispatched}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-medium text-slate-400">Remaining</span>
                    <span className="text-amber-605">{selectedOrder.total_remaining}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-medium text-slate-400">Shipments</span>
                    <span className="text-indigo-650">{selectedOrder.deliveriesList?.length || 0}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-655">
                    <span>Fulfillment Completion Rate</span>
                    <span>{selectedOrder.completion_rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${selectedOrder.completion_rate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Delivery History List */}
              {selectedOrder.deliveriesList && selectedOrder.deliveriesList.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Shipment Deliveries History</span>
                  <div className="space-y-2">
                    {selectedOrder.deliveriesList.map((del, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-[11.5px] hover:bg-slate-100/50 transition">
                        <div>
                          <span className="font-mono font-bold text-slate-800 block">{del.delivery_number}</span>
                          <span className="text-slate-500 text-[10px] block mt-0.5">
                            {new Date(del.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • Driver: {del.driver_name || 'N/A'} • Vehicle: {del.vehicle_number || 'N/A'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded-full text-[9px] uppercase tracking-wide border border-emerald-100">{del.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items List with Ordered, Dispatched, Remaining columns */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order Line Items</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px] bg-white">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Product</th>
                        <th className="px-2 py-2 text-right">Ord</th>
                        <th className="px-2 py-2 text-right">Disp</th>
                        <th className="px-2 py-2 text-right">Rem</th>
                        <th className="px-2.5 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {selectedOrder.items?.map((item, idx) => {
                        const remaining = parseFloat(item.quantity) - parseFloat(item.quantity_dispatched || 0);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/30">
                            <td className="px-2.5 py-2">
                              <span className="block font-bold text-slate-800">{item.product_name}</span>
                              <span className="block text-[9px] text-slate-400 font-mono">{item.product_sku}</span>
                            </td>
                            <td className="px-2 py-2 text-right font-mono">{parseFloat(item.quantity)}</td>
                            <td className="px-2 py-2 text-right font-mono text-emerald-600">{parseFloat(item.quantity_dispatched)}</td>
                            <td className="px-2 py-2 text-right font-mono text-amber-600">{remaining}</td>
                            <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-800">${parseFloat(item.line_total).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between font-bold text-[13px] pt-1.5">
                  <span className="text-slate-655">Total Amount</span>
                  <span className="font-mono text-slate-900">PKR {parseFloat(selectedOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Journey Timeline */}
              {(() => {
                const relatedDocs = [];
                relatedDocs.push({
                  type: 'SALES_ORDER',
                  id: selectedOrder.id,
                  number: selectedOrder.so_number,
                  status: selectedOrder.status,
                  created_at: selectedOrder.created_at,
                  creator_name: selectedOrder.creator_name,
                  link: `/dashboard/sales-orders?id=${selectedOrder.id}`
                });

                if (selectedOrder.deliveriesList) {
                  selectedOrder.deliveriesList.forEach(d => {
                    relatedDocs.push({
                      type: 'DELIVERY',
                      id: d.id,
                      number: d.delivery_number,
                      status: d.status,
                      created_at: d.created_at,
                      creator_name: d.creator_name,
                      link: `/dashboard/distribution?id=${d.id}`
                    });
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
                return <RelatedDocuments documents={relatedDocs} currentType="SALES_ORDER" />;
              })()}

              {/* Customer Activity Timeline */}
              {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer Activity Timeline</span>
                  <div className="space-y-3.5 border-l border-slate-200 pl-4 py-0.5 relative ml-2">
                    {selectedOrder.timeline.map((item, idx) => (
                      <div key={item.id} className="relative text-[11px]">
                        <span className={`absolute -left-[21.5px] top-0.5 w-3.5 h-3.5 rounded-full border bg-white flex items-center justify-center ${
                          item.action === 'CREATE' ? 'border-blue-400 text-blue-500' :
                          item.action === 'CONFIRM' ? 'border-indigo-400 text-indigo-500' :
                          item.action === 'DISPATCH' ? 'border-orange-400 text-orange-500' :
                          'border-emerald-400 text-emerald-500'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        </span>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">{item.description}</p>
                          <p className="text-[9px] text-slate-400 font-bold">
                            By {item.user_name || 'System'} • {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                {['CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'PARTIALLY_DELIVERED'].includes(selectedOrder.status) && (
                  <div className="bg-amber-50/50 border border-amber-150 p-3.5 rounded-2xl space-y-2.5 shadow-sm text-left">
                    <span className="block text-[10px] font-black uppercase text-amber-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Order is in logistics processing stage. Go to the warehouse **Order Tracking** workspace to update picking, packing, or dispatch shipping.
                    </p>
                    <button 
                      onClick={() => navigate('/dashboard/order-tracking')}
                      className="w-full py-2 bg-amber-600 text-white rounded-xl text-[12px] font-bold shadow-sm hover:bg-amber-700 transition cursor-pointer border-none flex items-center justify-center gap-0.5"
                    >
                      Open Order Tracking <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'DELIVERED' && !selectedOrder.relatedVoucher && (
                  <div className="bg-indigo-50/50 border border-indigo-150 p-3.5 rounded-2xl space-y-2 shadow-sm text-left">
                    <span className="block text-[10px] font-black uppercase text-indigo-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-655 font-semibold leading-relaxed">
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
      </WorkspaceLayout>

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

      <SubledgerDrawer
        isOpen={!!selectedSubledgerPartner}
        onClose={() => setSelectedSubledgerPartner(null)}
        partnerId={selectedSubledgerPartner?.id}
        partnerType={selectedSubledgerPartner?.type}
        companyId={activeCompany?.id}
        virtualCode={selectedSubledgerPartner?.virtualCode}
        partnerName={selectedSubledgerPartner?.name}
        onSaveSuccess={loadOrders}
      />
    </>
  );
}
