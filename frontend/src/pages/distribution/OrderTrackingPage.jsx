import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, X, Truck, Calendar, DollarSign, Activity, CheckCircle, Package, ArrowRight, ShieldAlert, Clock } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const STATUS_CONFIG = {
  PENDING: { label: 'Order Confirmed', bg: 'bg-blue-50 text-blue-700 border border-blue-100', dot: 'bg-blue-500' },
  CONFIRMED: { label: 'Ready for Dispatch', bg: 'bg-amber-50 text-amber-700 border border-amber-100', dot: 'bg-amber-500' },
  DISPATCHED: { label: 'Dispatched', bg: 'bg-orange-50 text-orange-700 border border-orange-100', dot: 'bg-orange-500' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border border-rose-100', dot: 'bg-rose-500' }
};

export default function OrderTrackingPage() {
  const { activeCompany } = useAuthStore();

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Drawer details state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/deliveries/${activeCompany.id}`);
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
    setSelectedOrder({ ...order, items: [] });
    setLoadingItems(true);
    try {
      const { data } = await api.get(`/deliveries/${activeCompany.id}/${order.id}`);
      setSelectedOrder(data);
    } catch (err) {
      console.error('Failed to load order items:', err);
    }
    setLoadingItems(false);
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/deliveries/${activeCompany.id}/${orderId}/status`, { status: newStatus });
      await loadOrders();
      
      // Refresh selected order details
      const { data } = await api.get(`/deliveries/${activeCompany.id}/${orderId}`);
      setSelectedOrder(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update order status.');
    }
    setUpdating(false);
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesSearch = o.delivery_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (o.client_name && o.client_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Calculate timeline steps
  const getTimelineSteps = (status) => {
    const steps = [
      { code: 'PENDING', label: 'Order Confirmed', description: 'Order created & verified' },
      { code: 'CONFIRMED', label: 'Ready for Dispatch', description: 'Stock allocated & ready' },
      { code: 'DISPATCHED', label: 'Dispatched', description: 'In transit to client' },
      { code: 'DELIVERED', label: 'Delivered', description: 'Completed and closed' }
    ];

    if (status === 'CANCELLED') {
      return [
        { code: 'PENDING', label: 'Order Confirmed', completed: true },
        { code: 'CANCELLED', label: 'Cancelled', completed: true, active: true, error: true }
      ];
    }

    const currentIdx = steps.findIndex(s => s.code === status);
    return steps.map((s, idx) => ({
      ...s,
      completed: idx <= currentIdx,
      active: s.code === status
    }));
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#FAF9F8] via-[#FFFFFF] to-[#F7FAF9] space-y-6">
      
      {/* Banner */}
      <div className="w-full bg-[#EBF2EE] border border-[#C2DED0] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#065f46] to-[#047857] flex items-center justify-center text-white shadow-md shadow-emerald-700/10">
            <Truck size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#2E4D3F] tracking-tight uppercase">Order Status Tracking</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Operations</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Unified order timeline tracking and status visualization across SARFIS.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input-enterprise pl-9 text-[13px] py-2.5" 
            placeholder="Search Order Number or Client name..." 
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
          <option value="PENDING">Order Confirmed</option>
          <option value="CONFIRMED">Ready for Dispatch</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Orders Table */}
        <div className="card overflow-hidden lg:col-span-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Order #</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Customer</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right">Total Amount</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE8]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-300" /> Loading orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 italic">No orders found.</td>
                  </tr>
                ) : filteredOrders.map(o => {
                  const conf = STATUS_CONFIG[o.status] || { label: o.status, bg: 'bg-slate-100 text-slate-700' };
                  return (
                    <tr 
                      key={o.id} 
                      className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedOrder?.id === o.id ? 'bg-slate-50' : ''}`} 
                      onClick={() => handleSelectOrder(o)}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-700">{o.delivery_number}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-slate-800">{o.client_name}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">{new Date(o.delivery_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[13px] text-right font-mono font-bold text-slate-800">
                        ${parseFloat(o.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${conf.bg}`}>
                          {conf.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Order Drawer */}
        <div className="lg:col-span-4 space-y-6">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <Motion.div 
                key={selectedOrder.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-mono font-bold text-slate-800 text-[14.5px]">{selectedOrder.delivery_number}</h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Order Profile Details</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                </div>

                <div className="space-y-2.5 text-[12px] text-slate-600">
                  <div className="flex justify-between"><span>Customer:</span><span className="font-bold text-slate-800">{selectedOrder.client_name}</span></div>
                  <div className="flex justify-between"><span>Sector:</span><span className="font-bold text-[#065f46] bg-[#EBF2EE] px-2 py-0.5 rounded text-[10px]">{selectedOrder.sector_name || 'General'}</span></div>
                  <div className="flex justify-between"><span>Date:</span><span className="font-bold text-slate-800">{new Date(selectedOrder.delivery_date).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span>Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_CONFIG[selectedOrder.status]?.bg}`}>
                      {STATUS_CONFIG[selectedOrder.status]?.label}
                    </span>
                  </div>
                  {selectedOrder.notes && (
                    <div className="border-t border-slate-100 pt-2.5">
                      <span className="block font-bold text-slate-400 text-[10px] uppercase">Notes</span>
                      <p className="italic text-slate-500 mt-0.5">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-2 pt-1">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Ordered Items</span>
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px]">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-[10px]">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-slate-500 font-bold">Product</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Qty</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Price</th>
                          <th className="px-3 py-1.5 text-right text-slate-500 font-bold">Disc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingItems ? (
                          <tr>
                            <td colSpan={4} className="text-center py-4 text-slate-400 italic">Loading items...</td>
                          </tr>
                        ) : selectedOrder.items?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-4 text-slate-400 italic">No lines found.</td>
                          </tr>
                        ) : selectedOrder.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-slate-700 font-semibold">
                              <span>{item.product_name}</span>
                              {item.offer && <span className="block text-[9px] text-[#059669] font-bold mt-0.5">Offer: {item.offer}</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">{parseFloat(item.quantity)}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">${parseFloat(item.unit_price).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-red-600">${parseFloat(item.discount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between font-bold text-[13px] pt-1">
                    <span>Total Amount</span>
                    <span className="font-mono text-slate-900">${parseFloat(selectedOrder.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Tracking Progress timeline */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Tracking progression timeline</span>
                  <div className="relative pl-6 space-y-4">
                    {getTimelineSteps(selectedOrder.status).map((step, idx) => (
                      <div key={idx} className="relative">
                        {/* Connecting Line */}
                        {idx < getTimelineSteps(selectedOrder.status).length - 1 && (
                          <div className={`absolute left-[-16px] top-4 bottom-[-16px] w-[2px] ${step.completed ? 'bg-emerald-500' : 'bg-slate-150 bg-slate-200'}`} />
                        )}
                        
                        {/* Status Checkpoint Dot */}
                        <div className={`absolute left-[-22px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white flex items-center justify-center ${
                          step.completed ? 'border-emerald-500' : 'border-slate-300'
                        }`}>
                          {step.completed && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                        
                        <div>
                          <p className={`text-[11.5px] font-bold ${step.active ? 'text-slate-900 font-extrabold' : 'text-slate-500'}`}>
                            {step.label}
                          </p>
                          {step.description && <p className="text-[9.5px] text-slate-400">{step.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operations Status Changer buttons */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  {selectedOrder.status === 'PENDING' && (
                    <button 
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'CONFIRMED')}
                      className="w-full py-2.5 bg-indigo-65 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Confirm Order
                    </button>
                  )}
                  {selectedOrder.status === 'CONFIRMED' && (
                    <button 
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'DISPATCHED')}
                      className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-[12.5px] font-bold hover:bg-orange-700 transition cursor-pointer"
                    >
                      Dispatch Order
                    </button>
                  )}
                  {selectedOrder.status === 'DISPATCHED' && (
                    <button 
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Deliver Order
                    </button>
                  )}
                  {['PENDING', 'CONFIRMED', 'DISPATCHED'].includes(selectedOrder.status) && (
                    <button 
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'CANCELLED')}
                      className="w-full py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-[12.5px] font-bold transition cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>

              </Motion.div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8 text-center text-slate-400 text-[12.5px] italic">
                Select an Order to view items, timeline, and dispatch operations.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
