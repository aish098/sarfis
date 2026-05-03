import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Users, Tag, Plus, Search, AlertCircle,
  CheckCircle2, Clock, XCircle, ChevronRight, X,
  RefreshCw, AlertTriangle, Eye, TrendingUp, BarChart2
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#14b8a6'];

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const STATUS_CONFIG = {
  PENDING:    { icon: Clock,        color: '#d97706', bg: '#fef3c7', label: 'Pending' },
  CONFIRMED:  { icon: CheckCircle2, color: '#2563eb', bg: '#dbeafe', label: 'Confirmed' },
  DISPATCHED: { icon: Truck,        color: '#7c3aed', bg: '#ede9fe', label: 'Dispatched' },
  DELIVERED:  { icon: CheckCircle2, color: '#059669', bg: '#d1fae5', label: 'Delivered' },
  CANCELLED:  { icon: XCircle,      color: '#dc2626', bg: '#fee2e2', label: 'Cancelled' },
};

export default function DistributionPage() {
  const { activeCompany } = useAuthStore();
  const [tab, setTab] = useState('deliveries'); // deliveries | clients | sectors
  const [deliveries, setDeliveries] = useState([]);
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

  // Modals
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [sectorModal, setSectorModal] = useState(false);

  // Forms
  const [deliveryForm, setDeliveryForm] = useState({
    clientId: '', sectorId: '', warehouseId: '', deliveryDate: new Date().toISOString().split('T')[0],
    arAccountId: '', notes: '', items: [{ product_id: '', quantity: '', unit_price: '', unit_cost: '' }]
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
      const [del, cli, sec, prod, wh, accs, stats] = await Promise.all([
        api.get(`/deliveries/${activeCompany.id}`, { params }),
        api.get(`/clients/${activeCompany.id}`),
        api.get(`/sectors/${activeCompany.id}`),
        api.get(`/products/${activeCompany.id}`),
        api.get(`/warehouses/${activeCompany.id}`),
        api.get('/accounts'),
        api.get(`/distribution/${activeCompany.id}/dashboard`),
      ]);
      setDeliveries(del.data);
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

  // Delivery form helpers
  const addDeliveryItem = () => setDeliveryForm(f => ({
    ...f, items: [...f.items, { product_id: '', quantity: '', unit_price: '', unit_cost: '' }]
  }));
  const setDeliveryItem = (idx, field, val) => {
    const items = [...deliveryForm.items];
    items[idx][field] = val;
    // Auto-fill cost price from product
    if (field === 'product_id') {
      const prod = products.find(p => String(p.id) === String(val));
      if (prod) { items[idx].unit_price = prod.unit_price; items[idx].unit_cost = prod.cost_price; }
    }
    setDeliveryForm(f => ({ ...f, items }));
  };
  const removeDeliveryItem = (idx) => setDeliveryForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const orderTotal = deliveryForm.items.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)), 0);

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
        items: validItems,
      });
      setDeliveryModal(false);
      resetDeliveryForm();
      load();
    } catch (err) { setFormError(err.response?.data?.error || err.message); }
    setSaving(false);
  };

  const resetDeliveryForm = () => setDeliveryForm({
    clientId: '', sectorId: '', warehouseId: '', deliveryDate: new Date().toISOString().split('T')[0],
    arAccountId: '', notes: '', items: [{ product_id: '', quantity: '', unit_price: '', unit_cost: '' }]
  });

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
    try { await api.patch(`/deliveries/${activeCompany.id}/${id}/status`, { status }); load(); }
    catch (err) { alert(err.response?.data?.error || 'Status update failed'); }
  };

  const arAccounts = accounts.filter(a => a.type === 'Asset');
  const filteredDeliveries = deliveries.filter(d =>
    d.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.delivery_number?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900">Distribution & Clients</h1>
          <p className="text-[13px] text-slate-500 mt-1">Manage delivery orders, clients, and sector performance</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {tab === 'deliveries' && (
            <Motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setFormError(''); setDeliveryModal(true); }}
              className="btn btn-primary"><Plus size={15} /> New Delivery Order</Motion.button>
          )}
          {tab === 'clients' && (
            <Motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setFormError(''); setClientModal(true); }}
              className="btn btn-primary"><Plus size={15} /> Add Client</Motion.button>
          )}
          {tab === 'sectors' && (
            <Motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setFormError(''); setSectorModal(true); }}
              className="btn btn-primary"><Plus size={15} /> Add Sector</Motion.button>
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
      <div className="tab-bar mb-5 w-fit">
        {[
          { id: 'deliveries', label: 'Delivery Orders', icon: Truck },
          { id: 'clients', label: 'Clients', icon: Users },
          { id: 'sectors', label: 'Sectors', icon: Tag },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab-item ${tab === t.id ? 'active' : ''}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-enterprise input-search text-[13px] py-2.5" placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {tab === 'deliveries' && (
          <select className="input-enterprise text-[13px] py-2.5 w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        )}
      </div>

      {/* ─── Deliveries Table ─── */}
      {tab === 'deliveries' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Order No.</th>
                  <th>Client</th>
                  <th>Sector</th>
                  <th style={{ width: 120 }}>Date</th>
                  <th className="text-right" style={{ width: 130 }}>Amount</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <Motion.tbody variants={stagger} initial="initial" animate="animate">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>)
                ) : filteredDeliveries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-14 text-slate-400 text-[13px]"><Truck size={28} className="mx-auto mb-2 text-slate-300" />No deliveries found.</td></tr>
                ) : filteredDeliveries.map(d => {
                  const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING;
                  return (
                    <Motion.tr key={d.id} variants={fadeUp}>
                      <td><span className="font-mono font-semibold text-[12px] text-slate-700">{d.delivery_number}</span></td>
                      <td>
                        <p className="font-semibold text-[13.5px]">{d.client_name}</p>
                        {d.warehouse_name && <p className="text-[11px] text-slate-400 mt-0.5">{d.warehouse_name}</p>}
                      </td>
                      <td><span className="text-[13px] text-slate-500">{d.sector_name || '—'}</span></td>
                      <td><span className="text-[13px] text-slate-600">{new Date(d.delivery_date).toLocaleDateString()}</span></td>
                      <td className="text-right font-mono font-semibold text-[13px] text-slate-900">
                        ${parseFloat(d.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className="badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {d.status === 'PENDING' && (
                            <button onClick={() => updateStatus(d.id, 'CONFIRMED')}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                              Confirm
                            </button>
                          )}
                          {d.status === 'CONFIRMED' && (
                            <button onClick={() => updateStatus(d.id, 'DISPATCHED')}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-slate-100 text-slate-600">
                              Dispatch
                            </button>
                          )}
                          {d.status === 'DISPATCHED' && (
                            <button onClick={() => updateStatus(d.id, 'DELIVERED')}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                              Deliver
                            </button>
                          )}
                          {!['DELIVERED', 'CANCELLED'].includes(d.status) && (
                            <button onClick={() => updateStatus(d.id, 'CANCELLED')}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </Motion.tr>
                  );
                })}
              </Motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Clients Table ─── */}
      {tab === 'clients' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Sector</th>
                  <th>Contact</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Credit Limit</th>
                  <th style={{ width: 100 }}>Status</th>
                </tr>
              </thead>
              <Motion.tbody variants={stagger} initial="initial" animate="animate">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>)
                ) : filteredClients.map(c => {
                  const blocked = c.credit_limit > 0 && parseFloat(c.current_balance) >= parseFloat(c.credit_limit);
                  return (
                    <Motion.tr key={c.id} variants={fadeUp} className={blocked ? 'bg-red-50/30' : ''}>
                      <td>
                        <p className="font-semibold text-[14px]">{c.name}</p>
                        {c.address && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{c.address}</p>}
                      </td>
                      <td><span className="text-[13px] text-slate-500">{c.sector_name || '—'}</span></td>
                      <td>
                        <p className="text-[13px] text-slate-600">{c.email || '—'}</p>
                        <p className="text-[11px] text-slate-400">{c.phone || ''}</p>
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-semibold text-[13px]" style={{ color: parseFloat(c.current_balance) > 0 ? '#dc2626' : '#059669' }}>
                          ${parseFloat(c.current_balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="text-right font-mono text-[13px] text-slate-500">
                        {parseFloat(c.credit_limit) > 0 ? `$${parseFloat(c.credit_limit).toFixed(2)}` : 'Unlimited'}
                      </td>
                      <td>
                        {blocked
                          ? <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Blocked</span>
                          : <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>Active</span>}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Distribution Pie Chart */}
            <Motion.div variants={fadeUp} className="card p-6 lg:col-span-1">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-[15px] text-slate-800">Revenue Distribution</h3>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="h-[280px] w-full min-h-[280px]">
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={sectorRevenue}
                        nameKey="sector_name"
                        dataKey="total_revenue"
                        cx="50%"
                        cy="50%"
                        innerRadius={0}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {sectorRevenue.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      formatter={(v) => `$${parseFloat(v).toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Detailed Side Legend */}
              <div className="space-y-2 mt-4">
                {sectorRevenue.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-slate-600 font-bold">{s.sector_name}</span>
                    </div>
                    <span className="text-slate-400 font-mono font-bold">
                      {((parseFloat(s.total_revenue) / sectorRevenue.reduce((a, b) => a + parseFloat(b.total_revenue), 0)) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Motion.div>

            {/* Revenue vs Profit Bar Chart */}
            <Motion.div variants={fadeUp} className="card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-[15px] text-slate-800">Revenue vs Gross Profit</h3>
                <BarChart2 size={14} className="text-slate-400" />
              </div>
              <div className="h-[280px] w-full min-h-[280px]">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sectorRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="sector_name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000) + 'k' : v}`} />
                    <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                       formatter={(v) => `$${parseFloat(v).toLocaleString()}`}
                    />
                    <Bar dataKey="total_revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={25} />
                    <Bar dataKey="gross_profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Breakdown Table */}
            <Motion.div variants={fadeUp} className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 font-display font-bold text-[14px] text-slate-800 flex items-center justify-between">
                <span>Sector Performance Table</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-sans">Tabular view</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sector</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">GP %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j}><div className="skeleton h-4" /></td>)}</tr>)
                    : sectorRevenue.map((s, i) => {
                      const gpPct = (parseFloat(s.gross_profit) / (parseFloat(s.total_revenue) || 1)) * 100;
                      return (
                        <tr key={s.sector_id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="font-semibold text-[13.5px]">{s.sector_name}</span>
                            </div>
                          </td>
                          <td className="text-right font-mono text-[12px]">{s.delivery_count}</td>
                          <td className="text-right font-mono font-semibold text-[13px] text-slate-900">${parseFloat(s.total_revenue).toLocaleString()}</td>
                          <td className="text-right">
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
                          style={{ background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, #94a3b8)` }} 
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                    <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <div className="col-span-5">Product</div>
                        <div className="col-span-2">Qty</div>
                        <div className="col-span-2">Unit Price</div>
                        <div className="col-span-2">Cost</div>
                        <div className="col-span-1" />
                      </div>
                      {deliveryForm.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-slate-100">
                          <div className="col-span-5">
                            <select className="input-enterprise text-[12px] py-1.5" value={item.product_id} onChange={e => setDeliveryItem(idx, 'product_id', e.target.value)}>
                              <option value="">Select product</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <input type="number" step="0.01" placeholder="0" className="input-enterprise text-[12px] py-1.5" value={item.quantity} onChange={e => setDeliveryItem(idx, 'quantity', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <input type="number" step="0.01" placeholder="0.00" className="input-enterprise text-[12px] py-1.5" value={item.unit_price} onChange={e => setDeliveryItem(idx, 'unit_price', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <input type="number" step="0.01" placeholder="0.00" className="input-enterprise text-[12px] py-1.5" value={item.unit_cost} onChange={e => setDeliveryItem(idx, 'unit_cost', e.target.value)} />
                          </div>
                          <div className="col-span-1 flex items-center justify-center">
                            {deliveryForm.items.length > 1 && (
                              <button type="button" onClick={() => removeDeliveryItem(idx)}
                                className="w-6 h-6 rounded text-red-400 hover:bg-red-50 flex items-center justify-center">
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order Total</span>
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
                <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
}
