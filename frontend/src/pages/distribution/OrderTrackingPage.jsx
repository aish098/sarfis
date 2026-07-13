import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, X, Truck, Calendar, ArrowRight, User, Package, Box, Layers, Clipboard, ShieldAlert, CheckCircle, CheckCircle2, ChevronRight, Inbox } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RelatedDocuments from '../../components/RelatedDocuments';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-50 text-slate-650' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50 text-blue-700' },
  PICKING: { label: 'Picking', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  PACKED: { label: 'Packed', bg: 'bg-indigo-50 text-indigo-700' },
  READY_FOR_DISPATCH: { label: 'Ready for Dispatch', bg: 'bg-cyan-50 text-cyan-700' },
  DISPATCHED: { label: 'Dispatched', bg: 'bg-orange-50 text-orange-700' },
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

  // Grouping orders for Kanban columns
  const getOrdersByColumn = (colType) => {
    return filteredOrders.filter(o => {
      if (colType === 'PICKING') return ['CONFIRMED', 'PICKING'].includes(o.status);
      if (colType === 'READY') return ['PACKED', 'READY_FOR_DISPATCH'].includes(o.status);
      if (colType === 'DISPATCHED') return o.status === 'DISPATCHED';
      if (colType === 'DELIVERED') return ['DELIVERED', 'CLOSED'].includes(o.status);
      return false;
    });
  };

  const filteredOrders = orders.filter(o => {
    if (o.status === 'DRAFT' || o.status === 'CANCELLED') return false; // Hide drafts/cancelled from the active tracking board
    
    return o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.client_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysCount = orders.filter(o => o.delivery_date.split('T')[0] === todayStr || o.created_at.split('T')[0] === todayStr).length;
  const colPicking = orders.filter(o => ['CONFIRMED', 'PICKING'].includes(o.status)).length;
  const colReady = orders.filter(o => ['PACKED', 'READY_FOR_DISPATCH'].includes(o.status)).length;
  const colDispatched = orders.filter(o => o.status === 'DISPATCHED').length;
  const colDelivered = orders.filter(o => ['DELIVERED', 'CLOSED'].includes(o.status)).length;

  return (
    <div className="space-y-6 font-sans pb-20">
      
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900 tracking-tight">Order Tracking Console</h1>
          <p className="text-[12.5px] text-slate-500 mt-1">Real-time warehouse operational board tracking picking, packing, and client delivery dispatch.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <Clipboard size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Orders Today</span>
            <span className="text-[18px] font-black text-slate-800">{todaysCount}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <Box size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Picking</span>
            <span className="text-[18px] font-black text-slate-800">{colPicking}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Layers size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Ready</span>
            <span className="text-[18px] font-black text-slate-800">{colReady}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600">
            <Truck size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Dispatched</span>
            <span className="text-[18px] font-black text-slate-800">{colDispatched}</span>
          </div>
        </div>
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Delivered</span>
            <span className="text-[18px] font-black text-slate-800">{colDelivered}</span>
          </div>
        </div>
      </div>

      {/* Toolbar Filters */}
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
        
        {/* Kanban Board Column Areas */}
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

          {/* 3. DISPATCHED COLUMN */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3 min-h-[300px]">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dispatched</span>
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
                  <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded bg-orange-50 text-orange-700 mt-2.5">
                    Dispatched
                  </span>
                </div>
              ))}
              {getOrdersByColumn('DISPATCHED').length === 0 && <div className="text-[11px] text-slate-400 italic text-center py-6">No dispatched orders.</div>}
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

        {/* Selected Order details drawer */}
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

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[12.0px] text-slate-600 border-b border-slate-100 pb-3.5">
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

              {/* Items checklist */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Products Checklist</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px] bg-white">
                  <table className="w-full">
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="px-3 py-2.5">
                            <span className="block font-bold text-slate-800">{item.product_name}</span>
                            <span className="block text-[9.5px] text-slate-400 font-mono">{item.product_sku}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                            {parseFloat(item.quantity)} Units
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
                {selectedOrder.status === 'READY_FOR_DISPATCH' && (
                  <div className="bg-emerald-50/50 border border-emerald-150 p-3.5 rounded-2xl space-y-2.5 shadow-sm text-left animate-slide-up">
                    <span className="block text-[10px] font-black uppercase text-emerald-800 tracking-wider">Next Recommended Action</span>
                    <p className="text-[11.5px] text-slate-650 font-semibold leading-relaxed">
                      Confirm physical dispatch. This will automatically decrement inventory levels, record stock movement logs, and generate the Customer Delivery challan.
                    </p>
                    <button 
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'DISPATCHED')}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                    >
                      <Truck size={14} /> Dispatch Order
                    </button>
                  </div>
                )}
                {selectedOrder.status === 'DISPATCHED' && (
                  <button 
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer border-none flex items-center justify-center gap-1"
                  >
                    Mark Delivered
                  </button>
                )}
                {selectedOrder.status === 'DELIVERED' && (
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-[11.5px] font-semibold text-slate-650">
                    <span>Ready for financial invoicing</span>
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

    </div>
  );
}
