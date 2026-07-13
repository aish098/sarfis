import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, X, Truck, Calendar, ArrowRight, User, Package, Box, Layers, Clipboard, ShieldAlert, CheckCircle, CheckCircle2, ChevronRight, Inbox, Printer } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-50 text-slate-650' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50 text-blue-700' },
  PICKING: { label: 'Picking', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  PACKED: { label: 'Packed', bg: 'bg-indigo-50 text-indigo-700' },
  READY_FOR_DISPATCH: { label: 'Ready for Dispatch', bg: 'bg-cyan-50 text-cyan-700' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered', bg: 'bg-amber-100 text-amber-800' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { label: 'Closed', bg: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700' }
};

export default function OrderTrackingPage() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Dispatch Modal State
  const [dispatchModal, setDispatchModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    driverName: '',
    vehicleNumber: '',
    courierName: '',
    trackingNumber: '',
    remarks: '',
    items: [] // { productId, name, ordered, dispatched, remaining, dispatchNow }
  });

  // Print Modals
  const [printSlipModal, setPrintSlipModal] = useState(null); // 'PACKING' | 'DELIVERY'
  const printAreaRef = useRef(null);

  const loadOrders = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/sales-orders/${activeCompany.id}`);
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
    setIsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSelectOrder = async (order) => {
    setSelectedOrder(null);
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
        dispatchNow: remaining // default to full remaining
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
    window.location.reload(); // Reload to restore React state cleanly
  };

  const getOrdersByColumn = (colType) => {
    return filteredOrders.filter(o => {
      if (colType === 'PICKING') return ['CONFIRMED', 'PICKING'].includes(o.status);
      if (colType === 'READY') return ['PACKED', 'READY_FOR_DISPATCH'].includes(o.status);
      if (colType === 'DISPATCHED') return ['DISPATCHED', 'PARTIALLY_DELIVERED'].includes(o.status);
      if (colType === 'DELIVERED') return ['DELIVERED', 'CLOSED'].includes(o.status);
      return false;
    });
  };

  const filteredOrders = orders.filter(o => {
    if (o.status === 'DRAFT' || o.status === 'CANCELLED') return false;
    return o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.client_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const countWaiting = orders.filter(o => o.status === 'CONFIRMED').length;
  const countPicking = orders.filter(o => o.status === 'PICKING').length;
  const countReady = orders.filter(o => ['PACKED', 'READY_FOR_DISPATCH'].includes(o.status)).length;
  const countPartial = orders.filter(o => o.status === 'PARTIALLY_DELIVERED').length;
  const countDeliveredToday = orders.filter(o => o.status === 'DELIVERED' || o.status === 'CLOSED').length;

  return (
    <div className="space-y-6 font-sans pb-20">
      
      {/* Printable Area (Hidden by default) */}
      <div style={{ display: 'none' }}>
        <div ref={printAreaRef} className="p-8 max-w-4xl mx-auto text-black font-sans">
          {printSlipModal === 'PACKING' && selectedOrder && (
            <div className="space-y-6">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider">{activeCompany?.name || 'SARFIS ERP'}</h1>
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
                  <h1 className="text-xl font-bold uppercase tracking-wider">{activeCompany?.name || 'SARFIS ERP'}</h1>
                  <p className="text-xs text-slate-500">Customer Delivery challan</p>
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

      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Clipboard size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Order Tracking Console</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Logistics</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Real-time warehouse operational board tracking picking, packing, and client delivery dispatch.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-650">
            <Clipboard size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Orders Waiting</span>
            <span className="text-[18px] font-black text-slate-800">{countWaiting}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <Box size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Picking</span>
            <span className="text-[18px] font-black text-slate-800">{countPicking}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Layers size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Ready</span>
            <span className="text-[18px] font-black text-slate-800">{countReady}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 rounded-xl text-orange-650">
            <Truck size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Partially Delivered</span>
            <span className="text-[18px] font-black text-slate-800">{countPartial}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Delivered</span>
            <span className="text-[18px] font-black text-slate-800">{countDeliveredToday}</span>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-9 text-[13px] py-2.5" 
            placeholder="Search Order No, Customer..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Kanban Board Columns */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          
          {/* 1. PICKING COLUMN */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3 min-h-[300px]">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Picking</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">{getOrdersByColumn('PICKING').length}</span>
            </div>
            <div className="space-y-2">
              {getOrdersByColumn('PICKING').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3 rounded-xl border border-slate-150 shadow-2xs hover:shadow cursor-pointer hover:border-indigo-200 transition ${selectedOrder?.id === o.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <span className="block font-mono text-[11.5px] font-bold text-indigo-600">{o.so_number}</span>
                  <span className="block text-[12px] font-bold text-slate-800 mt-1 truncate">{o.client_name}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{o.warehouse_name}</span>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded mt-2.5 ${o.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {o.status === 'CONFIRMED' ? 'Confirmed' : 'Picking'}
                  </span>
                </div>
              ))}
              {getOrdersByColumn('PICKING').length === 0 && <div className="text-[11px] text-slate-400 italic text-center py-6">No orders in picking.</div>}
            </div>
          </div>

          {/* 2. READY FOR DISPATCH COLUMN */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3 min-h-[300px]">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ready</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">{getOrdersByColumn('READY').length}</span>
            </div>
            <div className="space-y-2">
              {getOrdersByColumn('READY').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3 rounded-xl border border-slate-150 shadow-2xs hover:shadow cursor-pointer hover:border-indigo-200 transition ${selectedOrder?.id === o.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <span className="block font-mono text-[11.5px] font-bold text-indigo-600">{o.so_number}</span>
                  <span className="block text-[12px] font-bold text-slate-800 mt-1 truncate">{o.client_name}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{o.warehouse_name}</span>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded mt-2.5 ${o.status === 'PACKED' ? 'bg-indigo-50 text-indigo-700' : 'bg-cyan-50 text-cyan-700'}`}>
                    {o.status === 'PACKED' ? 'Packed' : 'Ready'}
                  </span>
                </div>
              ))}
              {getOrdersByColumn('READY').length === 0 && <div className="text-[11px] text-slate-400 italic text-center py-6">No orders ready.</div>}
            </div>
          </div>

          {/* 3. DISPATCHED / PARTIAL COLUMN */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3 min-h-[300px]">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">In Transit</span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-850 text-[10px] font-bold rounded-full">{getOrdersByColumn('DISPATCHED').length}</span>
            </div>
            <div className="space-y-2">
              {getOrdersByColumn('DISPATCHED').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3 rounded-xl border border-slate-150 shadow-2xs hover:shadow cursor-pointer hover:border-indigo-200 transition ${selectedOrder?.id === o.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <span className="block font-mono text-[11.5px] font-bold text-indigo-600">{o.so_number}</span>
                  <span className="block text-[12px] font-bold text-slate-800 mt-1 truncate">{o.client_name}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{o.warehouse_name}</span>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded mt-2.5 ${o.status === 'PARTIALLY_DELIVERED' ? 'bg-amber-100 text-amber-800' : 'bg-orange-50 text-orange-700'}`}>
                    {o.status === 'PARTIALLY_DELIVERED' ? 'Partial' : 'Dispatched'}
                  </span>
                </div>
              ))}
              {getOrdersByColumn('DISPATCHED').length === 0 && <div className="text-[11px] text-slate-400 italic text-center py-6">No transit shipments.</div>}
            </div>
          </div>

          {/* 4. DELIVERED COLUMN */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3 min-h-[300px]">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivered</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">{getOrdersByColumn('DELIVERED').length}</span>
            </div>
            <div className="space-y-2">
              {getOrdersByColumn('DELIVERED').map(o => (
                <div 
                  key={o.id} 
                  onClick={() => handleSelectOrder(o)}
                  className={`bg-white p-3 rounded-xl border border-slate-150 shadow-2xs hover:shadow cursor-pointer hover:border-indigo-200 transition ${selectedOrder?.id === o.id ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <span className="block font-mono text-[11.5px] font-bold text-indigo-600">{o.so_number}</span>
                  <span className="block text-[12px] font-bold text-slate-800 mt-1 truncate">{o.client_name}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{o.warehouse_name}</span>
                  <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-50 text-emerald-700 mt-2.5">
                    Delivered
                  </span>
                </div>
              ))}
              {getOrdersByColumn('DELIVERED').length === 0 && <div className="text-[11px] text-slate-400 italic text-center py-6">No delivered orders.</div>}
            </div>
          </div>

        </div>

        {/* Selected Order Drawer */}
        <div className="lg:col-span-4 space-y-6">
          {selectedOrder ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-mono font-black text-slate-850 text-[15px]">{selectedOrder.so_number}</h3>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Fulfillment Details</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-50 border-none bg-transparent cursor-pointer"><X size={15} /></button>
              </div>

              {/* Print Shortcuts */}
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setPrintSlipModal('PACKING');
                    setTimeout(triggerBrowserPrint, 200);
                  }}
                  className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer size={13} /> Packing Slip
                </button>
                <button 
                  onClick={() => {
                    setPrintSlipModal('DELIVERY');
                    setTimeout(triggerBrowserPrint, 200);
                  }}
                  className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer size={13} /> Delivery Note
                </button>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[12.0px] text-slate-650 border-b border-slate-100 pb-3.5">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrder.client_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warehouse</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedOrder.warehouse_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Date</span>
                  <span className="font-bold text-slate-800 mt-0.5 block font-mono">
                    {new Date(selectedOrder.delivery_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-0.5 ${STATUS_CONFIG[selectedOrder.status]?.bg || 'bg-slate-50'}`}>
                    {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                  </span>
                </div>
              </div>

              {/* Fulfillment Summary with progress bar */}
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Fulfillment Summary</span>
                <div className="grid grid-cols-3 text-center text-[12px] font-bold text-slate-700 pt-1">
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
                <div className="space-y-1 pt-1.5">
                  <div className="flex justify-between text-[10.5px] font-bold text-slate-650">
                    <span>Fulfillment progress</span>
                    <span>{selectedOrder.completion_rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${selectedOrder.completion_rate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Products checklist with Shelf locations */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Products Locations & Quantities</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px] bg-white">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b text-slate-400 font-bold">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Location</th>
                        <th className="px-3 py-2 text-right">Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="px-3 py-2.5">
                            <span className="block font-bold text-slate-800">{item.product_name}</span>
                            <span className="block text-[9.5px] text-slate-400 font-mono">{item.product_sku}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-600">
                            {item.shelf_location || 'A-01'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {parseFloat(item.quantity_dispatched)} / <span className="text-slate-400">{parseFloat(item.quantity)}</span>
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
                    className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-amber-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                  >
                    Start Picking
                  </button>
                )}
                {selectedOrder.status === 'PICKING' && (
                  <button 
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'PACKED')}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                  >
                    Pack Order
                  </button>
                )}
                {selectedOrder.status === 'PACKED' && (
                  <button 
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'READY_FOR_DISPATCH')}
                    className="w-full py-2.5 bg-cyan-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-cyan-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                  >
                    Ready for Dispatch
                  </button>
                )}
                {['READY_FOR_DISPATCH', 'PACKED', 'PARTIALLY_DELIVERED'].includes(selectedOrder.status) && (
                  <div className="bg-emerald-50/50 border border-emerald-150 p-3.5 rounded-2xl space-y-2.5 shadow-sm text-left animate-slide-up">
                    <span className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Confirm physical dispatch. You can record driver details, carrier logs, and enter partial dispatch amounts.
                    </p>
                    <button 
                      disabled={updating}
                      onClick={openDispatchModal}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                    >
                      <Truck size={14} /> Dispatch Shipment
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'DELIVERED' && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[11.5px] font-semibold text-slate-650">
                    <span>Fulfillment Completed</span>
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
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400 italic text-[12.5px] shadow-inner select-none">
              <Box size={30} className="mx-auto mb-2 text-slate-350 opacity-60" />
              Select an order from the board to perform picking, packing, and dispatch operations.
            </div>
          )}
        </div>

      </div>

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

    </div>
  );
}
