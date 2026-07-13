import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Users, Tag, Plus, Search, AlertCircle,
  CheckCircle2, Clock, XCircle, ChevronRight, X,
  RefreshCw, AlertTriangle, Eye, TrendingUp, BarChart2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { useLocation } from 'react-router-dom';
import RelatedDocuments from '../../components/RelatedDocuments';
import { PowerBIDonut } from '../../components/charts/PowerBIDonut';
import { computeChartLayout, normalizeChartRows, AdaptiveChartFrame } from '../../components/charts/chartEngine';
import { DynamicClusteredBarChart } from '../../components/charts/DynamicCharts';
import RelationshipRiskModal from '../../components/risk/RelationshipRiskModal';

const CHART_COLORS = ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#10b981', '#ef4444'];

const PROGRESS_GRADIENTS = [
  'linear-gradient(90deg, #118DFF, #12239E)', // Blue to Sapphire
  'linear-gradient(90deg, #10b981, #059669)', // Emerald to Teal
  'linear-gradient(90deg, #E66C37, #f97316)', // Warm Amber to Orange
  'linear-gradient(90deg, #8b5cf6, #6B007B)', // Violet to Lavender
  'linear-gradient(90deg, #3b82f6, #06b6d4)', // Sky Blue to Cyan
  'linear-gradient(90deg, #f43f5e, #be123c)', // Rose to Deep Crimson
];

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const STATUS_CONFIG = {
  PENDING: { icon: Clock, color: '#1d4ed8', bg: '#dbeafe', label: 'Order Confirmed' },
  CONFIRMED: { icon: CheckCircle2, color: '#b45309', bg: '#fef3c7', label: 'Ready for Dispatch' },
  DISPATCHED: { icon: Truck, color: '#c2410c', bg: '#ffedd5', label: 'Dispatched' },
  DELIVERED: { icon: CheckCircle2, color: '#047857', bg: '#d1fae5', label: 'Delivered' },
  CANCELLED: { icon: XCircle, color: '#b91c1c', bg: '#fee2e2', label: 'Cancelled' },
};

export default function DistributionPage() {
  const { activeCompany } = useAuthStore();
  const { search: locationSearch } = useLocation();
  const [tab, setTab] = useState('deliveries'); // deliveries | clients | sectors
  const [deliveries, setDeliveries] = useState([]);
  const [salesVouchers, setSalesVouchers] = useState([]);
  const [clients, setClients] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [dashStats, setDashStats] = useState(null);
  const [topClients, setTopClients] = useState([]);
  const [sectorRevenue, setSectorRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creationMode, setCreationMode] = useState('voucher'); // 'voucher' | 'manual'

  // Modals
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [sectorModal, setSectorModal] = useState(false);
  const [selectedRiskClient, setSelectedRiskClient] = useState(null);

  // Drawer / details state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);

  // Forms
  const [deliveryForm, setDeliveryForm] = useState({
    clientId: '', sectorId: '', warehouseId: '', deliveryDate: new Date().toISOString().split('T')[0],
    arAccountId: '', notes: '', voucherId: '', items: [{ product_id: '', quantity: '', unit_price: '', unit_cost: '', discount: '0.00', offer: '' }]
  });
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', address: '', sector_id: '', credit_limit: '' });
  const [sectorForm, setSectorForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!activeCompany) return;

    // Defer state updates to avoid synchronous setState in effect warnings
    await Promise.resolve();

    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const [del, cli, sec, prod, wh, accs, stats, vouchersRes] = await Promise.all([
        api.get(`/deliveries/${activeCompany.id}`, { params }),
        api.get(`/clients/${activeCompany.id}`),
        api.get(`/sectors/${activeCompany.id}`),
        api.get(`/products/${activeCompany.id}`),
        api.get(`/warehouses/${activeCompany.id}`),
        api.get('/accounts'),
        api.get(`/distribution/${activeCompany.id}/dashboard`),
        api.get(`/vouchers/${activeCompany.id}?type=SALES`),
      ]);
      setDeliveries(del.data);
      setSalesVouchers(vouchersRes.data || []);
      setClients(cli.data);
      setSectors(sec.data);
      setProducts(prod.data);
      setWarehouses(wh.data);
      setAccounts(accs.data);
      setDashStats(stats.data.stats);
      setTopClients(stats.data.topClients || []);
      setSectorRevenue(stats.data.sectorRevenue || []);
    } catch (err) {
      console.error('Failed to load distribution data:', err);
    }
    setLoading(false);
  }, [activeCompany, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const id = params.get('id') || params.get('open');
    if (id && deliveries.length > 0) {
      const match = deliveries.find(d => String(d.id) === String(id));
      if (match) {
        handleSelectOrder(match);
      }
    }
  }, [locationSearch, deliveries]);

  // Delivery form helpers
  const addDeliveryItem = () => setDeliveryForm(f => ({
    ...f, items: [...f.items, { product_id: '', quantity: '', unit_price: '', unit_cost: '', discount: '0.00', offer: '' }]
  }));
  const setDeliveryItem = (idx, field, val) => {
    const items = [...deliveryForm.items];
    items[idx][field] = val;
    // Auto-fill cost price from product
    if (field === 'product_id') {
      const prod = products.find(p => String(p.id) === String(val));
      if (prod) {
        items[idx].unit_price = prod.unit_price;
        items[idx].unit_cost = prod.cost_price;
        items[idx].discount = '0.00';
        items[idx].offer = '';
      }
    }
    setDeliveryForm(f => ({ ...f, items }));
  };
  const removeDeliveryItem = (idx) => setDeliveryForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const orderTotal = deliveryForm.items.reduce((s, i) => s + (((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)) - (parseFloat(i.discount) || 0)), 0);

  const handleSelectOrder = async (order) => {
    setSelectedOrder({ ...order, items: [] });
    setLoadingItems(true);
    try {
      const { data } = await api.get(`/deliveries/${activeCompany.id}/${order.id}`);
      setSelectedOrder(data);
    } catch (err) {
      console.error('Failed to load order details:', err);
    }
    setLoadingItems(false);
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      const validItems = deliveryForm.items.filter(i => i.product_id && parseFloat(i.quantity) > 0);
      if (validItems.length === 0) throw new Error('Add at least one product line');
      await api.post(`/deliveries/${activeCompany.id}`, {
        ...deliveryForm,
        clientId: deliveryForm.clientId,
        sectorId: deliveryForm.sectorId || null,
        warehouseId: deliveryForm.warehouseId,
        arAccountId: deliveryForm.arAccountId,
        voucherId: deliveryForm.voucherId || null,
        items: validItems.map(i => ({
          ...i,
          discount: parseFloat(i.discount || 0),
          offer: i.offer || null
        })),
      });
      setDeliveryModal(false);
      resetDeliveryForm();
      load();
    } catch (err) { setFormError(err.response?.data?.error || err.message); }
    setSaving(false);
  };

  const resetDeliveryForm = () => setDeliveryForm({
    clientId: '', sectorId: '', warehouseId: '', deliveryDate: new Date().toISOString().split('T')[0],
    arAccountId: '', notes: '', voucherId: '', items: [{ product_id: '', quantity: '', unit_price: '', unit_cost: '', discount: '0.00', offer: '' }]
  });

  const autoFillFromVoucher = async (voucherId) => {
    if (!voucherId) return;
    try {
      const { data: v } = await api.get(`/vouchers/${activeCompany.id}/${voucherId}/details`);
      if (v) {
        const payload = v.payload || {};
        
        // Find default AR account
        const arAccId = payload.ar_account_id || payload.ap_account_id || '';
        
        // Map items
        const rawItems = payload.items || [];
        const items = rawItems.map(i => ({
          product_id: i.productId || i.product_id || '',
          quantity: parseFloat(i.quantity || 0),
          unit_price: parseFloat(i.unitPrice || i.unit_price || 0),
          unit_cost: parseFloat(i.unitCost || i.avgCost || i.unitCost || 0),
          discount: parseFloat(i.discount || 0).toFixed(2),
          offer: i.offer || ''
        }));

        setDeliveryForm(f => ({
          ...f,
          clientId: payload.vendorId || payload.clientId || '',
          warehouseId: payload.warehouseId || '',
          arAccountId: arAccId,
          notes: `Created from Sales Voucher ${v.voucher_number}. Notes: ${payload.notes || ''}`,
          items: items.length > 0 ? items : f.items
        }));
      }
    } catch (err) {
      console.error('Failed to auto-fill delivery form from voucher:', err);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await api.post(`/clients/${activeCompany.id}`, clientForm);
      setClientModal(false);
      setClientForm({ name: '', email: '', phone: '', address: '', sector_id: '', credit_limit: '' });
      load();
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to create client'); }
    setSaving(false);
  };

  const handleCreateSector = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await api.post(`/sectors/${activeCompany.id}`, sectorForm);
      setSectorModal(false);
      setSectorForm({ name: '', description: '' });
      load();
    } catch (err) { setFormError(err.response?.data?.error || 'Failed to create sector'); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/deliveries/${activeCompany.id}/${id}/status`, { status });
      load();
      if (selectedOrder && selectedOrder.id === id) {
        const { data } = await api.get(`/deliveries/${activeCompany.id}/${id}`);
        setSelectedOrder(data);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Status update failed');
    }
  };

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

  const arAccounts = accounts.filter(a => a.category === 'Asset');
  const filteredDeliveries = deliveries.filter(d =>
    d.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.delivery_number?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Truck size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Distribution & Clients</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Supply Chain</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              Manage delivery orders, clients, and sector performance.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 md:mt-0 flex-wrap sm:ml-auto">
          {tab === 'deliveries' && (
            <button onClick={() => { setFormError(''); setDeliveryModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer">
              <Plus size={14} /> New Delivery Order
            </button>
          )}
          {tab === 'clients' && (
            <button onClick={() => { setFormError(''); setClientModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer">
              <Plus size={14} /> Add Client
            </button>
          )}
          {tab === 'sectors' && (
            <button onClick={() => { setFormError(''); setSectorModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer">
              <Plus size={14} /> Add Sector
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      {dashStats && (
        <Motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
          {[
            { label: 'Total Clients', value: dashStats.totalClients, color: '#2563eb', bg: '#dbeafe', icon: Users },
            { label: 'Pending Orders', value: dashStats.pendingOrders, color: '#d97706', bg: '#fef3c7', icon: Clock },
            { label: 'Blocked Clients', value: dashStats.blockedClients, color: '#dc2626', bg: '#fee2e2', icon: AlertCircle },
            { label: 'Month Revenue', value: `$${dashStats.monthRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#059669', bg: '#d1fae5', icon: TrendingUp },
          ].map((s, i) => (
            <Motion.div key={i} variants={fadeUp} whileHover={{ y: -2 }}
              className="card p-4" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <p className="font-display font-extrabold text-[20px] text-slate-900">{s.value}</p>
            </Motion.div>
          ))}
        </Motion.div>
      )}

      {/* Tabs */}
      <div className="tab-bar bg-white border border-slate-100 rounded-xl p-1 flex w-fit mb-5 shadow-sm">
        {[
          { id: 'deliveries', label: 'Delivery Orders', icon: Truck },
          { id: 'clients', label: 'Clients', icon: Users },
          { id: 'sectors', label: 'Sectors', icon: Tag },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab-item px-3 py-1.5 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all ${tab === t.id ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-enterprise pl-9 text-[13px] py-2.5" placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {tab === 'deliveries' && (
          <select className="input-enterprise text-[13px] py-2.5 w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        )}
      </div>

      {/* ─── Deliveries Grid with details drawer ─── */}
      {tab === 'deliveries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
          <div className="card overflow-hidden lg:col-span-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                    <th style={{ width: 130 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Order No.</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Client</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Sector</th>
                    <th style={{ width: 120 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Date</th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 130 }}>Amount</th>
                    <th style={{ width: 130 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Status</th>
                  </tr>
                </thead>
                <Motion.tbody variants={stagger} initial="initial" animate="animate" className="divide-y divide-[#E6EBE8]">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>)
                  ) : filteredDeliveries.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-14 text-slate-400 text-[13px]"><Truck size={28} className="mx-auto mb-2 text-slate-300" />No deliveries found.</td></tr>
                  ) : filteredDeliveries.map(d => {
                    const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING;
                    return (
                      <Motion.tr 
                        key={d.id} 
                        variants={fadeUp} 
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedOrder?.id === d.id ? 'bg-slate-50' : ''}`}
                        onClick={() => handleSelectOrder(d)}
                      >
                        <td className="px-4 py-3"><span className="font-mono font-semibold text-[12px] text-slate-700">{d.delivery_number}</span></td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[13.5px]">{d.client_name}</p>
                          {d.warehouse_name && <p className="text-[11px] text-slate-400 mt-0.5">{d.warehouse_name}</p>}
                        </td>
                        <td className="px-4 py-3"><span className="text-[13px] text-slate-500">{d.sector_name || '—'}</span></td>
                        <td className="px-4 py-3"><span className="text-[13px] text-slate-600">{new Date(d.delivery_date).toLocaleDateString()}</span></td>
                        <td className="text-right font-mono font-semibold text-[13px] text-slate-900 px-4 py-3">
                          ${parseFloat(d.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </td>
                      </Motion.tr>
                    );
                  })}
                </Motion.tbody>
              </table>
            </div>
          </div>

          {/* Details Drawer */}
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
                      <h3 className="font-mono font-bold text-slate-800 text-[14px]">{selectedOrder.delivery_number}</h3>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">Order Details</p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                  </div>

                  <div className="space-y-2 text-[12px] text-slate-600">
                    <div className="flex justify-between"><span>Customer:</span><span className="font-bold text-slate-800">{selectedOrder.client_name}</span></div>
                    <div className="flex justify-between"><span>Date:</span><span className="font-bold text-slate-800">{new Date(selectedOrder.delivery_date).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>Status:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: STATUS_CONFIG[selectedOrder.status]?.bg, color: STATUS_CONFIG[selectedOrder.status]?.color }}>
                        {STATUS_CONFIG[selectedOrder.status]?.label}
                      </span>
                    </div>
                    {selectedOrder.notes && (
                      <div className="border-t border-slate-100 pt-2">
                        <span className="block font-bold text-slate-400 text-[10px] uppercase">Notes</span>
                        <p className="italic text-slate-500">{selectedOrder.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
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

                  {/* Related Documents */}
                  {(() => {
                    const relatedDocs = [];
                    if (selectedOrder?.relatedVoucher) {
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
                    return <RelatedDocuments documents={relatedDocs} currentType="DELIVERY" />;
                  })()}

                  {/* Tracking Progress timeline */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wide">Tracking progression timeline</span>
                    <div className="relative pl-6 space-y-4">
                      {getTimelineSteps(selectedOrder.status).map((step, idx) => (
                        <div key={idx} className="relative">
                          {/* Connecting Line */}
                          {idx < getTimelineSteps(selectedOrder.status).length - 1 && (
                            <div className={`absolute left-[-16px] top-4 bottom-[-16px] w-[2px] ${step.completed ? 'bg-emerald-500' : 'bg-slate-200'}`} />
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

                  {/* Actions */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    {selectedOrder.status === 'PENDING' && (
                      <button onClick={() => updateStatus(selectedOrder.id, 'CONFIRMED')}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer"
                      >
                        Confirm Order
                      </button>
                    )}
                    {selectedOrder.status === 'CONFIRMED' && (
                      <button onClick={() => updateStatus(selectedOrder.id, 'DISPATCHED')}
                        className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-orange-700 transition cursor-pointer"
                      >
                        Dispatch Order
                      </button>
                    )}
                    {selectedOrder.status === 'DISPATCHED' && (
                      <button onClick={() => updateStatus(selectedOrder.id, 'DELIVERED')}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer"
                      >
                        Deliver Order
                      </button>
                    )}
                    {['PENDING', 'CONFIRMED', 'DISPATCHED'].includes(selectedOrder.status) && (
                      <button onClick={() => updateStatus(selectedOrder.id, 'CANCELLED')}
                        className="w-full py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-[12.5px] font-bold transition cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </Motion.div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8 text-center text-slate-400 text-[12.5px] italic">
                  Select a delivery order to view items, notes, and operations.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ─── Clients Table ─── */}
      {tab === 'clients' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Client Name</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Sector</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Contact</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Outstanding</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Credit Limit</th>
                  <th style={{ width: 100 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Status</th>
                  <th style={{ width: 120 }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Risk Mgmt</th>
                </tr>
              </thead>
              <Motion.tbody variants={stagger} initial="initial" animate="animate" className="divide-y divide-[#E6EBE8]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>)
                ) : filteredClients.map(c => {
                  const blocked = c.credit_limit > 0 && parseFloat(c.current_balance) >= parseFloat(c.credit_limit);
                  return (
                    <Motion.tr key={c.id} variants={fadeUp} className={blocked ? 'bg-red-50/30' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[14px]">{c.name}</p>
                        {c.address && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{c.address}</p>}
                      </td>
                      <td className="px-4 py-3"><span className="text-[13px] text-slate-500">{c.sector_name || '—'}</span></td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] text-slate-600">{c.email || '—'}</p>
                        <p className="text-[11px] text-slate-400">{c.phone || ''}</p>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-mono font-semibold text-[13px]" style={{ color: parseFloat(c.current_balance) > 0 ? '#dc2626' : '#059669' }}>
                          ${parseFloat(c.current_balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="text-right font-mono text-[13px] text-slate-500 px-4 py-3">
                        {parseFloat(c.credit_limit) > 0 ? `$${parseFloat(c.credit_limit).toFixed(2)}` : 'Unlimited'}
                      </td>
                      <td className="px-4 py-3">
                        {blocked
                          ? <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Blocked</span>
                          : <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>Active</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedRiskClient(c)}
                          className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-500 transition-colors">
                          Risk Details
                        </button>
                      </td>
                    </Motion.tr>
                  );
                })}
              </Motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Sectors & Revenue Analytics ─── */}
      {tab === 'sectors' && (
        <div className="space-y-6">
          {(() => {
            const totalSectorRev = sectorRevenue.reduce((acc, curr) => acc + (parseFloat(curr.total_revenue) || 0), 0);
            const sectorBarRows = sectorRevenue.map((s) => ({
              account_name: s.sector_name === 'Logistics & Supply Chain' ? 'Logistics & SCM' : s.sector_name,
              p1: parseFloat(s.total_revenue) || 0,
              p2: parseFloat(s.gross_profit) || 0,
            }));
            const sectorCategories = sectorBarRows.map((r) => r.account_name);
            const sectorMagnitudes = sectorBarRows.flatMap((r) => [r.p1, r.p2]);
            const sectorLayout = computeChartLayout(sectorCategories, {
              seriesCount: 2,
              valueMagnitudes: sectorMagnitudes,
              minHeight: 360,
              maxHeight: 640,
              forceHorizontal: true,
            });
            const sectorChartRows = normalizeChartRows(sectorBarRows, 'account_name', sectorLayout);
            const sectorSeries = [
              { dataKey: 'p1', name: 'Revenue', fill: '#118DFF' },
              { dataKey: 'p2', name: 'Gross Profit', fill: '#107C10' },
            ];

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Motion.div variants={fadeUp} className="card p-6 lg:col-span-1">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-[15px] text-slate-800">Revenue Distribution</h3>
                    <TrendingUp size={14} className="text-emerald-500" />
                  </div>
                  {totalSectorRev === 0 ? (
                    <p className="text-[13px] text-slate-400 py-12 text-center">No sector revenue data.</p>
                  ) : (
                    <PowerBIDonut
                      data={sectorRevenue.map((s) => ({ name: s.sector_name, value: parseFloat(s.total_revenue) || 0 }))}
                      colors={CHART_COLORS}
                      height={240}
                      currency="$"
                      centerLabel="Total Revenue"
                      centerValue={`$${totalSectorRev.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    />
                  )}
                </Motion.div>

                <Motion.div variants={fadeUp} className="card p-6 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-[15px] text-slate-800">Revenue vs Gross Profit by Sector</h3>
                    <BarChart2 size={14} className="text-slate-400" />
                  </div>
                  {sectorRevenue.length > 0 ? (
                    <AdaptiveChartFrame layout={sectorLayout}>
                      <DynamicClusteredBarChart
                        chartRows={sectorChartRows}
                        layout={sectorLayout}
                        lookup={sectorChartRows}
                        series={sectorSeries}
                      />
                    </AdaptiveChartFrame>
                  ) : (
                    <p className="text-[13px] text-slate-400">No sector data available</p>
                  )}
                </Motion.div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Breakdown Table */}
            <Motion.div variants={fadeUp} className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 font-display font-bold text-[14px] text-slate-800 flex items-center justify-between">
                <span>Sector Performance Table</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-sans">Tabular view</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Sector</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Orders</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Revenue</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">GP %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EBE8]">
                    {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>)
                      : sectorRevenue.map((s, i) => {
                        const gpPct = (parseFloat(s.gross_profit) / (parseFloat(s.total_revenue) || 1)) * 100;
                        return (
                          <tr key={s.sector_id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                <span className="font-semibold text-[13.5px]">{s.sector_name}</span>
                              </div>
                            </td>
                            <td className="text-right font-mono text-[12px] px-4 py-3">{s.delivery_count}</td>
                            <td className="text-right font-mono font-semibold text-[13px] text-slate-900 px-4 py-3">${parseFloat(s.total_revenue).toLocaleString()}</td>
                            <td className="text-right px-4 py-3">
                              <span className={`text-[12px] font-bold ${gpPct >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>{gpPct.toFixed(1)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Motion.div>

            {/* Top Clients - Visual Re-design */}
            <Motion.div variants={fadeUp} className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-[15px] text-slate-800">Top Clients by Revenue</h3>
                <Users size={14} className="text-slate-400" />
              </div>
              <div className="space-y-5">
                {topClients.map((c, i) => {
                  const maxRev = topClients[0]?.total_revenue || 1;
                  const pct = (parseFloat(c.total_revenue) / parseFloat(maxRev)) * 100;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold shadow-sm ${i === 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                            #{i + 1}
                          </div>
                          <div>
                            <span className="font-semibold text-[13.5px] text-slate-800 block">{c.name}</span>
                            <span className="text-[11px] text-slate-400">{c.order_count} orders recorded</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-extrabold text-[13.5px] text-slate-900 block">${parseFloat(c.total_revenue).toLocaleString()}</span>
                          <span className="text-[10px] uppercase font-bold tracking-tighter text-emerald-600">Top Tier</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <Motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: PROGRESS_GRADIENTS[i % PROGRESS_GRADIENTS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Motion.div>
          </div>
        </div>
      )}

      {/* ─── New Delivery Modal ─── */}
      <AnimatePresence>
        {deliveryModal && (
          <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Motion.div className="modal-box w-full max-w-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}>
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-display font-extrabold text-[17px] text-slate-900">New Delivery Order</h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">Creates stock deduction + journal entry automatically</p>
                </div>
                <button onClick={() => setDeliveryModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={15} /></button>
              </div>
              <div className="p-7 overflow-y-auto max-h-[75vh]">
                <form onSubmit={handleCreateDelivery} className="space-y-4">
                  {formError && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600 font-medium"><AlertTriangle size={14} />{formError}</div>}
                  <div className="mb-4">
                    <label className="field-label block mb-2">Create Delivery From</label>
                    <div className="flex gap-2 p-1 bg-slate-50 border rounded-lg max-w-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode('voucher');
                          setDeliveryForm(f => ({ ...f, voucherId: '' }));
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-md text-[12px] font-bold transition-all border-none ${
                          creationMode === 'voucher'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : 'bg-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Existing Sales Voucher
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode('manual');
                          resetDeliveryForm();
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-md text-[12px] font-bold transition-all border-none ${
                          creationMode === 'manual'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : 'bg-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Manual Delivery
                      </button>
                    </div>
                  </div>

                  {creationMode === 'voucher' && (
                    <div className="mb-4">
                      <label className="field-label">Source Sales Voucher *</label>
                      <select required className="input-enterprise" value={deliveryForm.voucherId} onChange={e => {
                        const vId = e.target.value;
                        setDeliveryForm(f => ({ ...f, voucherId: vId }));
                        autoFillFromVoucher(vId);
                      }}>
                        <option value="">— Select Source Voucher —</option>
                        {salesVouchers.map(v => <option key={v.id} value={v.id}>{v.voucher_number} - PKR {parseFloat(v.total_amount).toLocaleString()}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Client *</label>
                      <select required className="input-enterprise" value={deliveryForm.clientId} onChange={e => setDeliveryForm({ ...deliveryForm, clientId: e.target.value })}>
                        <option value="">— Select client —</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Sector</label>
                      <select className="input-enterprise" value={deliveryForm.sectorId} onChange={e => setDeliveryForm({ ...deliveryForm, sectorId: e.target.value })}>
                        <option value="">— Optional —</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Warehouse *</label>
                      <select required className="input-enterprise" value={deliveryForm.warehouseId} onChange={e => setDeliveryForm({ ...deliveryForm, warehouseId: e.target.value })}>
                        <option value="">— Select warehouse —</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Delivery Date</label>
                      <input type="date" className="input-enterprise" value={deliveryForm.deliveryDate} onChange={e => setDeliveryForm({ ...deliveryForm, deliveryDate: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">AR Account *</label>
                    <select required className="input-enterprise" value={deliveryForm.arAccountId} onChange={e => setDeliveryForm({ ...deliveryForm, arAccountId: e.target.value })}>
                      <option value="">— Select AR account —</option>
                      {arAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="field-label">Order Items *</label>
                      <button type="button" onClick={addDeliveryItem} className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                        <Plus size={12} /> Add item
                      </button>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <div className="min-w-[1000px] divide-y divide-slate-100">
                          {/* Header */}
                          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#EBF2EE] border-b-[2px] border-[#D1E0D8] text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">
                            <div className="col-span-3">Product</div>
                            <div className="col-span-1">Qty</div>
                            <div className="col-span-2">Unit Price</div>
                            <div className="col-span-1">Discount</div>
                            <div className="col-span-2">Offer/Promo</div>
                            <div className="col-span-2">Cost</div>
                            <div className="col-span-1 text-center">Action</div>
                          </div>
                          
                          {/* Rows */}
                          {deliveryForm.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-3 px-4 py-2 items-center hover:bg-slate-50/40">
                              <div className="col-span-3">
                                <select required className="input-enterprise text-[12px] py-1.5 w-full" value={item.product_id} onChange={e => setDeliveryItem(idx, 'product_id', e.target.value)}>
                                  <option value="">Select product</option>
                                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                                </select>
                              </div>
                              <div className="col-span-1">
                                <input type="number" step="0.01" required placeholder="0" className="input-enterprise text-[12px] py-1.5 w-full font-mono" value={item.quantity} onChange={e => setDeliveryItem(idx, 'quantity', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <input type="number" step="0.01" required placeholder="0.00" className="input-enterprise text-[12px] py-1.5 w-full font-mono" value={item.unit_price} onChange={e => setDeliveryItem(idx, 'unit_price', e.target.value)} />
                              </div>
                              <div className="col-span-1">
                                <input type="number" step="0.01" placeholder="0.00" className="input-enterprise text-[12px] py-1.5 w-full font-mono" value={item.discount} onChange={e => setDeliveryItem(idx, 'discount', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <input type="text" placeholder="Promo code / Offer" className="input-enterprise text-[12px] py-1.5 w-full" value={item.offer} onChange={e => setDeliveryItem(idx, 'offer', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <input type="number" step="0.01" placeholder="0.00" className="input-enterprise text-[12px] py-1.5 w-full font-mono bg-slate-50 text-slate-500" value={item.unit_cost} onChange={e => setDeliveryItem(idx, 'unit_cost', e.target.value)} />
                              </div>
                              <div className="col-span-1 flex justify-center">
                                {deliveryForm.items.length > 1 && (
                                  <button type="button" onClick={() => removeDeliveryItem(idx)}
                                    className="w-6 h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center border border-red-100 hover:border-red-200 transition">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order Total (After Discounts)</span>
                        <span className="font-mono font-extrabold text-[16px] text-slate-900">${orderTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Notes</label>
                    <textarea className="input-enterprise" rows={2} value={deliveryForm.notes} onChange={e => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setDeliveryModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                    <Motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={saving} className="btn btn-primary flex-[2]">
                      {saving ? <><RefreshCw size={14} className="animate-spin" /> Processing...</> : 'Create Delivery Order'}
                    </Motion.button>
                  </div>
                </form>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ─── Client Modal ─── */}
      <AnimatePresence>
        {clientModal && (
          <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Motion.div className="modal-box w-full max-w-lg"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}>
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <h2 className="font-display font-extrabold text-[17px] text-slate-900">Add Client</h2>
                <button onClick={() => setClientModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={15} /></button>
              </div>
              <form onSubmit={handleCreateClient} className="p-7 space-y-4">
                {formError && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600 font-medium"><AlertTriangle size={14} />{formError}</div>}
                <div><label className="field-label">Client Name *</label><input required className="input-enterprise" placeholder="Company or individual name" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="field-label">Email</label><input type="email" className="input-enterprise" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} /></div>
                  <div><label className="field-label">Phone</label><input className="input-enterprise" value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} /></div>
                </div>
                <div><label className="field-label">Sector</label>
                  <select className="input-enterprise" value={clientForm.sector_id} onChange={e => setClientForm({ ...clientForm, sector_id: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><label className="field-label">Credit Limit (0 = unlimited)</label><input type="number" step="0.01" className="input-enterprise" placeholder="0.00" value={clientForm.credit_limit} onChange={e => setClientForm({ ...clientForm, credit_limit: e.target.value })} /></div>
                <div><label className="field-label">Address</label><textarea className="input-enterprise" rows={2} value={clientForm.address} onChange={e => setClientForm({ ...clientForm, address: e.target.value })} /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setClientModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <Motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} disabled={saving} className="btn btn-primary flex-[2]">
                    {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : 'Add Client'}
                  </Motion.button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sector Modal ─── */}
      <AnimatePresence>
        {sectorModal && (
          <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Motion.div className="modal-box w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}>
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <h2 className="font-display font-extrabold text-[17px] text-slate-900">Add Sector</h2>
                <button onClick={() => setSectorModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={15} /></button>
              </div>
              <form onSubmit={handleCreateSector} className="p-7 space-y-4">
                {formError && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600"><AlertTriangle size={14} />{formError}</div>}
                <div><label className="field-label">Sector Name *</label><input required className="input-enterprise" placeholder="e.g. Retail, Healthcare" value={sectorForm.name} onChange={e => setSectorForm({ ...sectorForm, name: e.target.value })} /></div>
                <div><label className="field-label">Description</label><textarea className="input-enterprise" rows={2} value={sectorForm.description} onChange={e => setSectorForm({ ...sectorForm, description: e.target.value })} /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setSectorModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <Motion.button type="submit" disabled={saving} className="btn btn-primary flex-[2]">{saving ? 'Saving...' : 'Add Sector'}</Motion.button>
                </div>
              </form>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <RelationshipRiskModal 
        isOpen={!!selectedRiskClient} 
        onClose={() => { setSelectedRiskClient(null); load(); }} 
        entityType="CUSTOMER" 
        entityId={selectedRiskClient?.id} 
        entityName={selectedRiskClient?.name} 
        outstandingBalance={parseFloat(selectedRiskClient?.current_balance || 0)} 
      />
    </div>
  );
}
