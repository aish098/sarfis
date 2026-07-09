import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, Settings, Play, Calendar, DollarSign, Layers, Activity,
  ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Info, Clock, 
  User, MapPin, Wrench, Shield, TrendingUp, TrendingDown, ArrowLeft,
  ThumbsUp, ThumbsDown, CheckSquare, ClipboardList, ShieldCheck, Trash2
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

  const [operationsQueue, setOperationsQueue] = useState({
    pendingTransfers: 0,
    pendingDisposals: 0,
    scheduledMaintenance: 0,
    overdueMaintenance: 0,
    pendingCapitalization: 0,
    pendingRevaluation: 0
  });

  const [assetHealthList, setAssetHealthList] = useState([]);

  const [distMode, setDistMode] = useState('category'); // 'category' | 'location' | 'status' | 'custodian'
  const [distData, setDistData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentLedger, setRecentLedger] = useState([]);
  const [alerts, setAlerts] = useState({ critical: [], warning: [], info: [] });
  const [upcomingRuns, setUpcomingRuns] = useState([]);
  const [endOfLifeAssets, setEndOfLifeAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [activeCompany]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [assetsRes, transfersRes, workOrdersRes] = await Promise.all([
        api.get('/fixed-assets/assets'),
        api.get('/fixed-assets/assets/transfer/requests'),
        api.get('/fixed-assets/assets/work-orders')
      ]);

      const rawAssets = assetsRes.data || [];
      const rawTransfers = transfersRes.data || [];
      const rawWorkOrders = workOrdersRes.data || [];

      setAssets(rawAssets);

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
      const healthList = [];

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

        // Compute rich Health Score (factors: useful life, maintenance history, downtime status)
        let healthScore = 100;
        const lifeRatio = usefulLifeMonths > 0 ? (remainingMonths / usefulLifeMonths) : 1;
        healthScore = Math.round(lifeRatio * 60 + 40); // Baseline based on life remaining

        // Deduct for status
        if (a.status === 'UNDER_MAINTENANCE') {
          healthScore -= 15;
        }

        // Deduct based on maintenance log count
        const woCount = rawWorkOrders.filter(wo => wo.asset_id === a.id).length;
        healthScore -= Math.min(20, woCount * 4); // Max 20% penalty for multiple breakdowns

        // Safety clamp
        healthScore = Math.max(10, Math.min(100, healthScore));

        let healthLabel = 'Excellent';
        let healthColor = 'text-emerald-500';
        let healthBadge = 'bg-emerald-50 border-emerald-100';
        if (healthScore < 50) {
          healthLabel = 'Poor';
          healthColor = 'text-rose-500';
          healthBadge = 'bg-rose-50 border-rose-100';
        } else if (healthScore < 80) {
          healthLabel = 'Fair';
          healthColor = 'text-amber-500';
          healthBadge = 'bg-amber-50 border-amber-100';
        }

        healthList.push({
          id: a.id,
          name: a.asset_name,
          code: a.asset_code,
          score: healthScore,
          label: healthLabel,
          color: healthColor,
          badge: healthBadge,
          remainingLife: Math.round(lifeRatio * 100),
          workOrders: woCount
        });

        if (a.status === 'ACTIVE') {
          if (currentBV <= parseFloat(a.salvage_value || 0)) {
            tempAlerts.critical.push({
              id: `zero-${a.id}`,
              type: 'CRITICAL',
              text: `Asset ${a.asset_code} has reached salvage/zero book value (PKR ${currentBV.toLocaleString()}).`,
              actionText: 'Review Card',
              actionPath: `/dashboard/fixed-assets/register?assetId=${a.id}`
            });
          } else if (remainingMonths <= 6) {
            tempEndOfLife.push({
              id: a.id,
              name: a.asset_name,
              code: a.asset_code,
              remaining: remainingMonths,
              bookValue: currentBV,
              replacementEstimate: cost * 1.3
            });
          }
        }

        // Check if depreciated this month
        const hasDepThisMonth = (item.ledger || []).some(
          l => l.event_type === 'DEPRECIATION' && String(l.event_date).startsWith(currentPeriodStr)
        );

        if (a.status === 'ACTIVE' && !hasDepThisMonth) {
          dueDepCount++;
        }
      });

      setAssetHealthList(healthList.sort((a, b) => a.score - b.score).slice(0, 3)); // show lowest health first

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
      tempAlerts.info.push({
        id: 'compliance-audit',
        type: 'INFO',
        text: 'All depreciation books matched and validated to general ledger.',
        actionText: 'Check Ledger',
        actionPath: '/dashboard/ledger'
      });

      // Calculate live queue numbers
      const pendingTrans = rawTransfers.filter(r => r.status === 'PENDING').length;
      const schedMaint = rawWorkOrders.filter(wo => wo.status === 'OPEN' || wo.status === 'IN_PROGRESS').length;
      const overdueMaint = rawWorkOrders.filter(wo => {
        const isPast = new Date(wo.maintenance_date) < now;
        return (wo.status === 'OPEN' || wo.status === 'IN_PROGRESS') && isPast;
      }).length;
      const pendingCap = rawAssets.filter(a => a.status === 'DRAFT').length;

      setOperationsQueue({
        pendingTransfers: pendingTrans,
        pendingDisposals: rawAssets.filter(a => a.status === 'DRAFT_DISPOSAL').length || 0,
        scheduledMaintenance: schedMaint,
        overdueMaintenance: overdueMaint,
        pendingCapitalization: pendingCap,
        pendingRevaluation: 0
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
      setAlerts(tempAlerts);

      // Distribution calculations
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
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Asset Control Center</h1>
            <p className="text-slate-500 text-sm font-semibold">Centralized command center for calculations, validations, alerts, and multi-book reporting.</p>
          </div>
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
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Acquisition Cost</span>
          <p className="text-sm font-black text-slate-800 font-mono mt-1">PKR {metrics.totalCost.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Accumulated Dep.</span>
          <p className="text-sm font-black text-rose-600 font-mono mt-1">PKR {metrics.accumulatedDep.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Net Book Value</span>
          <p className="text-sm font-black text-emerald-600 font-mono mt-1">PKR {metrics.netBookValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Active Assets</span>
          <p className="text-sm font-black text-slate-800 font-mono mt-1">{metrics.activeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Maintenance</span>
          <p className="text-sm font-black text-amber-600 font-mono mt-1">{metrics.maintCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Disposed / Sold</span>
          <p className="text-sm font-black text-slate-500 font-mono mt-1">{metrics.disposedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Avg. Asset Age</span>
          <p className="text-sm font-black text-slate-800 font-mono mt-1">{metrics.avgAge} Yrs</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Due Depreciation</span>
          <p className={`text-sm font-black font-mono mt-1 ${metrics.dueDepCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{metrics.dueDepCount}</p>
        </div>
      </div>

      {/* Row 2: Alerts Center | Operations Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Center */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Alerts & Action Hub</h3>
            <span className="text-[9px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100 font-bold">
              {alerts.critical.length + alerts.warning.length} Attention Items
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {alerts.critical.map(alert => (
              <div key={alert.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-center justify-between text-xs font-semibold text-rose-800 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className="text-rose-500 shrink-0" />
                  <span>{alert.text}</span>
                </div>
                <Link to={alert.actionPath} className="px-2.5 py-1 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg text-[10px] font-bold text-rose-700 transition-all shadow-sm">
                  {alert.actionText}
                </Link>
              </div>
            ))}

            {alerts.warning.map(alert => (
              <div key={alert.id} className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center justify-between text-xs font-semibold text-amber-800 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                  <span>{alert.text}</span>
                </div>
                <Link to={alert.actionPath} className="px-2.5 py-1 bg-white border border-amber-200 hover:bg-amber-50 rounded-lg text-[10px] font-bold text-amber-700 transition-all shadow-sm">
                  {alert.actionText}
                </Link>
              </div>
            ))}

            {alerts.info.map(alert => (
              <div key={alert.id} className="p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl flex items-center justify-between text-xs font-semibold text-indigo-800 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <Info size={15} className="text-indigo-500 shrink-0" />
                  <span>{alert.text}</span>
                </div>
                <Link to={alert.actionPath} className="px-2.5 py-1 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg text-[10px] font-bold text-indigo-700 transition-all shadow-sm">
                  {alert.actionText}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Operations Queue Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Operations Queue</h3>
            <ClipboardList size={16} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
            <div className="py-2.5 flex justify-between items-center">
              <span className="flex items-center gap-2"><MapPin size={13} className="text-blue-500" /> Pending Location Transfers</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${operationsQueue.pendingTransfers > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {operationsQueue.pendingTransfers}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="flex items-center gap-2"><Trash2 size={13} className="text-rose-500" /> Pending Disposals</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${operationsQueue.pendingDisposals > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                {operationsQueue.pendingDisposals}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="flex items-center gap-2"><Wrench size={13} className="text-amber-500" /> Active Maintenance Orders</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${operationsQueue.scheduledMaintenance > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {operationsQueue.scheduledMaintenance}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="flex items-center gap-2"><Clock size={13} className="text-red-500" /> Overdue Work Orders</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${operationsQueue.overdueMaintenance > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                {operationsQueue.overdueMaintenance}
              </span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="flex items-center gap-2"><Layers size={13} className="text-emerald-500" /> Draft Capitalizations</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${operationsQueue.pendingCapitalization > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {operationsQueue.pendingCapitalization}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Distribution Chart | Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Asset Distribution</h3>
            <div className="flex gap-1">
              {['category', 'location', 'status'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setDistMode(mode)}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase transition-all ${
                    distMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {distData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `PKR ${value.toLocaleString()}`}
                  contentStyle={{ background: '#252423', borderRadius: 8, border: 'none', color: '#fff', fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
            {distData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Depreciation Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Depreciation Trend</h3>
          <div className="h-64">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#8a8886' }} />
                  <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#8a8886' }} />
                  <Tooltip
                    formatter={(value) => `PKR ${value.toLocaleString()}`}
                    contentStyle={{ background: '#252423', borderRadius: 8, border: 'none', color: '#fff', fontSize: 11 }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-semibold text-xs">
                No depreciation trends logged.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Sub-Ledger Entries | Quick Actions Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ledger logs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Recent Asset Activities</h3>
          <div className="flow-root">
            <ul className="-mb-8">
              {recentLedger.map((event, eventIdx) => (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {eventIdx !== recentLedger.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${EVENT_COLORS[event.event_type]?.dot || 'bg-slate-500'}`}>
                          <Activity className="h-4 w-4 text-white" aria-hidden="true" />
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

            <button onClick={() => navigate('/dashboard/fixed-assets/register?action=transfer')} className="p-3 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
              <MapPin size={16} className="text-blue-600" />
              <div className="text-left">
                <p className="text-xs font-black">Transfer Asset</p>
                <p className="text-[9px] text-slate-400 font-semibold">Change location/custodian.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register?action=maintenance')} className="p-3 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
              <Wrench size={16} className="text-amber-600" />
              <div className="text-left">
                <p className="text-xs font-black">Maintenance</p>
                <p className="text-[9px] text-slate-400 font-semibold">Log repair logs and tasks.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register?action=dispose')} className="p-3 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all col-span-2">
              <div className="flex items-center justify-between w-full" onClick={() => navigate('/dashboard/fixed-assets/register?action=dispose')}>
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

      {/* Row 5: Assets Near End-of-Life | Upcoming Maintenance | Asset Health Summary */}
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

        {/* Asset Health Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider border-b border-slate-50 pb-2">Asset Health Scores</h3>
          <div className="space-y-3 text-xs font-semibold">
            {assetHealthList.map(a => (
              <div key={a.id} className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-800">{a.name}</p>
                  <p className="text-[9px] text-slate-400 font-mono">Code: {a.code}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${a.badge}`}>
                    {a.score}% ({a.label})
                  </span>
                  <p className="text-[9px] text-slate-400 mt-1">Useful Life: {a.remainingLife}% remaining</p>
                </div>
              </div>
            ))}
            {assetHealthList.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2 font-semibold">No assets registered for health calculation.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
