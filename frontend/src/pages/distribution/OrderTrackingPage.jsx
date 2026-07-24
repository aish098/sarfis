import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, RefreshCw, X, Truck, Calendar, ArrowRight, User, Package, 
  Box, Layers, Clipboard, ShieldAlert, CheckCircle2, ChevronRight, 
  Inbox, Printer, MapPin, DollarSign, Clock, FileText, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import SubledgerDrawer from '../../components/SubledgerDrawer';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
  PICKING: { label: 'Picking', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  PACKED: { label: 'Packed', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  READY_FOR_DISPATCH: { label: 'Ready for Dispatch', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  DISPATCHED: { label: 'In Transit', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Closed', bg: 'bg-emerald-100/70 text-emerald-800 border-emerald-300' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border-rose-200' }
};

export default function OrderTrackingPage() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedSubledgerPartner, setSelectedSubledgerPartner] = useState(null);

  // Dispatch Modal State
  const [dispatchModal, setDispatchModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    driverName: '',
    vehicleNumber: '',
    courierName: '',
    trackingNumber: '',
    remarks: '',
    items: []
  });

  // Print Modals
  const [printSlipModal, setPrintSlipModal] = useState(null);
  const printAreaRef = useRef(null);

  const loadOrders = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/sales-orders/${activeCompany.id}`);
      setOrders(data);
      if (data.length > 0 && !selectedOrder) {
        // Pre-select first order for rich UI experience
        const { data: firstOrderDetails } = await api.get(`/sales-orders/${activeCompany.id}/${data[0].id}`);
        setSelectedOrder(firstOrderDetails);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSelectOrder = async (order) => {
    try {
      const { data } = await api.get(`/sales-orders/${activeCompany.id}/${order.id}`);
      setSelectedOrder(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdating(true);
    try {
      const { data } = await api.patch(`/sales-orders/${activeCompany.id}/${orderId}/status`, { status: newStatus });
      await loadOrders();
      setSelectedOrder(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update order status.');
    }
    setUpdating(false);
  };

  const openDispatchModal = () => {
    if (!selectedOrder) return;
    const itemsForDispatch = selectedOrder.items.map(item => {
      const remaining = parseFloat(item.quantity) - parseFloat(item.quantity_dispatched || 0);
      return {
        productId: item.product_id,
        name: item.product_name,
        sku: item.product_sku,
        ordered: parseFloat(item.quantity),
        dispatched: parseFloat(item.quantity_dispatched || 0),
        remaining,
        dispatchNow: remaining
      };
    });

    setDispatchForm({
      driverName: '',
      vehicleNumber: '',
      courierName: '',
      trackingNumber: '',
      remarks: '',
      items: itemsForDispatch
    });
    setDispatchModal(true);
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const payload = {
        status: 'DISPATCHED',
        dispatchPayload: {
          driverName: dispatchForm.driverName,
          vehicleNumber: dispatchForm.vehicleNumber,
          courierName: dispatchForm.courierName,
          trackingNumber: dispatchForm.trackingNumber,
          remarks: dispatchForm.remarks,
          dispatchItems: dispatchForm.items.map(i => ({
            productId: i.productId,
            quantityToDispatch: parseFloat(i.dispatchNow)
          }))
        }
      };

      const { data } = await api.patch(`/sales-orders/${activeCompany.id}/${selectedOrder.id}/status`, payload);
      setDispatchModal(false);
      await loadOrders();
      setSelectedOrder(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to dispatch shipment.');
    }
    setUpdating(false);
  };

  const triggerBrowserPrint = () => {
    const printContent = printAreaRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const filteredOrders = orders.filter(o => {
    if (o.status === 'CANCELLED') return false;
    return o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.warehouse_name && o.warehouse_name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const getOrdersByColumn = (colType) => {
    return filteredOrders.filter(o => {
      if (colType === 'WAITING') return ['CONFIRMED', 'DRAFT'].includes(o.status);
      if (colType === 'PICKING') return ['PICKING', 'PACKED'].includes(o.status);
      if (colType === 'READY') return o.status === 'READY_FOR_DISPATCH';
      if (colType === 'DISPATCHED') return ['DISPATCHED', 'PARTIALLY_DELIVERED'].includes(o.status);
      if (colType === 'DELIVERED') return ['DELIVERED', 'CLOSED'].includes(o.status);
      return false;
    });
  };

  const countWaiting = orders.filter(o => ['CONFIRMED', 'DRAFT'].includes(o.status)).length;
  const countPicking = orders.filter(o => ['PICKING', 'PACKED'].includes(o.status)).length;
  const countReady = orders.filter(o => o.status === 'READY_FOR_DISPATCH').length;
  const countPartial = orders.filter(o => ['DISPATCHED', 'PARTIALLY_DELIVERED'].includes(o.status)).length;
  const countDeliveredToday = orders.filter(o => ['DELIVERED', 'CLOSED'].includes(o.status)).length;

  const kpiList = [
    { label: 'Orders Waiting', value: countWaiting, icon: Clock, iconBgClass: 'bg-sky-50', iconColorClass: 'text-sky-600' },
    { label: 'Picking & Packing', value: countPicking, icon: Box, iconBgClass: 'bg-amber-50', iconColorClass: 'text-amber-600' },
    { label: 'Ready for Dispatch', value: countReady, icon: Layers, iconBgClass: 'bg-indigo-50', iconColorClass: 'text-indigo-600' },
    { label: 'In Transit / Dispatched', value: countPartial, icon: Truck, iconBgClass: 'bg-orange-50', iconColorClass: 'text-orange-600' },
    { label: 'Completed & Closed', value: countDeliveredToday, icon: CheckCircle2, iconBgClass: 'bg-emerald-50', iconColorClass: 'text-emerald-600' }
  ];

  return (
    <>
      {/* Printable Area (Hidden by default) */}
      <div style={{ display: 'none' }}>
        <div ref={printAreaRef} className="p-8 max-w-4xl mx-auto text-black font-sans">
          {printSlipModal === 'PACKING' && selectedOrder && (
            <div className="space-y-6">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider">{activeCompany?.name || 'ACCOUNTELLENCE ERP'}</h1>
                  <p className="text-xs text-slate-500">Warehouse Fulfillment Operations</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-700">PACKING SLIP</h2>
                  <p className="text-xs font-mono">Order #: {selectedOrder.so_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Customer Name</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedOrder.client_name}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Target Warehouse</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedOrder.warehouse_name}</span>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold border-b">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Qty Ordered</th>
                      <th className="p-3 text-right">Shelf Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-slate-700">
                    {selectedOrder.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="p-3">{i.product_name} ({i.product_sku})</td>
                        <td className="p-3 text-right">{parseFloat(i.quantity)}</td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-600">{i.shelf_location || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-10 flex justify-between text-xs font-semibold">
                <div>Prepared By: _________________________</div>
                <div>Date: _________________________</div>
              </div>
            </div>
          )}

          {printSlipModal === 'DELIVERY' && selectedOrder && (
            <div className="space-y-6">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider">{activeCompany?.name || 'ACCOUNTELLENCE ERP'}</h1>
                  <p className="text-xs text-slate-500">Customer Delivery Challan</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-emerald-700">DELIVERY NOTE</h2>
                  <p className="text-xs font-mono">SO #: {selectedOrder.so_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Ship To</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedOrder.client_name}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Shipment Carrier Info</span>
                  {selectedOrder.deliveriesList?.[0] ? (
                    <div className="space-y-0.5">
                      <span className="block text-slate-700">Driver: {selectedOrder.deliveriesList[0].driver_name || 'N/A'}</span>
                      <span className="block text-slate-700">Vehicle: {selectedOrder.deliveriesList[0].vehicle_number || 'N/A'}</span>
                      <span className="block text-slate-700">Tracking: {selectedOrder.deliveriesList[0].tracking_number || 'N/A'}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">Logistics dispatch pending</span>
                  )}
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold border-b">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Qty Ordered</th>
                      <th className="p-3 text-right">Qty Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-slate-700">
                    {selectedOrder.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="p-3">{i.product_name} ({i.product_sku})</td>
                        <td className="p-3 text-right">{parseFloat(i.quantity)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{parseFloat(i.quantity_dispatched)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-16 grid grid-cols-2 gap-8 text-xs font-semibold">
                <div>
                  <p className="border-t border-black pt-2 text-center">Received By (Printed Name)</p>
                </div>
                <div>
                  <p className="border-t border-black pt-2 text-center">Customer Signature & Date</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <WorkspaceLayout
        title="Order Tracking Console"
        subtitle="Real-time warehouse operational board tracking picking, packing, and client delivery dispatch."
        icon={Clipboard}
        badgeText="Logistics Operations"
        breadcrumbs={['SARFIS ERP', 'Distribution', 'Order Tracking']}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search Order No, Customer, Warehouse..."
        kpis={kpiList}
      >
        
        {/* Kanban Board Columns Container */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
          
          {/* 1. WAITING / DRAFT COLUMN */}
          <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[420px] shadow-xs">
            <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock size={13} className="text-sky-500" /> Waiting
              </span>
              <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-extrabold rounded-full">{getOrdersByColumn('WAITING').length}</span>
            </div>
            <div className="space-y-2.5">
              {getOrdersByColumn('WAITING').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    selectedOrder?.id === o.id 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' 
                      : 'border-slate-200/90 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-indigo-600 tracking-tight">{o.so_number}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-wider ${STATUS_CONFIG[o.status]?.bg || 'bg-slate-100'}`}>
                      {STATUS_CONFIG[o.status]?.label || o.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {o.client_name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <span className="text-[12.5px] font-bold text-slate-800 truncate">{o.client_name}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-slate-500 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{o.warehouse_name || 'Main WH'}</span>
                    </span>
                    {o.total_amount && (
                      <span className="font-mono font-bold text-slate-700">
                        PKR {parseFloat(o.total_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {getOrdersByColumn('WAITING').length === 0 && (
                <div className="text-[11px] text-slate-400 italic text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                  No orders waiting.
                </div>
              )}
            </div>
          </div>

          {/* 2. PICKING & PACKING COLUMN */}
          <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[420px] shadow-xs">
            <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <Box size={13} className="text-amber-500" /> Picking & Packing
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full">{getOrdersByColumn('PICKING').length}</span>
            </div>
            <div className="space-y-2.5">
              {getOrdersByColumn('PICKING').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    selectedOrder?.id === o.id 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' 
                      : 'border-slate-200/90 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-indigo-600 tracking-tight">{o.so_number}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-wider ${STATUS_CONFIG[o.status]?.bg || 'bg-amber-100'}`}>
                      {STATUS_CONFIG[o.status]?.label || o.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {o.client_name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <span className="text-[12.5px] font-bold text-slate-800 truncate">{o.client_name}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-slate-500 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{o.warehouse_name || 'Main WH'}</span>
                    </span>
                    {o.total_amount && (
                      <span className="font-mono font-bold text-slate-700">
                        PKR {parseFloat(o.total_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {getOrdersByColumn('PICKING').length === 0 && (
                <div className="text-[11px] text-slate-400 italic text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                  No picking orders.
                </div>
              )}
            </div>
          </div>

          {/* 3. READY FOR DISPATCH COLUMN */}
          <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[420px] shadow-xs">
            <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-500" /> Ready
              </span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded-full">{getOrdersByColumn('READY').length}</span>
            </div>
            <div className="space-y-2.5">
              {getOrdersByColumn('READY').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    selectedOrder?.id === o.id 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' 
                      : 'border-slate-200/90 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-indigo-600 tracking-tight">{o.so_number}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-wider ${STATUS_CONFIG[o.status]?.bg || 'bg-indigo-100'}`}>
                      {STATUS_CONFIG[o.status]?.label || o.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {o.client_name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <span className="text-[12.5px] font-bold text-slate-800 truncate">{o.client_name}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-slate-500 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{o.warehouse_name || 'Main WH'}</span>
                    </span>
                    {o.total_amount && (
                      <span className="font-mono font-bold text-slate-700">
                        PKR {parseFloat(o.total_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {getOrdersByColumn('READY').length === 0 && (
                <div className="text-[11px] text-slate-400 italic text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                  No orders ready.
                </div>
              )}
            </div>
          </div>

          {/* 4. IN TRANSIT / DISPATCHED COLUMN */}
          <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[420px] shadow-xs">
            <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                <Truck size={13} className="text-orange-500" /> In Transit
              </span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-extrabold rounded-full">{getOrdersByColumn('DISPATCHED').length}</span>
            </div>
            <div className="space-y-2.5">
              {getOrdersByColumn('DISPATCHED').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    selectedOrder?.id === o.id 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' 
                      : 'border-slate-200/90 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-indigo-600 tracking-tight">{o.so_number}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-wider ${STATUS_CONFIG[o.status]?.bg || 'bg-orange-100'}`}>
                      {STATUS_CONFIG[o.status]?.label || o.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {o.client_name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <span className="text-[12.5px] font-bold text-slate-800 truncate">{o.client_name}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-slate-500 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{o.warehouse_name || 'Main WH'}</span>
                    </span>
                    {o.total_amount && (
                      <span className="font-mono font-bold text-slate-700">
                        PKR {parseFloat(o.total_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {getOrdersByColumn('DISPATCHED').length === 0 && (
                <div className="text-[11px] text-slate-400 italic text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                  No transit shipments.
                </div>
              )}
            </div>
          </div>

          {/* 5. DELIVERED & CLOSED COLUMN */}
          <div className="bg-[#f8fafc] p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[420px] shadow-xs">
            <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" /> Delivered & Closed
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">{getOrdersByColumn('DELIVERED').length}</span>
            </div>
            <div className="space-y-2.5">
              {getOrdersByColumn('DELIVERED').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    selectedOrder?.id === o.id 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' 
                      : 'border-slate-200/90 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-indigo-600 tracking-tight">{o.so_number}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase tracking-wider ${STATUS_CONFIG[o.status]?.bg || 'bg-emerald-100'}`}>
                      {STATUS_CONFIG[o.status]?.label || o.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {o.client_name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <span className="text-[12.5px] font-bold text-slate-800 truncate">{o.client_name}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-slate-500 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{o.warehouse_name || 'Main WH'}</span>
                    </span>
                    {o.total_amount && (
                      <span className="font-mono font-bold text-slate-700">
                        PKR {parseFloat(o.total_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {getOrdersByColumn('DELIVERED').length === 0 && (
                <div className="text-[11px] text-slate-400 italic text-center py-10 bg-white/50 rounded-xl border border-dashed border-slate-200">
                  No closed orders.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Selected Order Drawer (Right Details View) */}
        <div className="lg:col-span-4 space-y-6">
          {selectedOrder ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md space-y-5">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-mono font-black text-slate-900 text-[15px] flex items-center gap-2">
                    {selectedOrder.so_number}
                    <StatusBadge status={selectedOrder.status} />
                  </h3>
                  <p className="text-[10.5px] font-bold uppercase text-slate-400 mt-0.5">Fulfillment & Operations Workspace</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 border-none bg-transparent cursor-pointer"><X size={15} /></button>
              </div>

              {/* Print Shortcuts */}
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setPrintSlipModal('PACKING');
                    setTimeout(triggerBrowserPrint, 200);
                  }}
                  className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition"
                >
                  <Printer size={13} className="text-slate-500" /> Packing Slip
                </button>
                <button 
                  onClick={() => {
                    setPrintSlipModal('DELIVERY');
                    setTimeout(triggerBrowserPrint, 200);
                  }}
                  className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition"
                >
                  <Printer size={13} className="text-emerald-600" /> Delivery Note
                </button>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[12.0px] text-slate-650 border-b border-slate-100 pb-3.5">
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
                    className="font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 block text-left bg-transparent border-none p-0 cursor-pointer text-[13px]"
                  >
                    {selectedOrder.client_name}
                  </button>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warehouse</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrder.warehouse_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Date</span>
                  <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                    {new Date(selectedOrder.delivery_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Value</span>
                  <span className="font-mono font-black text-slate-900 mt-0.5 block">
                    PKR {parseFloat(selectedOrder.total_amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Fulfillment Summary with progress bar */}
              <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Fulfillment Progress</span>
                <div className="grid grid-cols-3 text-center text-[12px] font-bold text-slate-700 pt-0.5">
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
                    <span className="text-amber-600">{selectedOrder.total_remaining}</span>
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10.5px] font-bold text-slate-650">
                    <span>Fulfillment Rate</span>
                    <span>{selectedOrder.completion_rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style={{ width: `${selectedOrder.completion_rate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Products checklist with Shelf locations */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Products & Shelf Locations</span>
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden text-[11.5px] bg-white shadow-2xs">
                  <table className="w-full">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Location</th>
                        <th className="px-3 py-2 text-right">Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          <td className="px-3 py-2.5">
                            <span className="block font-bold text-slate-800">{item.product_name}</span>
                            <span className="block text-[9.5px] text-slate-400 font-mono">{item.product_sku}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-600">
                            {item.shelf_location || 'A-01'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            <span className="font-bold text-emerald-600">{parseFloat(item.quantity_dispatched)}</span> / <span className="text-slate-400">{parseFloat(item.quantity)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Journey timeline */}
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

              {/* Next Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                {selectedOrder.status === 'CONFIRMED' && (
                  <button 
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'PICKING')}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[12.5px] font-bold shadow-md transition cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    <Box size={14} /> Start Picking
                  </button>
                )}
                {selectedOrder.status === 'PICKING' && (
                  <button 
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'PACKED')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[12.5px] font-bold shadow-md transition cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    <Package size={14} /> Pack Order
                  </button>
                )}
                {selectedOrder.status === 'PACKED' && (
                  <button 
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'READY_FOR_DISPATCH')}
                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-[12.5px] font-bold shadow-md transition cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    <Layers size={14} /> Ready for Dispatch
                  </button>
                )}
                {['READY_FOR_DISPATCH', 'PACKED', 'PARTIALLY_DELIVERED'].includes(selectedOrder.status) && (
                  <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl space-y-2.5 shadow-xs text-left">
                    <span className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Confirm physical dispatch. You can record driver details, carrier logs, and enter partial dispatch amounts.
                    </p>
                    <button 
                      disabled={updating}
                      onClick={openDispatchModal}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12.5px] font-bold shadow-md transition cursor-pointer border-none flex items-center justify-center gap-1.5"
                    >
                      <Truck size={14} /> Dispatch Shipment
                    </button>
                  </div>
                )}
                {['DELIVERED', 'CLOSED'].includes(selectedOrder.status) && (
                  <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between text-[11.5px] font-semibold text-slate-650">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <CheckCircle2 size={15} /> Fulfillment Completed
                    </span>
                    <button 
                      onClick={() => navigate(`/dashboard/sales-orders?open=${selectedOrder.id}`)}
                      className="text-[11.5px] font-bold text-indigo-600 border-none bg-transparent cursor-pointer hover:underline flex items-center gap-0.5"
                    >
                      Open Sales Order <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-10 text-center text-slate-400 italic text-[12.5px] shadow-inner select-none">
              <Box size={32} className="mx-auto mb-2.5 text-slate-350 opacity-60" />
              Select an order card from the board to perform picking, packing, and dispatch operations.
            </div>
          )}
        </div>
      </WorkspaceLayout>

      {/* ─── Dispatch Details & Quantities Modal ─── */}
      {dispatchModal && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="font-display font-extrabold text-[16px] text-slate-900">Dispatch Shipment</h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">Record carrier metadata and select quantities for this shipment.</p>
              </div>
              <button 
                onClick={() => setDispatchModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 border-none bg-transparent cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-7 space-y-4 max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Driver Name</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. John Doe"
                    value={dispatchForm.driverName}
                    onChange={e => setDispatchForm({ ...dispatchForm, driverName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Vehicle Registration Number</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. LHR-4432"
                    value={dispatchForm.vehicleNumber}
                    onChange={e => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Courier Company (if external)</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. DHL, Leopard Logistics"
                    value={dispatchForm.courierName}
                    onChange={e => setDispatchForm({ ...dispatchForm, courierName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Carrier Tracking Number</label>
                  <input 
                    className="input-enterprise" 
                    placeholder="e.g. 77483921"
                    value={dispatchForm.trackingNumber}
                    onChange={e => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Logistics Remarks</label>
                <input 
                  className="input-enterprise" 
                  placeholder="e.g. Handed over to courier hub, fragile product tags attached"
                  value={dispatchForm.remarks}
                  onChange={e => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                />
              </div>

              {/* Items dispatch amount */}
              <div className="space-y-2">
                <label className="field-label font-bold text-slate-800 uppercase tracking-wider text-[10.5px]">Fulfillment Quantities</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-[12px] bg-white">
                    <thead className="bg-slate-50 border-b text-slate-500 font-bold">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Dispatched</th>
                        <th className="px-3 py-2 text-right w-24">Remaining</th>
                        <th className="px-3 py-2 text-right w-28">Dispatch Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dispatchForm.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="p-3">
                            <span className="block font-bold text-slate-800">{item.name}</span>
                            <span className="block text-[9.5px] text-slate-400 font-mono">{item.sku}</span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-650">{item.ordered}</td>
                          <td className="p-3 text-right font-mono text-emerald-600">{item.dispatched}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">{item.remaining}</td>
                          <td className="p-3 text-right">
                            <input 
                              type="number" 
                              required
                              min="0"
                              max={item.remaining}
                              step="0.0001"
                              className="input-enterprise py-1.5 font-mono text-[12px] text-right" 
                              value={item.dispatchNow}
                              onChange={e => {
                                const newItems = [...dispatchForm.items];
                                newItems[idx].dispatchNow = e.target.value;
                                setDispatchForm({ ...dispatchForm, items: newItems });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setDispatchModal(false)} 
                  className="btn btn-secondary flex-1 py-2.5 text-[12.5px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="btn btn-primary flex-[2] py-2.5 text-[12.5px] font-bold cursor-pointer"
                >
                  {updating ? 'Processing...' : 'Confirm Dispatch'}
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
