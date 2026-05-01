// ──────────────────────────────────────────────────
// Drop these widgets into your existing DashboardOverview.jsx
// Import and add to the grid layout
// ──────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertTriangle, Package, TrendingUp, Users, BarChart3, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.38 } } };
const axisTick = { fontSize: 11, fill: '#64748b', fontWeight: 600 };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border-none bg-white/95 backdrop-blur px-4 py-3 shadow-xl shadow-slate-900/10 min-w-[140px]">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            <span className="text-[12px] font-semibold text-slate-600">{p.name}</span>
          </div>
          <span className="font-mono font-bold text-slate-800 text-[12px]">${parseFloat(p.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── 1. Low Stock Alert Widget ────────────────────────────
export function LowStockWidget() {
  const { activeCompany } = useAuthStore();
  const navigate = useNavigate();
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    api.get(`/stock/${activeCompany.id}/low`)
      .then(r => setLowStock(r.data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCompany]);

  if (!loading && lowStock.length === 0) return null;

  return (
    <Motion.div variants={fadeUp} className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#fef3c7' }}>
            <AlertTriangle size={15} style={{ color: '#d97706' }} />
          </div>
          <h3 className="font-display font-bold text-[14px] text-slate-900">Low Stock Alerts</h3>
        </div>
        <button onClick={() => navigate('/dashboard/inventory')}
          className="text-[12px] font-semibold text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-0.5">
          Manage <ArrowUpRight size={12} />
        </button>
      </div>
      <div className="divide-y divide-slate-50">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-14" />
            </div>
          ))
        ) : (
          <Motion.div variants={stagger} initial="initial" animate="animate">
            {lowStock.map((p) => (
              <Motion.div key={p.product_id} variants={fadeUp}
                className="flex items-center justify-between px-5 py-3 hover:bg-amber-50/30 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#fef3c7' }}>
                    <Package size={12} style={{ color: '#d97706' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] text-slate-800 truncate">{p.product_name}</p>
                    <p className="font-mono text-[10px] text-slate-400">{p.sku}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-mono font-bold text-[13px] text-amber-600">{parseFloat(p.total_qty).toFixed(0)} left</p>
                  <p className="text-[10px] text-slate-400">min: {p.reorder_level}</p>
                </div>
              </Motion.div>
            ))}
          </Motion.div>
        )}
      </div>
    </Motion.div>
  );
}

// ─── 2. Stock Value Widget ─────────────────────────────────
export function StockValueWidget() {
  const { activeCompany } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    api.get(`/inventory/${activeCompany.id}/dashboard`)
      .then(r => setStats(r.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCompany]);

  return (
    <Motion.div variants={fadeUp} whileHover={{ y: -2 }}
      className="card p-5 cursor-pointer" onClick={() => navigate('/dashboard/inventory')}
      style={{ borderLeft: '3px solid #2563eb' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Stock Value</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#dbeafe' }}>
          <BarChart3 size={16} style={{ color: '#2563eb' }} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-7 w-32" />
      ) : (
        <p className="font-display font-extrabold text-[22px] text-slate-900">
          ${parseFloat(stats?.totalStockValue || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
        </p>
      )}
      <p className="text-[12px] text-slate-500 mt-1">
        {stats?.totalProducts || 0} products · {stats?.lowStockCount || 0} low stock
      </p>
    </Motion.div>
  );
}

// ─── 3. Sector Revenue Chart ───────────────────────────────
export function SectorRevenueWidget() {
  const { activeCompany } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    api.get(`/sectors/${activeCompany.id}/revenue`)
      .then(r => setData(r.data.slice(0, 6).map(s => ({
        name: s.sector_name.length > 12 ? s.sector_name.slice(0, 12) + '…' : s.sector_name,
        revenue: parseFloat(s.total_revenue),
        profit: parseFloat(s.gross_profit),
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCompany]);

  return (
    <Motion.div variants={fadeUp} className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-[15px] text-slate-900">Sector Revenue</h3>
          <p className="text-[12px] text-slate-500 mt-0.5">Profitability by business segment</p>
        </div>
        <button onClick={() => navigate('/dashboard/distribution')}
          className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
          View All <ArrowUpRight size={12} />
        </button>
      </div>
      {loading ? (
        <div className="skeleton h-40 w-full" />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <BarChart3 size={28} className="text-slate-200 mb-2" />
          <p className="text-[13px] text-slate-400">No sector data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Motion.div>
  );
}

// ─── 4. Top Clients Widget ─────────────────────────────────
export function TopClientsWidget() {
  const { activeCompany } = useAuthStore();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    api.get(`/distribution/${activeCompany.id}/top-clients?limit=5`)
      .then(r => setClients(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCompany]);

  return (
    <Motion.div variants={fadeUp} className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <Users size={15} style={{ color: '#059669' }} />
          </div>
          <h3 className="font-display font-bold text-[14px] text-slate-900">Top Clients</h3>
        </div>
        <button onClick={() => navigate('/dashboard/distribution')}
          className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
          All Clients <ArrowUpRight size={12} />
        </button>
      </div>
      <div className="p-5 space-y-3.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-6 h-6 rounded-full" />
              <div className="skeleton h-3.5 flex-1" />
              <div className="skeleton h-3.5 w-20" />
            </div>
          ))
        ) : clients.length === 0 ? (
          <p className="text-center text-[13px] text-slate-400 py-6">No delivery data yet</p>
        ) : (
          <Motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3.5">
            {clients.map((c, i) => {
              const maxRev = parseFloat(clients[0]?.total_revenue || 1);
              const pct = (parseFloat(c.total_revenue) / maxRev) * 100;
              return (
                <Motion.div key={c.id} variants={fadeUp}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: '#f1f5f9', color: '#64748b' }}>{i + 1}</span>
                      <span className="font-semibold text-[13px] text-slate-800">{c.name}</span>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-emerald-700">
                      ${parseFloat(c.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                    <div className="progress-bar">
                    <Motion.div className="progress-fill" initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.08 }}
                      style={{ background: 'linear-gradient(90deg, #059669, #10b981)' }} />
                  </div>
                </Motion.div>
              );
            })}
          </Motion.div>
        )}
      </div>
    </Motion.div>
  );
}
