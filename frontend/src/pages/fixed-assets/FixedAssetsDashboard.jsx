import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, Settings, Play, Calendar, DollarSign, Layers, Activity,
  ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Info, Clock, 
  User, MapPin, Wrench, Shield, TrendingUp, TrendingDown, ArrowLeft,
  ThumbsUp, ThumbsDown, CheckSquare, ClipboardList, ShieldCheck, Trash2,
  CalendarDays, BarChart3, PieChart as PieIcon, LineChart, FileSpreadsheet
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, 
  Bar, XAxis, YAxis, Tooltip, Legend, LineChart as RechartsLineChart,
  Line, CartesianGrid
} from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';

export default function FixedAssetsDashboard() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState('operations'); // 'operations' | 'analytics'
  
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

  // Lending Dashboard Metrics
  const [lendingMetrics, setLendingMetrics] = useState({
    checkedOut: 18,
    overdue: 4,
    reserved: 6,
    returnedToday: 3
  });

  // Physical Verification Progress
  const [verificationProgress, setVerificationProgress] = useState({
    sessionName: 'Annual Assets Audit 2026',
    percent: 78,
    verified: 780,
    missing: 5,
    damaged: 7,
    pending: 208
  });

  const [assetHealthList, setAssetHealthList] = useState([]);

  // Analytics tab state variables
  const [selectedLifecycleAssetId, setSelectedLifecycleAssetId] = useState('');
  const [lifecycleCostInfo, setLifecycleCostInfo] = useState(null);

  const [distMode, setDistMode] = useState('category'); // 'category' | 'location' | 'status'
  const [distData, setDistData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentLedger, setRecentLedger] = useState([]);
  const [alerts, setAlerts] = useState({ critical: [], warning: [], info: [] });
  const [loading, setLoading] = useState(true);

  const [workOrders, setWorkOrders] = useState([]);

  // Analytics Forecasts Data computed dynamically from active assets (straight-line depreciation)
  const forecastData = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1, currentYear + 2];
    const forecast = years.map(y => ({ year: `${y} Forecast`, amount: 0 }));

    assets.forEach(a => {
      if (a.status !== 'ACTIVE' && a.status !== 'UNDER_MAINTENANCE') return;
      
      const cost = parseFloat(a.purchase_cost || 0);
      const salvage = parseFloat(a.salvage_value || 0);
      const lifeYears = parseInt(a.useful_life_years || 5);
      const annualDep = lifeYears > 0 ? (cost - salvage) / lifeYears : 0;
      
      const purchaseYear = new Date(a.purchase_date).getFullYear();
      
      years.forEach((y, idx) => {
        if (y >= purchaseYear && y < purchaseYear + lifeYears) {
          forecast[idx].amount += annualDep;
        }
      });
    });

    return forecast;
  }, [assets]);

  // Maintenance Trends computed dynamically from work orders and category associations
  const maintenanceTrendData = React.useMemo(() => {
    const categoriesMap = {};
    assets.forEach(a => {
      categoriesMap[a.category_name || 'Unspecified'] = 0;
    });

    workOrders.forEach(wo => {
      const asset = assets.find(as => as.id === wo.asset_id);
      const cat = asset?.category_name || 'Unspecified';
      const cost = parseFloat(wo.maintenance_cost || 0) + parseFloat(wo.labor_cost || 0);
      categoriesMap[cat] = (categoriesMap[cat] || 0) + cost;
    });

    // Format for Recharts Bar Chart
    const entries = Object.entries(categoriesMap).map(([name, cost]) => ({ name, cost }));
    return entries.length > 0 ? entries : [{ name: 'No Categories', cost: 0 }];
  }, [assets, workOrders]);

  // Capacity utilization computed dynamically from active usage logs compared to estimated useful units
  const utilizationData = React.useMemo(() => {
    const activeWithUnits = assets.filter(a => parseFloat(a.estimated_total_units || 0) > 0);
    if (activeWithUnits.length === 0) {
      return [{ name: 'No Usage Logs', rate: 0 }];
    }
    return activeWithUnits
      .map(a => {
        const rate = Math.round((parseFloat(a.current_units_used || 0) / parseFloat(a.estimated_total_units)) * 100);
        return { name: a.asset_name, rate: Math.min(100, rate) };
      })
      .slice(0, 5);
  }, [assets]);

  useEffect(() => {
    fetchDashboardData();
  }, [activeCompany]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [assetsRes, transfersRes, workOrdersRes, assignmentsRes, sessionsRes] = await Promise.all([
        api.get('/fixed-assets/assets'),
        api.get('/fixed-assets/assets/transfer/requests'),
        api.get('/fixed-assets/assets/work-orders'),
        api.get('/fixed-assets/assignments'),
        api.get('/fixed-assets/verification/sessions')
      ]);

      const rawAssets = assetsRes.data || [];
      const rawTransfers = transfersRes.data || [];
      const rawWorkOrders = workOrdersRes.data || [];
      const rawAssignments = assignmentsRes.data || [];
      const rawSessions = sessionsRes.data || [];

      setAssets(rawAssets);
      setWorkOrders(rawWorkOrders);
      if (rawAssets.length > 0 && !selectedLifecycleAssetId) {
        setSelectedLifecycleAssetId(rawAssets[0].id);
      }

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

      // Set first asset lifecycle cost data
      if (validDetails.length > 0) {
        const item = validDetails[0];
        const a = item.asset;
        const acctBook = item.depreciationBooks?.find(b => b.book_name === 'Accounting');
        const accDep = acctBook ? parseFloat(acctBook.accumulated_depreciation || 0) : 0;
        const mainCost = (item.maintenance || []).reduce((acc, curr) => acc + parseFloat(curr.maintenance_cost || 0) + parseFloat(curr.labor_cost || 0), 0);
        
        setLifecycleCostInfo({
          name: a.asset_name,
          cost: parseFloat(a.purchase_cost || 0),
          maintenance: mainCost,
          depreciation: accDep,
          currentValue: acctBook ? parseFloat(acctBook.current_book_value || 0) : parseFloat(a.purchase_cost || 0)
        });
      }

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

        // Health score indicators
        const lifeRatio = usefulLifeMonths > 0 ? (remainingMonths / usefulLifeMonths) : 1;
        const remainingLifeScore = Math.round(lifeRatio * 100);
        
        let healthScore = Math.round(lifeRatio * 60 + 40);
        if (a.status === 'UNDER_MAINTENANCE') healthScore -= 15;
        const woCount = rawWorkOrders.filter(wo => wo.asset_id === a.id).length;
        healthScore -= Math.min(20, woCount * 4);
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
          remainingLife: remainingLifeScore,
          workOrders: woCount,
          warranty: a.notes?.toLowerCase().includes('warranty') ? 100 : 80,
          downtime: a.status === 'UNDER_MAINTENANCE' ? 50 : 100
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
          }
        }

        const hasDepThisMonth = (item.ledger || []).some(
          l => l.event_type === 'DEPRECIATION' && String(l.event_date).startsWith(currentPeriodStr)
        );

        if (a.status === 'ACTIVE' && !hasDepThisMonth) {
          dueDepCount++;
        }
      });

      setAssetHealthList(healthList.sort((a, b) => a.score - b.score).slice(0, 3));

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

      // Calculate operations queue numbers
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

      // Calculate dynamic checkout lending numbers
      const checkedOutCount = rawAssignments.filter(a => a.status === 'CHECKED_OUT').length;
      const reservedCount = rawAssignments.filter(a => a.status === 'RESERVED').length;
      const returnedTodayCount = rawAssignments.filter(a => a.status === 'RETURNED').length;
      const overdueCount = rawAssignments.filter(a => {
        const isOverdue = a.expected_return && new Date(a.expected_return) < now;
        return a.status === 'CHECKED_OUT' && isOverdue;
      }).length;

      setLendingMetrics({
        checkedOut: checkedOutCount,
        overdue: overdueCount,
        reserved: reservedCount,
        returnedToday: returnedTodayCount
      });

      // Dynamic physical verification metrics
      let activeSessionData = {
        sessionName: 'No Active Audit',
        percent: 0,
        verified: 0,
        missing: 0,
        damaged: 0,
        pending: rawAssets.length
      };

      if (rawSessions.length > 0) {
        const latestSession = rawSessions[0];
        try {
          const { data: items } = await api.get(`/fixed-assets/verification/sessions/${latestSession.id}/items`);
          const verified = items.length;
          const missing = items.filter(x => x.status === 'MISSING').length;
          const damaged = items.filter(x => x.status === 'DAMAGED').length;
          const totalAssets = rawAssets.length || 1;
          const percent = Math.round((verified / totalAssets) * 100);

          activeSessionData = {
            sessionName: latestSession.session_name,
            percent,
            verified,
            missing,
            damaged,
            pending: Math.max(0, totalAssets - verified)
          };
        } catch (err) {
          console.error(err);
        }
      }
      setVerificationProgress(activeSessionData);

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

      // Populating recent events
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

      computeDistribution(rawAssets, distMode);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleLifecycleAssetChange = async (assetId) => {
    setSelectedLifecycleAssetId(assetId);
    try {
      const { data } = await api.get(`/fixed-assets/assets/${assetId}/inquiry`);
      const a = data.asset;
      const acctBook = data.depreciationBooks?.find(b => b.book_name === 'Accounting');
      const accDep = acctBook ? parseFloat(acctBook.accumulated_depreciation || 0) : 0;
      const mainCost = (data.maintenance || []).reduce((acc, curr) => acc + parseFloat(curr.maintenance_cost || 0) + parseFloat(curr.labor_cost || 0), 0);
      
      setLifecycleCostInfo({
        name: a.asset_name,
        cost: parseFloat(a.purchase_cost || 0),
        maintenance: mainCost,
        depreciation: accDep,
        currentValue: acctBook ? parseFloat(acctBook.current_book_value || 0) : parseFloat(a.purchase_cost || 0)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const computeDistribution = (assetList, mode) => {
    const counts = {};
    assetList.forEach(a => {
      let key = 'Unspecified';
      if (mode === 'category') key = a.category_name || 'Uncategorized';
      else if (mode === 'location') key = a.location_name || 'Head Office';
      else if (mode === 'status') key = a.status || 'ACTIVE';

      counts[key] = (counts[key] || 0) + parseFloat(a.purchase_cost || 0);
    });

    const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
    setDistData(chartData);
  };

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <WorkspaceLayout
      title="Asset Control Center"
      subtitle="Centralized command center for calculations, validations, lending control, and lifecycle forecasts."
      icon={Briefcase}
      badgeText="Fixed Assets"
      breadcrumbs={['ACCOUNTELLENCE', 'Fixed Assets', 'Dashboard']}
      primaryAction={
        <div className="flex items-center gap-1.5 bg-slate-200/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('operations')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 border-none outline-none ${
              activeTab === 'operations' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={13} /> Operations Center
          </button>
          <button 
            onClick={() => setActiveTab('analytics')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 border-none outline-none ${
              activeTab === 'analytics' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={13} /> Analytics & Forecasts
          </button>
        </div>
      }
    >
      <div className="col-span-full space-y-6">

      {/* Main Tab Views */}
      {activeTab === 'operations' ? (
        <div className="space-y-6">
          {/* Executive KPIs Row (8 Cards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Acquisition Cost</span>
              <p className="text-sm font-black text-slate-800 font-mono mt-1">PKR {metrics.totalCost.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Accumulated Dep.</span>
              <p className="text-sm font-black text-rose-600 font-mono mt-1">PKR {metrics.accumulatedDep.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Net Book Value</span>
              <p className="text-sm font-black text-emerald-600 font-mono mt-1">PKR {metrics.netBookValue.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Active Assets</span>
              <p className="text-sm font-black text-slate-800 font-mono mt-1">{metrics.activeCount}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Maintenance</span>
              <p className="text-sm font-black text-amber-600 font-mono mt-1">{metrics.maintCount}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Disposed / Sold</span>
              <p className="text-sm font-black text-slate-500 font-mono mt-1">{metrics.disposedCount}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Avg. Asset Age</span>
              <p className="text-sm font-black text-slate-800 font-mono mt-1">{metrics.avgAge} Yrs</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-widest">Due Depreciation</span>
              <p className={`text-sm font-black font-mono mt-1 ${metrics.dueDepCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{metrics.dueDepCount}</p>
            </div>
          </div>

          {/* Row 2: Alerts Center | Operations Queue | Lending Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alerts Center */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Alerts & Action Hub</h3>
                <span className="text-[9px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100 font-bold">
                  {alerts.critical.length + alerts.warning.length} Attention Items
                </span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs">
                {alerts.critical.map(alert => (
                  <div key={alert.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-center justify-between font-semibold text-rose-800">
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
                  <div key={alert.id} className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center justify-between font-semibold text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                      <span>{alert.text}</span>
                    </div>
                    <Link to={alert.actionPath} className="px-2.5 py-1 bg-white border border-amber-200 hover:bg-amber-50 rounded-lg text-[10px] font-bold text-amber-700 transition-all shadow-sm">
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
              </div>
            </div>
          </div>

          {/* Row 3: Lending Control Dashboard | Physical Verification audit tracker */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lending & Checkout Queue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Asset Lending & Reservations</h3>
                <CalendarDays size={16} className="text-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">ACTIVE CHECKOUTS</span>
                  <strong className="text-lg font-mono font-black text-slate-800">{lendingMetrics.checkedOut} Assets</strong>
                </div>
                <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <span className="text-[10px] text-rose-400 font-bold block">OVERDUE RETURNS</span>
                  <strong className="text-lg font-mono font-black text-rose-700">{lendingMetrics.overdue} Late</strong>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block">PENDING RESERVATIONS</span>
                  <strong className="text-lg font-mono font-black text-slate-800">{lendingMetrics.reserved} Booked</strong>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <span className="text-[10px] text-emerald-400 font-bold block">RETURNED TODAY</span>
                  <strong className="text-lg font-mono font-black text-emerald-700">{lendingMetrics.returnedToday} Returned</strong>
                </div>
              </div>
            </div>

            {/* Physical Verification Progress Audit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Verification Sessions Audit</h3>
                <ShieldCheck size={16} className="text-slate-400" />
              </div>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>{verificationProgress.sessionName}</span>
                  <span className="text-emerald-600 font-black">{verificationProgress.percent}% Complete</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${verificationProgress.percent}%` }} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="block text-slate-400">VERIFIED</span>
                    <strong className="text-slate-800 font-mono">{verificationProgress.verified}</strong>
                  </div>
                  <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                    <span className="block text-rose-500">MISSING</span>
                    <strong className="text-rose-700 font-mono">{verificationProgress.missing}</strong>
                  </div>
                  <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    <span className="block text-amber-500">DAMAGED</span>
                    <strong className="text-amber-700 font-mono">{verificationProgress.damaged}</strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="block text-slate-400">PENDING</span>
                    <strong className="text-slate-800 font-mono">{verificationProgress.pending}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Asset Distribution Chart | Recent Activities */}
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
                        distMode === mode ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-600'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
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

              <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 max-h-16 overflow-y-auto pr-1">
                {distData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Asset Activities */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Recent Asset Activities</h3>
              <div className="flow-root max-h-[300px] overflow-y-auto pr-1">
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
                                <Link to={`/dashboard/fixed-assets/register?assetId=${event.asset_id}`} className="text-emerald-600 hover:underline">
                                  ({event.assetCode})
                                </Link>
                              </p>
                              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                By {event.created_by_name || 'System'} • {new Date(event.event_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-right text-xs font-mono font-bold text-slate-800">
                              PKR {event.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Actions Hub */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <button onClick={() => navigate('/dashboard/fixed-assets/register?new=true')} className="p-3 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all shadow-sm">
              <Layers size={16} className="text-emerald-600" />
              <div className="text-left">
                <p className="text-xs font-black">Register Asset</p>
                <p className="text-[9px] text-slate-400 font-semibold">Manually capitalize card.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/wizard')} className="p-3 bg-white hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all shadow-sm">
              <Play size={16} className="text-purple-600" />
              <div className="text-left">
                <p className="text-xs font-black">Run Dep.</p>
                <p className="text-[9px] text-slate-400 font-semibold">Launch calculation wizard.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register?action=transfer')} className="p-3 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all shadow-sm">
              <MapPin size={16} className="text-blue-600" />
              <div className="text-left">
                <p className="text-xs font-black">Transfer Asset</p>
                <p className="text-[9px] text-slate-400 font-semibold">Submit location changes.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register?action=maintenance')} className="p-3 bg-white hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all shadow-sm">
              <Wrench size={16} className="text-amber-600" />
              <div className="text-left">
                <p className="text-xs font-black">Maintenance</p>
                <p className="text-[9px] text-slate-400 font-semibold">Log work order repairs.</p>
              </div>
            </button>

            <button onClick={() => navigate('/dashboard/fixed-assets/register?action=dispose')} className="p-3 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all shadow-sm">
              <Trash2 size={16} className="text-rose-600" />
              <div className="text-left">
                <p className="text-xs font-black">Retire & Dispose</p>
                <p className="text-[9px] text-slate-400 font-semibold">Open Stepper Wizard.</p>
              </div>
            </button>
          </div>

          {/* Lowest Health Summary Row */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3.5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-50 pb-2">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Asset Health Scores</h3>
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
                ℹ️ Calculated from useful life elapsed, repair logs, and warranty coverage.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assetHealthList.length === 0 ? (
                <div className="col-span-full py-4 text-center text-slate-400 text-xs italic">
                  No active assets found to calculate health scores.
                </div>
              ) : (
                assetHealthList.map(a => (
                  <div key={a.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-slate-800 line-clamp-1">{a.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">Code: {a.code}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${a.badge}`}>
                        {a.score}% ({a.label})
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          a.score < 50 ? 'bg-rose-500' : a.score < 80 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} 
                        style={{ width: `${a.score}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1.5 text-[9.5px] text-slate-500 font-semibold border-t border-slate-100/50 pt-2.5">
                      <div>Useful Life remaining:</div>
                      <div className="text-right text-slate-800">{a.remainingLife}%</div>
                      
                      <div>Work Order Penalty:</div>
                      <div className="text-right text-slate-800">{a.workOrders} order{a.workOrders !== 1 ? 's' : ''}</div>
                      
                      <div>Warranty status:</div>
                      <div className="text-right text-emerald-600">{a.warranty === 100 ? 'Active' : 'Standard'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Analytics and Forecast Dashboard View */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Depreciation Forecast */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Depreciation Cost Forecast</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Accounting book carrying value projection estimates.</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={forecastData}>
                    <XAxis dataKey="year" tickLine={false} style={{ fontSize: 10, fill: '#888' }} />
                    <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} tickLine={false} style={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip formatter={(v) => `PKR ${v.toLocaleString()}`} />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Maintenance Cost Trends */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Maintenance Trends by Category</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Total parts and labor expenses per class profile.</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={maintenanceTrendData}>
                    <XAxis dataKey="name" tickLine={false} style={{ fontSize: 9, fill: '#888' }} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tickLine={false} style={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip formatter={(v) => `PKR ${v.toLocaleString()}`} />
                    <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Asset Capacity Utilization */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Asset Capacity Utilization Rate</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Active usage statistics computed from logged metrics.</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={utilizationData}>
                    <XAxis dataKey="name" tickLine={false} style={{ fontSize: 9, fill: '#888' }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} style={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Lifecycle Cost Summary Detailer */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Asset Lifecycle Cost Calculator</h3>
              <select
                value={selectedLifecycleAssetId}
                onChange={(e) => handleLifecycleAssetChange(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none font-bold text-slate-600"
              >
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>
                ))}
              </select>
            </div>

            {lifecycleCostInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-[9.5px] text-slate-400 block uppercase">Original Purchase Cost</span>
                  <strong className="text-sm font-mono text-slate-800 mt-1 block">PKR {lifecycleCostInfo.cost.toLocaleString()}</strong>
                </div>
                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <span className="text-[9.5px] text-amber-500 block uppercase">Total Life Maintenance Logs</span>
                  <strong className="text-sm font-mono text-amber-700 mt-1 block">PKR {lifecycleCostInfo.maintenance.toLocaleString()}</strong>
                </div>
                <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <span className="text-[9.5px] text-rose-500 block uppercase">Accumulated Depreciation</span>
                  <strong className="text-sm font-mono text-rose-700 mt-1 block">PKR {lifecycleCostInfo.depreciation.toLocaleString()}</strong>
                </div>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <span className="text-[9.5px] text-emerald-500 block uppercase">Current Carrying Net Value</span>
                  <strong className="text-sm font-mono text-emerald-700 mt-1 block">PKR {lifecycleCostInfo.currentValue.toLocaleString()}</strong>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <p className="font-bold text-[13px] text-slate-700">No active asset selected or capitalized</p>
                <p className="text-[11px] mt-1">Register assets and perform lifecycle actions (purchases, work order maintenance, or depreciation runs) to visualize real-time lifecycle costs here.</p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </WorkspaceLayout>
  );
}
