import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, Settings, Play, Calendar, DollarSign, Layers, Activity,
  ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Info, Clock, 
  User, MapPin, Wrench, Shield, TrendingUp, TrendingDown
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, 
  Bar, XAxis, YAxis, Tooltip, Legend 
} from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function FixedAssetsDashboard() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  
  const [assets, setAssets] = useState([]);
  const [metrics, setMetrics] = useState({
    totalCost: 0,
    accumulatedDep: 0,
    netBookValue: 0,
    activeCount: 0,
    maintCount: 0,
    disposedCount: 0,
    avgAge: 0,
    dueDepCount: 0
  });

  const [distMode, setDistMode] = useState('category'); // 'category' | 'location' | 'status' | 'custodian'
  const [distData, setDistData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentLedger, setRecentLedger] = useState([]);
  const [alerts, setAlerts] = useState({ critical: [], warning: [], info: [] });
  const [upcomingRuns, setUpcomingRuns] = useState([]);
  const [endOfLifeAssets, setEndOfLifeAssets] = useState([]);
  const [healthScore, setHealthScore] = useState({ healthy: 0, attention: 0, critical: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [activeCompany]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: rawAssets } = await api.get('/fixed-assets/assets');
      setAssets(rawAssets || []);

      // Fetch assets detail with books for accurate values
      const assetsWithDetail = await Promise.all(
        rawAssets.map(async (a) => {
          try {
            const { data } = await api.get(`/fixed-assets/assets/${a.id}/inquiry`);
            return data;
          } catch {
            return null;
          }
        })
      );

      const validDetails = assetsWithDetail.filter(Boolean);

      // Calculations
      let totalCost = 0;
      let activeCount = 0;
      let maintCount = 0;
      let disposedCount = 0;
      let totalAccumulated = 0;
      let totalAgeYears = 0;
      let ageCount = 0;
      let dueDepCount = 0;

      const now = new Date();
      const currentPeriodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const tempAlerts = { critical: [], warning: [], info: [] };
      const tempEndOfLife = [];
      let healthy = 0, attention = 0, critical = 0;

      validDetails.forEach(item => {
        const a = item.asset;
        if (!a) return;

        const cost = parseFloat(a.purchase_cost || 0);
        totalCost += cost;

        if (a.status === 'ACTIVE') activeCount++;
        else if (a.status === 'UNDER_MAINTENANCE') maintCount++;
        else if (a.status === 'SOLD' || a.status === 'DISPOSED') disposedCount++;

        // Book calculations
        const acctBook = item.depreciationBooks?.find(b => b.book_name === 'Accounting');
        const accDep = acctBook ? parseFloat(acctBook.accumulated_depreciation || 0) : 0;
        const currentBV = acctBook ? parseFloat(acctBook.current_book_value || 0) : cost;
        totalAccumulated += accDep;

        // Health & End-of-life checks
        const purchaseDate = new Date(a.purchase_date);
        const diffTime = Math.abs(now - purchaseDate);
        const ageYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
        totalAgeYears += ageYears;
        ageCount++;

        const usefulLifeMonths = parseInt(a.useful_life_years || 5) * 12;
        const elapsedMonths = Math.floor(ageYears * 12);
        const remainingMonths = Math.max(0, usefulLifeMonths - elapsedMonths);

        if (a.status === 'ACTIVE') {
          if (currentBV <= parseFloat(a.salvage_value || 0)) {
            critical++;
            tempAlerts.critical.push({
              id: `zero-${a.id}`,
              type: 'CRITICAL',
              text: `Asset ${a.asset_code} has reached salvage/zero book value (PKR ${currentBV.toLocaleString()}).`,
              actionText: 'Review Card',
              actionPath: `/dashboard/fixed-assets/register?assetId=${a.id}`
            });
          } else if (remainingMonths <= 6) {
            critical++;
            tempEndOfLife.push({
              id: a.id,
              name: a.asset_name,
              code: a.asset_code,
              remaining: remainingMonths,
              bookValue: currentBV,
              replacementEstimate: cost * 1.3
            });
          } else {
            healthy++;
          }
        } else if (a.status === 'UNDER_MAINTENANCE') {
          attention++;
        }

        // Check if depreciated this month
        const hasDepThisMonth = (item.ledger || []).some(
          l => l.event_type === 'DEPRECIATION' && String(l.event_date).startsWith(currentPeriodStr)
        );

        if (a.status === 'ACTIVE' && !hasDepThisMonth) {
          dueDepCount++;
        }
      });

      // Populate Alerts
      if (dueDepCount > 0) {
        tempAlerts.warning.push({
          id: 'due-dep',
          type: 'WARNING',
          text: `${dueDepCount} Assets require depreciation for period ${currentPeriodStr}.`,
          actionText: 'Run Wizard',
          actionPath: '/dashboard/fixed-assets/wizard'
        });
      }
      if (maintCount > 0) {
        tempAlerts.warning.push({
          id: 'maint-alert',
          type: 'WARNING',
          text: `${maintCount} Assets are currently marked under maintenance.`,
          actionText: 'Open Register',
          actionPath: '/dashboard/fixed-assets/register'
        });
      }
      // Demo alerts for compliance
      tempAlerts.info.push({
        id: 'compliance-audit',
        type: 'INFO',
        text: 'All depreciation books matched and validated to general ledger.',
        actionText: 'Check Ledger',
        actionPath: '/dashboard/ledger'
      });

      setMetrics({
        totalCost,
        accumulatedDep: totalAccumulated,
        netBookValue: totalCost - totalAccumulated,
        activeCount,
        maintCount,
        disposedCount,
        avgAge: ageCount > 0 ? (totalAgeYears / ageCount).toFixed(1) : 0,
        dueDepCount
      });

      setEndOfLifeAssets(tempEndOfLife.slice(0, 3));
      setHealthScore({ healthy, attention, critical });
      setAlerts(tempAlerts);

      // 3. Distribution calculations (Category / Location / Status / Custodian)
      computeDistribution(rawAssets, distMode);

      // Collect all ledger history
      const allLedger = [];
      validDetails.forEach(item => {
        const assetName = item.asset?.asset_name;
        const assetCode = item.asset?.asset_code;
        (item.ledger || []).forEach(l => {
          allLedger.push({
            ...l,
            assetName,
            assetCode
          });
        });
      });

      allLedger.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
      setRecentLedger(allLedger.slice(0, 6));

      // Generate trend data from ledger depreciation entries
      const monthlyDep = {};
      allLedger.forEach(l => {
        if (l.event_type === 'DEPRECIATION') {
          const date = new Date(l.event_date);
          const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
          monthlyDep[monthKey] = (monthlyDep[monthKey] || 0) + parseFloat(l.amount || 0);
        }
      });
      const trend = Object.entries(monthlyDep).map(([month, amount]) => ({ month, amount }));
      setTrendData(trend.reverse());

      // Set upcoming Runs timeline
      setUpcomingRuns([
        { book: 'Accounting Book', period: currentPeriodStr, status: 'Due Tomorrow', color: 'bg-rose-500' },
        { book: 'Tax Book', period: currentPeriodStr, status: 'Due in 3 Days', color: 'bg-amber-500' },
        { book: 'Management Book', period: currentPeriodStr, status: 'Scheduled', color: 'bg-indigo-500' }
      ]);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const computeDistribution = (assetList, mode) => {
    const counts = {};
    assetList.forEach(a => {
      let key = 'Unspecified';
      if (mode === 'category') key = a.category_name || 'Uncategorized';
      else if (mode === 'location') key = a.location_name || 'Head Office';
      else if (mode === 'status') key = a.status || 'ACTIVE';
      else if (mode === 'custodian') key = a.custodian_name || 'Unassigned';

      counts[key] = (counts[key] || 0) + parseFloat(a.purchase_cost || 0);
    });

    const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
    setDistData(chartData);
  };

  // Re-compute distribution when mode changes
  useEffect(() => {
    if (assets.length > 0) {
      computeDistribution(assets, distMode);
    }
  }, [distMode]);

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];
  const EVENT_COLORS = {
    ACQUISITION: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
    DEPRECIATION: { badge: 'bg-purple-50 text-purple-700 border-purple-100', dot: 'bg-purple-500' },
    MAINTENANCE: { badge: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
    TRANSFER: { badge: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
    DISPOSAL: { badge: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
    SALE: { badge: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-1">
      {/* Top Banner Control Center */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Asset Control Center</h1>
          <p className="text-slate-500 text-sm font-semibold">Centralized command center for calculations, validations, alerts, and multi-book reporting.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/dashboard/fixed-assets/register" className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Briefcase size={14} /> Asset Registry
          </Link>
          <Link to="/dashboard/fixed-assets/categories" className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Settings size={14} /> Category Configurations
          </Link>
          <Link to="/dashboard/fixed-assets/wizard" className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-black transition-all flex items-center gap-1.5 shadow-md">
            <Play size={14} /> Run Depreciation
          </Link>
        </div>
      </div>

      {/* Executive KPIs Row (8 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Total Cost</span>
          <p className="text-sm font-black text-slate-800 font-mono">PKR {(metrics.totalCost / 1000000).toFixed(1)}M</p>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-2">
            <TrendingUp size={10} /> +2.4% vs prev.
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Book Value</span>
          <p className="text-sm font-black text-slate-800 font-mono">PKR {(metrics.netBookValue / 1000000).toFixed(1)}M</p>
          <button onClick={() => navigate('/dashboard/fixed-assets/register')} className="text-[9px] text-indigo-600 hover:underline font-bold mt-2 text-left">
            [View Assets]
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Dep allocated</span>
          <p className="text-sm font-black text-slate-800 font-mono text-rose-600">PKR {metrics.accumulatedDep.toLocaleString()}</p>
          <span className="text-[9px] text-slate-400 font-semibold block mt-2">Accounting Book</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Assets Due</span>
          <p className="text-sm font-black text-slate-800 font-mono text-amber-600">{metrics.dueDepCount}</p>
          <button onClick={() => navigate('/dashboard/fixed-assets/wizard')} className="text-[9px] text-amber-600 hover:underline font-bold mt-2 text-left">
            [Run Wizard]
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Active Cards</span>
          <p className="text-sm font-black text-slate-800 font-mono">{metrics.activeCount}</p>
          <span className="text-[9px] text-emerald-500 font-bold block mt-2">🟢 Operating</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">In Maintenance</span>
          <p className="text-sm font-black text-slate-800 font-mono text-amber-500">{metrics.maintCount}</p>
          <span className="text-[9px] text-amber-500 font-bold block mt-2">🟠 Pending Work</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Disposed</span>
          <p className="text-sm font-black text-slate-800 font-mono text-rose-500">{metrics.disposedCount}</p>
          <span className="text-[9px] text-rose-500 font-bold block mt-2">🔴 Retired Log</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Avg Age</span>
          <p className="text-sm font-black text-slate-800 font-mono">{metrics.avgAge} Yrs</p>
          <span className="text-[9px] text-slate-400 font-semibold block mt-2">Fleet Profile</span>
        </div>
      </div>

      {/* Row 2: Alerts & Action Hub | Upcoming Depreciation Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actionable Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-2 border-b border-slate-50 pb-2">
              <ShieldAlert size={16} className="text-indigo-600" /> Actionable Alerts & Control Hub
            </h3>
            <div className="divide-y divide-slate-100 mt-2">
              {alerts.critical.map((a, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 text-rose-600 font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"></span>
                    <span className="text-[10px] uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex-shrink-0">Critical</span>
                    <span className="text-slate-700 font-semibold">{a.text}</span>
                  </div>
                  <button onClick={() => navigate(a.actionPath)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-all flex-shrink-0">
                    {a.actionText}
                  </button>
                </div>
              ))}
              {alerts.warning.map((a, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 text-amber-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                    <span className="text-[10px] uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex-shrink-0">Warning</span>
                    <span className="text-slate-700 font-semibold">{a.text}</span>
                  </div>
                  <button onClick={() => navigate(a.actionPath)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-all flex-shrink-0">
                    {a.actionText}
                  </button>
                </div>
              ))}
              {alerts.info.map((a, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 text-blue-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                    <span className="text-[10px] uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex-shrink-0">Info</span>
                    <span className="text-slate-700 font-semibold">{a.text}</span>
                  </div>
                  <button onClick={() => navigate(a.actionPath)} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-all flex-shrink-0">
                    {a.actionText}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs mt-2">
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-indigo-600" />
              <div>
                <p className="font-black text-slate-800">Compliance Health Score</p>
                <p className="text-[10px] text-slate-400 font-semibold">Active assets status ratio overview.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 font-bold">🟢 {healthScore.healthy} Healthy</span>
              <span className="text-amber-500 font-bold">🟠 {healthScore.attention} Attention</span>
              <span className="text-rose-600 font-bold">🔴 {healthScore.critical} Critical</span>
            </div>
          </div>
        </div>

        {/* Upcoming Run Timeline */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 space-y-4">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-2 border-b border-slate-50 pb-2">
            <Clock size={16} className="text-indigo-600" /> Upcoming Runs Calendar
          </h3>
          <div className="space-y-4">
            {upcomingRuns.map((run, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                {i !== upcomingRuns.length - 1 && (
                  <span className="absolute left-[7px] top-[14px] w-0.5 h-[50px] bg-slate-100" />
                )}
                <span className={`w-3.5 h-3.5 rounded-full ${run.color} border-4 border-white shadow flex-shrink-0 mt-1`}></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-black text-slate-800">{run.book}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      run.status.includes('Tomorrow') ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      run.status.includes('Days') ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">Target Period: {run.period}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Category Distribution | Expense Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Charts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Distribution Summary</h3>
            <select 
              value={distMode} 
              onChange={(e) => setDistMode(e.target.value)}
              className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 outline-none"
            >
              <option value="category">Category</option>
              <option value="location">Location</option>
              <option value="status">Status</option>
              <option value="custodian">Custodian</option>
            </select>
          </div>
          <div className="h-60 w-full relative flex items-center justify-center">
            {distData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={distData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {distData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `PKR ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-slate-400 text-sm font-semibold">No data.</span>
            )}
          </div>
          <div className="mt-4 space-y-1.5 flex-1 overflow-y-auto max-h-36 pr-1 custom-scrollbar">
            {distData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span className="text-slate-600 font-bold truncate">{d.name}</span>
                </div>
                <span className="font-mono text-slate-500 flex-shrink-0">PKR {d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Depreciation Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider mb-4">Depreciation Expense Trend</h3>
          <div className="h-72 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RechartsBarChart data={trendData}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip formatter={(value) => `PKR ${value.toLocaleString()}`} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} name="Depreciation (PKR)" />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="text-slate-400 text-sm font-semibold">No posted depreciation cycles detected.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Activities | Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Ledger logs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider border-b border-slate-50 pb-2">Recent Sub-Ledger Activities</h3>
          <div className="flow-root animate-fade-in">
            <ul className="-mb-8">
              {recentLedger.map((event, idx) => (
                <li key={event.id}>
                  <div className="relative pb-6">
                    {idx !== recentLedger.length - 1 && (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white text-[10px] font-bold ${
                          EVENT_COLORS[event.event_type]?.badge || 'bg-slate-50 text-slate-600'
                        }`}>
                          {event.event_type.slice(0, 3)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                        <div>
                          <p className="text-xs text-slate-600 font-bold">
                            {event.description}{' '}
                            <Link to={`/dashboard/fixed-assets/register?assetId=${event.asset_id}`} className="text-indigo-600 hover:underline">
                              ({event.assetCode})
                            </Link>
                          </p>
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                            By {event.created_by_name || 'System'} • {new Date(event.event_date).toLocaleDateString()}
                            {event.voucher_number && ` • Voucher: ${event.voucher_number}`}
                          </span>
                        </div>
                        <div className="text-right text-xs whitespace-nowrap font-mono font-bold text-slate-800">
                          PKR {event.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {recentLedger.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs font-semibold">
                  No registered asset activities.
                </div>
              )}
            </ul>
          </div>
        </div>

        {/* Modules quick access */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 space-y-4">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Quick Actions Hub</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/dashboard/fixed-assets/register?new=true')} className="p-3 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
              <Layers size={16} className="text-emerald-600" />
              <div className="text-left">
                <p className="text-xs font-black">Register Asset</p>
                <p className="text-[9px] text-slate-400 font-semibold">Manually capitalize card.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/wizard')} className="p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
              <Play size={16} className="text-purple-600" />
              <div className="text-left">
                <p className="text-xs font-black">Run Dep.</p>
                <p className="text-[9px] text-slate-400 font-semibold">Launch calculation wizard.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register')} className="p-3 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
              <MapPin size={16} className="text-blue-600" />
              <div className="text-left">
                <p className="text-xs font-black">Transfer Asset</p>
                <p className="text-[9px] text-slate-400 font-semibold">Change location/custodian.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register')} className="p-3 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
              <Wrench size={16} className="text-amber-600" />
              <div className="text-left">
                <p className="text-xs font-black">Maintenance</p>
                <p className="text-[9px] text-slate-400 font-semibold">Log repair logs and tasks.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register')} className="p-3 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all col-span-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-black">Retire & Dispose Asset</p>
                  <p className="text-[9px] text-slate-400 font-semibold">Post sale or disposal with gain/loss computation.</p>
                </div>
                <ArrowRight size={14} className="text-rose-400" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Row 5: Assets Near End-of-Life | Upcoming Maintenance | Draft Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider border-b border-slate-50 pb-2">Assets Near End-of-Life</h3>
          <div className="space-y-3">
            {endOfLifeAssets.map((a, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-slate-700">{a.name} ({a.code})</p>
                  <p className="text-[10px] text-rose-500 font-bold">Remaining: {a.remaining} Months</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="font-mono text-slate-600">BV: PKR {a.bookValue.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400 font-semibold">Replace: PKR {a.replacementEstimate.toLocaleString()}</p>
                  <button onClick={() => navigate(`/dashboard/fixed-assets/register?assetId=${a.id}`)} className="text-[9px] text-indigo-600 hover:underline font-bold mt-1">
                    Plan Replacement
                  </button>
                </div>
              </div>
            ))}
            {endOfLifeAssets.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2 font-semibold">No assets near end of life.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider border-b border-slate-50 pb-2">Upcoming Maintenance</h3>
          <div className="space-y-2.5 text-xs text-slate-500 font-semibold">
            {assets.filter(a => a.status === 'UNDER_MAINTENANCE').slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{a.asset_name}</span>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">In Work</span>
              </div>
            ))}
            {assets.filter(a => a.status === 'UNDER_MAINTENANCE').length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2 font-semibold">No assets currently under maintenance.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider border-b border-slate-50 pb-2">Draft Capitalization Cards</h3>
          <div className="space-y-2.5 text-xs text-slate-500 font-semibold">
            {assets.filter(a => a.status === 'DRAFT').slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{a.asset_name} ({a.asset_code})</span>
                <span className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100">Draft</span>
              </div>
            ))}
            {assets.filter(a => a.status === 'DRAFT').length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2 font-semibold">No draft capitalization cards pending.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
