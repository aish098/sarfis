import { useState, useEffect, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertTriangle, Package, Users, BarChart3, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { computeChartLayout, normalizeChartRows, AdaptiveChartFrame, PBI } from '../../components/charts/chartEngine';
import { DynamicClusteredBarChart } from '../../components/charts/DynamicCharts';
import { PowerBICard } from '../../components/charts/PBIDashboardPrimitives';
import { pbiFadeUp, pbiStagger } from '../../components/charts/pbiAnimations';
import AnalyticsCard from '../../components/ui/AnalyticsCard';

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
    <PowerBICard title="Low Stock Alerts" subtitle="Items below reorder level" accent={PBI.negative}
      action={
        <button onClick={() => navigate('/dashboard/inventory')} className="text-[11px] font-semibold text-[#E81123] flex items-center gap-0.5 shrink-0">
          Manage <ArrowUpRight size={12} />
        </button>
      }
    >
      <div className="divide-y divide-[#f3f2f1] -mx-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-1">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-14" />
            </div>
          ))
        ) : (
          <Motion.div variants={pbiStagger} initial="initial" animate="animate">
            {lowStock.map((p) => (
              <Motion.div key={p.product_id} variants={pbiFadeUp}
                className="flex items-center justify-between py-2.5 px-1 hover:bg-[#faf9f8] rounded transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-[#fde7e9]">
                    <Package size={12} style={{ color: PBI.negative }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[12px] text-[#252423] truncate">{p.product_name}</p>
                    <p className="font-mono text-[10px] text-[#8a8886]">{p.sku}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-mono font-bold text-[12px]" style={{ color: PBI.negative }}>{parseFloat(p.total_qty).toFixed(0)} left</p>
                  <p className="text-[10px] text-[#8a8886]">min {p.reorder_level}</p>
                </div>
              </Motion.div>
            ))}
          </Motion.div>
        )}
      </div>
    </PowerBICard>
  );
}

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
    <Motion.div variants={pbiFadeUp} whileHover={{ boxShadow: '0 6.4px 14.4px rgba(0,0,0,.08)' }}
      className="bg-white rounded-lg border border-[#edebe9] p-5 shadow-[0_1.6px_3.6px_rgba(0,0,0,.06)] cursor-pointer transition-shadow"
      style={{ borderTop: `3px solid ${PBI.revenue}` }}
      onClick={() => navigate('/dashboard/inventory')}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Stock Value</p>
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${PBI.revenue}18` }}>
          <BarChart3 size={15} style={{ color: PBI.revenue }} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-7 w-32" />
      ) : (
        <p className="font-mono font-bold text-[24px] text-[#252423]">
          PKR {parseFloat(stats?.totalStockValue || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
        </p>
      )}
      <p className="text-[11px] text-[#8a8886] mt-1.5">
        {stats?.totalProducts || 0} products · {stats?.lowStockCount || 0} low stock
      </p>
    </Motion.div>
  );
}

export function SectorRevenueWidget() {
  const { activeCompany } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    api.get(`/sectors/${activeCompany.id}/revenue`)
      .then(r => setData(r.data.slice(0, 12).map(s => ({
        name: s.sector_name,
        fullName: s.sector_name,
        revenue: parseFloat(s.total_revenue),
        profit: parseFloat(s.gross_profit),
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCompany]);

  const layout = useMemo(() => computeChartLayout(
    data.map(d => d.name),
    { seriesCount: 2, valueMagnitudes: data.flatMap(d => [d.revenue, d.profit]), minHeight: 240, maxHeight: 520, forceHorizontal: true }
  ), [data]);
  const chartRows = useMemo(() => normalizeChartRows(data, 'name', layout), [data, layout]);

  const series = [
    { dataKey: 'revenue', name: 'Revenue', fill: PBI.revenue },
    { dataKey: 'profit', name: 'Gross Profit', fill: PBI.positive },
  ];

  return (
    <AnalyticsCard
      title="Sector Revenue"
      subtitle="Revenue and gross profit by segment"
      actions={[
        { label: 'View all', onClick: () => navigate('/dashboard/distribution'), primary: true }
      ]}
    >
      {loading ? (
        <div className="skeleton h-44 w-full rounded" />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <BarChart3 size={28} className="text-[#edebe9] mb-2" />
          <p className="text-[12px] text-[#8a8886]">No sector data yet</p>
        </div>
      ) : (
        <AdaptiveChartFrame layout={layout} fallbackHeight={240}>
          <DynamicClusteredBarChart chartRows={chartRows} layout={layout} lookup={chartRows} series={series} />
        </AdaptiveChartFrame>
      )}
    </AnalyticsCard>
  );
}

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
    <PowerBICard
      title="Top Clients"
      subtitle="By delivery revenue"
      action={
        <button onClick={() => navigate('/dashboard/distribution')} className="text-[11px] font-semibold text-[#107C10] flex items-center gap-0.5 shrink-0">
          All clients <ArrowUpRight size={12} />
        </button>
      }
    >
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="skeleton w-6 h-6 rounded-full" />
            <div className="skeleton h-3.5 flex-1" />
            <div className="skeleton h-3.5 w-20" />
          </div>
        ))
      ) : clients.length === 0 ? (
        <p className="text-center text-[12px] text-[#8a8886] py-6">No delivery data yet</p>
      ) : (
        <Motion.div variants={pbiStagger} initial="initial" animate="animate" className="space-y-4">
          {clients.map((c, i) => {
            const maxRev = parseFloat(clients[0]?.total_revenue || 1);
            const pct = (parseFloat(c.total_revenue) / maxRev) * 100;
            return (
              <Motion.div key={c.id} variants={pbiFadeUp}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-[#f3f2f1] text-[#605e5c] shrink-0">{i + 1}</span>
                    <span className="font-semibold text-[12px] text-[#252423] truncate">{c.name}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold shrink-0 ml-2" style={{ color: PBI.positive }}>
                    PKR {parseFloat(c.total_revenue).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: '#f3f2f1' }}>
                  <Motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08 }}
                    style={{ background: `linear-gradient(90deg, ${PBI.positive}, ${PBI.revenue})` }}
                  />
                </div>
              </Motion.div>
            );
          })}
        </Motion.div>
      )}
    </PowerBICard>
  );
}
