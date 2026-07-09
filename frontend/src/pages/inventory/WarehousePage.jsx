import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse, Plus, MapPin, Search, Edit2, Trash2, 
  AlertTriangle, RefreshCw, X, CheckCircle2, Building2,
  TrendingUp, BarChart2, Calendar, LayoutDashboard,
  Package, ArrowRight, ArrowLeft, Settings, Info,
  TrendingDown, CheckSquare, Layers, History
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import ProductInquiryDrawer from './ProductInquiryDrawer';

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function WarehousePage({ globalSearch = "" }) {
  const { activeCompany, user } = useAuthStore();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  
  // Selection & Details (Control Center)
  const [selectedWhId, setSelectedWhId] = useState(null);
  const [whStats, setWhStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Search & Filtering
  const [localSearch, setLocalSearch] = useState('');
  const search = globalSearch || localSearch;

  // Modals & Forms (Create / Edit Warehouse settings)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', location: '', description: '', capacity_value: 10000, capacity_type: 'UNITS', is_active: true });

  const canManage = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'Inventory Manager' || user?.role === 'Company Admin';

  const load = useCallback(async () => {
    if (!activeCompany) return;
    await Promise.resolve();
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/warehouses/${activeCompany.id}`);
      setWarehouses(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    load();
  }, [load]);

  const loadWarehouseStats = useCallback(async (id) => {
    if (!activeCompany || !id) return;
    setStatsLoading(true);
    try {
      const res = await api.get(`/warehouses/${activeCompany.id}/${id}/statistics`);
      setWhStats(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch warehouse statistics');
    }
    setStatsLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    if (selectedWhId) {
      loadWarehouseStats(selectedWhId);
    }
  }, [selectedWhId, loadWarehouseStats]);

  const handleOpenModal = (wh = null) => {
    setEditingWh(wh);
    if (wh) {
      setForm({
        name: wh.name,
        location: wh.location || '',
        description: wh.description || '',
        capacity_value: wh.capacity_value || 10000,
        capacity_type: wh.capacity_type || 'UNITS',
        is_active: wh.is_active
      });
    } else {
      setForm({ name: '', location: '', description: '', capacity_value: 10000, capacity_type: 'UNITS', is_active: true });
    }
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingWh) {
        await api.put(`/warehouses/${activeCompany.id}/${editingWh.id}`, form);
      } else {
        await api.post(`/warehouses/${activeCompany.id}`, form);
      }
      setModalOpen(false);
      load();
      if (selectedWhId && editingWh?.id === selectedWhId) {
        loadWarehouseStats(selectedWhId);
      }
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save warehouse');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this warehouse? This might fail if there is existing stock.')) return;
    try {
      await api.delete(`/warehouses/${activeCompany.id}/${id}`);
      if (selectedWhId === id) setSelectedWhId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete warehouse');
    }
  };

  const filtered = warehouses.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    (w.location && w.location.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      
      {/* 1. DIRECTORY LIST VIEW (If no warehouse selected) */}
      {!selectedWhId ? (
        <div className="space-y-6">
          <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md">
                <Warehouse size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Warehouses & Locations</h1>
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Facilities</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Manage physical storage facilities and inventory points.</p>
              </div>
            </div>
            
            {canManage && (
              <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
                <Plus size={14} /> Add Warehouse
              </button>
            )}
          </div>

          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input-enterprise pl-12 py-2.5 text-[13px]" placeholder="Search warehouses..."
              value={localSearch} onChange={e => setLocalSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-6 space-y-4">
                  <div className="skeleton h-6 w-2/3" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-3xs">
                <Warehouse size={40} className="mx-auto text-slate-300 mb-4 animate-bounce" />
                <p className="text-slate-500 font-medium">No warehouses found</p>
                <button onClick={() => handleOpenModal()} className="text-emerald-600 text-[13px] font-bold mt-2 hover:underline">
                  Create your first warehouse
                </button>
              </div>
            ) : filtered.map((wh) => (
              <motion.div key={wh.id} variants={fadeUp} initial="initial" animate="animate"
                onClick={() => setSelectedWhId(wh.id)}
                className="card group hover:border-emerald-200 transition-all duration-300 cursor-pointer hover:shadow-md"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:border-emerald-100 group-hover:text-emerald-500 transition-colors">
                      <Warehouse size={20} />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleOpenModal(wh)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(wh.id)} className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{wh.name}</h3>
                  <div className="flex items-center gap-2 mt-2 text-slate-500">
                    <MapPin size={13} className="flex-shrink-0" />
                    <span className="text-[12px] truncate">{wh.location || 'No location specified'}</span>
                  </div>
                  {wh.description && (
                    <p className="mt-3 text-[12px] text-slate-400 line-clamp-2 leading-relaxed italic border-l-2 border-slate-100 pl-3">
                      "{wh.description}"
                    </p>
                  )}
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${wh.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {wh.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">Capacity: {wh.capacity_value?.toLocaleString()} {wh.capacity_type}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        /* 2. WAREHOUSE CONTROL CENTER (Detailed Tabbed View) */
        <div className="space-y-6">
          {/* Header */}
          <div className="w-full bg-white border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedWhId(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer mr-1">
                <ArrowLeft size={16} />
              </button>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Warehouse size={20} />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-[15px] md:text-[17px] text-slate-800 tracking-tight uppercase">
                  {whStats?.summary?.name || 'Warehouse Details'}
                </h1>
                <p className="text-[11.5px] font-semibold text-slate-500 mt-0.5">{whStats?.summary?.location || 'No location address'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-3 md:mt-0">
              <button 
                onClick={() => loadWarehouseStats(selectedWhId)}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Refresh stats"
              >
                <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} />
              </button>
              <button 
                onClick={() => handleOpenModal(warehouses.find(w => w.id === selectedWhId))}
                className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-[12px] font-bold rounded-xl transition-all cursor-pointer"
              >
                <Settings size={14} /> Warehouse Settings
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto hide-scrollbar pb-1">
            {[
              { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'Products', label: 'Products Directory', icon: Package },
              { id: 'Movements', label: 'Stock Movements', icon: History },
              { id: 'Analytics', label: 'Inventory Intelligence', icon: BarChart2 }
            ].map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-[12px] font-bold border-b-2 transition-all cursor-pointer ${
                    isActive 
                      ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {statsLoading ? (
            <div className="p-20 text-center space-y-3 bg-white rounded-2xl border border-slate-100">
              <RefreshCw size={30} className="animate-spin text-indigo-600 mx-auto" />
              <p className="text-slate-400 font-semibold">Loading warehouse metrics & stock ledger...</p>
            </div>
          ) : whStats ? (
            <div className="space-y-6">
              
              {/* Tab 1: OVERVIEW */}
              {activeTab === 'Overview' && (
                <div className="space-y-6">
                  {/* Top KPIs Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Capacity Utilization</span>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[15px] text-slate-800">{whStats.summary.utilization}%</span>
                        <span className="text-[10px] text-slate-400 font-mono">Max: {whStats.summary.capacityValue}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${whStats.summary.utilization}%` }} />
                      </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Total Products</span>
                      <span className="font-extrabold text-[15px] text-slate-800">{whStats.summary.totalProducts.toLocaleString()} Items</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Total Quantity</span>
                      <span className="font-extrabold text-[15px] text-slate-800">{whStats.summary.totalQuantity.toLocaleString()} Units</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Inventory Valuation</span>
                      <span className="font-extrabold text-[15px] text-emerald-700 font-mono">
                        PKR {whStats.summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Low Stock Items</span>
                      <span className="font-extrabold text-[15px] text-amber-700">{whStats.summary.lowStockCount} Alerts</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Out of Stock</span>
                      <span className="font-extrabold text-[15px] text-rose-700">{whStats.summary.outOfStockCount} Items</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Reserved Stock</span>
                      <span className="font-extrabold text-[15px] text-indigo-600 font-mono">{whStats.summary.reservedStock.toLocaleString()}</span>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Inventory Accuracy</span>
                      <span className="font-extrabold text-[15px] text-slate-800">{whStats.summary.inventoryAccuracy}%</span>
                    </div>
                  </div>

                  {/* Daily Activity Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white border border-slate-100 rounded-xl p-4.5 shadow-3xs">
                    <div className="flex items-center gap-3">
                      <ArrowRight size={20} className="text-emerald-500 bg-emerald-50 p-0.5 rounded" />
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Incoming Today</span>
                        <span className="font-extrabold text-slate-800">{whStats.summary.todayIncoming.toLocaleString()} Units</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
                      <ArrowRight size={20} className="text-indigo-500 bg-indigo-50 p-0.5 rounded rotate-180" />
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Outgoing Today</span>
                        <span className="font-extrabold text-slate-800">{whStats.summary.todayOutgoing.toLocaleString()} Units</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
                      <Layers size={20} className="text-purple-500 bg-purple-50 p-0.5 rounded" />
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Transfers Today</span>
                        <span className="font-extrabold text-slate-800">{whStats.summary.todayTransfers} Movements</span>
                      </div>
                    </div>
                  </div>

                  {/* Split Layout: Alerts & Category Breakdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
                      <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Actionable Alerts</h3>
                      <div className="space-y-2 text-[11.5px] font-bold text-slate-600">
                        {whStats.alerts.map((alert, i) => (
                          <div key={i} className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg flex items-center gap-2.5 text-amber-900">
                            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
                            <span>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
                      <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Category Breakdown</h3>
                      <div className="space-y-3.5 text-[11.5px] font-bold text-slate-600">
                        {whStats.categoryBreakdown.map((cat, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-700">{cat.category}</span>
                              <span className="text-slate-400">{cat.percent}% (PKR {cat.value.toLocaleString()})</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full" style={{ width: `${cat.percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: PRODUCTS DIRECTORY */}
              {activeTab === 'Products' && (
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Products Catalogue In Warehouse</h3>
                    <div className="relative max-w-xs w-full">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input-enterprise pl-10 py-1.5 text-[12px]" placeholder="Search SKU or Name..."
                        value={localSearch} onChange={e => setLocalSearch(e.target.value)} />
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-3">Product Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">On Hand</th>
                          <th className="px-4 py-3 text-right">Reserved</th>
                          <th className="px-4 py-3 text-right">Available</th>
                          <th className="px-4 py-3 text-right">Average Cost</th>
                          <th className="px-4 py-3 text-right">Inventory Value</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 bg-white text-[11px] font-bold text-slate-600">
                        {whStats.products
                          .filter(p => p.sku.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()))
                          .map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3">
                                <button 
                                  onClick={() => setSelectedProductId(p.productId)}
                                  className="text-left font-black text-indigo-600 hover:underline block cursor-pointer"
                                >
                                  {p.name}
                                </button>
                                <span className="text-[9.5px] font-mono text-slate-400">{p.sku}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-sans">{p.category}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-800">{p.qty.toLocaleString()} {p.unitOfMeasure}s</td>
                              <td className="px-4 py-3 text-right font-mono text-amber-600">{p.reserved.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-600">{p.available.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono">PKR {p.avgCost.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-800">
                                PKR {p.value.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-[9.5px] uppercase font-black px-1.5 py-0.5 rounded ${
                                  p.status === 'Normal' ? 'bg-emerald-50 text-emerald-700' :
                                  p.status === 'Low Stock' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: STOCK MOVEMENTS */}
              {activeTab === 'Movements' && (
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
                  <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Chronological Stock Log Ledger</h3>
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Reference / Description</th>
                          <th className="px-4 py-2.5 text-right">Inflow / Outflow</th>
                          <th className="px-4 py-2.5 text-right">Closing Balance</th>
                          <th className="px-4 py-2.5 text-right">Unit Value</th>
                          <th className="px-4 py-2.5">Operator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 bg-white text-[11px] font-bold text-slate-600">
                        {(whStats.movements || []).map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-mono text-slate-500">{new Date(log.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5">
                              <span className="font-extrabold text-slate-800 block">{log.productName} ({log.productSku})</span>
                              <span className={`text-[8.5px] uppercase font-black px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                                log.type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-700' :
                                log.type === 'SALE' ? 'bg-indigo-50 text-indigo-700' :
                                log.type === 'ADJUSTMENT' ? 'bg-amber-50 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {log.type}
                              </span>
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono ${log.qtyChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {log.qtyChange > 0 ? `+${log.qtyChange.toLocaleString()}` : log.qtyChange.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-800">{log.qtyAfter?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono">PKR {log.unitCost?.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-slate-400 font-sans">{log.userName || 'System'}</td>
                          </tr>
                        ))}
                        {(!whStats.movements || whStats.movements.length === 0) && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-slate-400 italic">
                              No stock movement logs found for this warehouse facility.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: ANALYTICS */}
              {activeTab === 'Analytics' && (
                <div className="space-y-6">
                  {/* Stock Aging Summary */}
                  <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
                    <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Stock Aging Buckets</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">0-30 Days</span>
                        <span className="font-extrabold text-[13.5px] text-emerald-700 font-mono">PKR {whStats.stockAging.bucket30.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">31-60 Days</span>
                        <span className="font-extrabold text-[13.5px] text-slate-800 font-mono">PKR {whStats.stockAging.bucket60.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">61-90 Days</span>
                        <span className="font-extrabold text-[13.5px] text-amber-700 font-mono">PKR {whStats.stockAging.bucket90.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">90+ Days (Dead Stock)</span>
                        <span className="font-extrabold text-[13.5px] text-rose-700 font-mono">PKR {whStats.stockAging.bucket90Plus.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reorder Suggestions */}
                  <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-3xs space-y-4">
                    <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Automated Reorder Suggestions</h3>
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5">Product SKU</th>
                            <th className="px-4 py-2.5">Name</th>
                            <th className="px-4 py-2.5 text-right">Current On-Hand</th>
                            <th className="px-4 py-2.5 text-right">Min Threshold</th>
                            <th className="px-4 py-2.5 text-right font-black text-indigo-600">Recommended Order</th>
                            <th className="px-4 py-2.5">Supplier Vendor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white text-[11px] font-bold text-slate-600">
                          {whStats.reorderSuggestions.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-slate-400">{item.sku}</td>
                              <td className="px-4 py-2.5 text-slate-800">{item.name}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-rose-600">{item.current.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right font-mono">{item.minimum.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-extrabold text-indigo-600">+{item.recommended.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-slate-500 font-sans">{item.supplier}</td>
                            </tr>
                          ))}
                          {whStats.reorderSuggestions.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-400 italic">
                                Stock levels healthy. No reorder items suggested.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* 360° Product Inquiry Drawer */}
      {selectedProductId && (
        <ProductInquiryDrawer 
          productId={selectedProductId} 
          onClose={() => setSelectedProductId(null)} 
        />
      )}

      {/* Settings Modal (Add / Edit Form) */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="font-display font-bold text-slate-900">{editingWh ? 'Edit Warehouse' : 'New Warehouse'}</h2>
                  <p className="text-[11px] text-slate-500">Define storage location parameters</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-semibold text-slate-600">
                {formError && <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-[12px] font-medium">{formError}</div>}
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Warehouse Name *</label>
                  <input required className="input-enterprise text-[12px]" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Distribution Center" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Location / Address</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-3.5 text-slate-400" />
                    <input className="input-enterprise pl-10 text-[12px]" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. 123 Logistics Way, NY" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Capacity Value</label>
                    <input type="number" required className="input-enterprise text-[12px] font-mono" value={form.capacity_value} onChange={e => setForm({ ...form, capacity_value: parseInt(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Capacity Metric</label>
                    <select className="input-enterprise text-[12px] font-bold" value={form.capacity_type} onChange={e => setForm({ ...form, capacity_type: e.target.value })}>
                      <option value="UNITS">Units</option>
                      <option value="PALLETS">Pallets</option>
                      <option value="CUBIC_METERS">Cubic Meters</option>
                      <option value="WEIGHT">Weight (Tons)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea className="input-enterprise min-h-[80px] py-2 text-[12px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Internal notes or specific details about this site..." />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${form.is_active ? 'left-6' : 'left-1'}`} />
                  </button>
                  <span className="text-[12px] font-medium text-slate-700">Active and available for stock</span>
                </div>

                <div className="flex gap-3 mt-8 border-t border-slate-100 pt-5">
                  <button type="button" onClick={() => setModalOpen(false)} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex-1 py-2.5 flex items-center justify-center gap-2 text-[12px] font-bold rounded-xl transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white flex-[2] py-2.5 flex items-center justify-center gap-2 text-[12px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50">
                    {saving ? <RefreshCw className="animate-spin" size={16} /> : (editingWh ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
