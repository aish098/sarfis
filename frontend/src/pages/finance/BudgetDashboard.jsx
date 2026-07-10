import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, Sliders, ArrowLeft, RefreshCw, Calendar, 
  TrendingUp, AlertTriangle, CheckCircle, ShieldAlert,
  DollarSign, ArrowUpRight, Upload, X, HelpCircle, Edit3,
  ChevronDown, ArrowDownUp, Check, Download
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function BudgetDashboard() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [scenarioType, setScenarioType] = useState('EXPECTED');
  const [versionName, setVersionName] = useState('Original');
  
  // Dashboard metrics
  const [data, setData] = useState({
    headerId: null,
    totalBudget: 0,
    actual: 0,
    committed: 0,
    available: 0,
    utilization: 0,
    warnings: 0,
    blocked: 0,
    forecastYearEnd: 0,
    variance: 0,
    status: 'NO_ACTIVE_BUDGET',
    riskLevel: 'LOW',
    departmentsOverBudget: 0,
    departments: [],
    months: [],
    topOverspending: [],
    trends: []
  });

  // Sorting for Department Heat Map
  const [heatMapSort, setHeatMapSort] = useState('utilization_desc'); // utilization_desc, remaining_desc

  // Interactive Month Detail Modal
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [loadingMonthTx, setLoadingMonthTx] = useState(false);

  // Forecast Adjustment/Override state
  const [overrideLine, setOverrideLine] = useState(null); // Line object
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // Excel 4-step Import Wizard state
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1: Upload, 2: Validate, 3: Preview, 4: Complete
  const [importRowsJson, setImportRowsJson] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [importPreview, setImportPreview] = useState([]);
  const [validCount, setValidCount] = useState(0);
  const [committingImport, setCommittingImport] = useState(false);

  useEffect(() => {
    if (activeCompany) {
      loadDashboard();
    }
  }, [activeCompany, fiscalYear, scenarioType, versionName]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/budgets/dashboard', {
        params: { fiscalYear, scenarioType, versionName }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Fetch transactions for selected calendar month
  const handleMonthClick = async (monthItem) => {
    setSelectedMonth(monthItem);
    setLoadingMonthTx(true);
    try {
      if (data.headerId) {
        const yearStr = fiscalYear || '2026';
        const startDate = `${yearStr}-${String(monthItem.month).padStart(2, '0')}-01`;
        const endDate = `${yearStr}-${String(monthItem.month).padStart(2, '0')}-31`;
        
        const res = await api.get('/vouchers', {
          params: { startDate, endDate }
        });
        setMonthTransactions(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingMonthTx(false);
  };

  // Submit manual forecast override
  const handleSaveOverride = async () => {
    if (!overrideAmount || isNaN(overrideAmount) || parseFloat(overrideAmount) < 0) {
      alert('Please enter a valid non-negative override amount.');
      return;
    }
    if (!overrideReason.trim()) {
      alert('Please provide a business justification reason.');
      return;
    }

    setSavingOverride(true);
    try {
      await api.post(`/budgets/lines/${overrideLine.id}/forecast-override`, {
        amount: parseFloat(overrideAmount),
        reason: overrideReason
      });
      setOverrideLine(null);
      setOverrideAmount('');
      setOverrideReason('');
      loadDashboard();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setSavingOverride(false);
  };

  // Trigger spreadsheet validation
  const handleValidateImport = async () => {
    try {
      let parsedRows = [];
      try {
        parsedRows = JSON.parse(importRowsJson);
      } catch (e) {
        alert('Invalid JSON formatting. Please paste valid array syntax e.g., [{"accountCode": "1000", "allocatedAmount": 50000}]');
        return;
      }

      setLoading(true);
      const res = await api.post(`/budgets/${data.headerId}/validate-import`, { rows: parsedRows });
      setImportErrors(res.data.errors || []);
      setImportPreview(res.data.preview || []);
      setValidCount(res.data.validCount || 0);

      if (res.data.success) {
        setWizardStep(3); // Proceed to preview
      } else {
        setWizardStep(2); // Show errors
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  // Commit validation rows
  const handleCommitImport = async () => {
    setCommittingImport(true);
    try {
      await api.post(`/budgets/${data.headerId}/commit-import`, { rows: importPreview });
      setWizardStep(4);
      loadDashboard();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setCommittingImport(false);
  };

  const fmt = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
  };

  // Prepare sorted departments
  const sortedDepartments = [...(data.departments || [])].sort((a, b) => {
    if (heatMapSort === 'utilization_desc') {
      return b.utilization - a.utilization;
    } else {
      return b.remaining - a.remaining;
    }
  });

  // Calculate cumulative stats for line charting
  let cumulativeBudget = 0;
  let cumulativeActual = 0;
  let cumulativeForecast = 0;
  const maxCumulative = Math.max(
    (data.months || []).reduce((sum, m) => sum + m.budget, 0) || 1,
    (data.months || []).reduce((sum, m) => sum + m.actual, 0) || 1,
    (data.months || []).reduce((sum, m) => sum + (m.actual + m.remaining), 0) || 1
  );

  const chartPoints = (data.months || []).map((m, idx) => {
    cumulativeBudget += m.budget;
    cumulativeActual += m.actual;
    cumulativeForecast += m.actual + (m.remaining || 0);
    
    const x = 30 + (idx * (410 / 11));
    const yBudget = 190 - (cumulativeBudget / maxCumulative) * 160;
    const yActual = 190 - (cumulativeActual / maxCumulative) * 160;
    const yForecast = 190 - (cumulativeForecast / maxCumulative) * 160;

    return { x, yBudget, yActual, yForecast, monthLabel: m.month };
  });

  // Trends Max value calculation
  const trendsMaxValue = Math.max(...(data.trends || []).map(t => t.budget), 1);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EEF2FF] border border-[#E0E7FF] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-indigo-800 hover:bg-indigo-100/50 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
            <TrendingUp size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-indigo-950 tracking-tight uppercase">Budget & FP&A Dashboard</h1>
              <span className="text-[10px] font-extrabold uppercase bg-indigo-500/15 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-500/20">Enterprise</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5">
              Review multi-scenario allocations, forecast overrides, trend line analysis, and weekly calendar health indices.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year Input */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
            <span className="text-[10px] uppercase text-slate-400">Year:</span>
            <input 
              type="text" 
              value={fiscalYear} 
              onChange={e => setFiscalYear(e.target.value)} 
              className="w-10 outline-none text-slate-800 text-center"
            />
          </div>

          {/* Scenario Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
            <span className="text-[10px] uppercase text-slate-400">Scenario:</span>
            <select 
              value={scenarioType} 
              onChange={e => setScenarioType(e.target.value)}
              className="bg-transparent outline-none text-slate-800 font-extrabold"
            >
              <option value="EXPECTED">Expected</option>
              <option value="OPTIMISTIC">Optimistic</option>
              <option value="WORST_CASE">Worst Case</option>
            </select>
          </div>

          {/* Version Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
            <span className="text-[10px] uppercase text-slate-400">Version:</span>
            <select 
              value={versionName} 
              onChange={e => setVersionName(e.target.value)}
              className="bg-transparent outline-none text-slate-800 font-extrabold"
            >
              <option value="Original">Original</option>
              <option value="Revision 1">Revision 1</option>
              <option value="Revision 2">Revision 2</option>
            </select>
          </div>

          {/* Import Button */}
          {data.status === 'NO_ACTIVE_BUDGET' || data.totalBudget === 0 ? (
            <button 
              onClick={() => { setWizardStep(1); setShowImportWizard(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow transition-all cursor-pointer"
            >
              <Upload size={13} /> Import allocations
            </button>
          ) : null}

          <button 
            onClick={loadDashboard}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-slate-100 shadow-sm bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main KPI Grid: 6 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Budget</p>
          <p className="text-xl font-black text-slate-800 font-mono">PKR {fmt(data.totalBudget)}</p>
          <p className="text-[9px] text-slate-400 font-semibold truncate">Target Limit</p>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Actual Spend</p>
          <p className="text-xl font-black text-slate-800 font-mono">PKR {fmt(data.actual)}</p>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${data.totalBudget > 0 ? (data.actual / data.totalBudget) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Committed</p>
          <p className="text-xl font-black text-indigo-600 font-mono">PKR {fmt(data.committed)}</p>
          <p className="text-[9px] text-slate-400 font-semibold">Reserved Pipeline</p>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Forecast Year-End</p>
          <p className="text-xl font-black text-slate-800 font-mono">PKR {fmt(data.forecastYearEnd)}</p>
          <p className="text-[9px] text-slate-400 font-semibold truncate">Actual YTD + Future Limits</p>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Variance Projection</p>
          <p className={`text-xl font-black font-mono ${data.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            PKR {fmt(data.variance)}
          </p>
          <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${data.variance < 0 ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
            {data.variance < 0 ? 'DEFICIT' : 'SURPLUS'}
          </span>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Budget Risk Status</p>
          <p className={`text-lg font-black ${data.riskLevel === 'HIGH' ? 'text-rose-600 animate-pulse' : data.riskLevel === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-600'}`}>
            {data.riskLevel} RISK
          </p>
          <p className="text-[9px] text-slate-400 font-semibold">{data.departmentsOverBudget} Departments Over</p>
        </div>
      </div>

      {/* SVG Cumulative Chart & Budget Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cumulative Line Chart */}
        <div className="lg:col-span-8 bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-indigo-600" /> Budget vs Actual vs Forecast Trend (Cumulative)
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Scale matches total cumulative yearly projection bounds.</p>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-extrabold uppercase tracking-wide">
              <span className="flex items-center gap-1 text-slate-400"><span className="w-2.5 h-0.5 bg-slate-300 inline-block"></span> Budget</span>
              <span className="flex items-center gap-1 text-indigo-600"><span className="w-2.5 h-0.5 bg-indigo-600 inline-block"></span> Actual</span>
              <span className="flex items-center gap-1 text-emerald-500"><span className="w-2.5 h-0.5 bg-emerald-500 inline-block"></span> Forecast</span>
            </div>
          </div>

          <div className="w-full flex items-center justify-center bg-slate-50 rounded-2xl p-4">
            {chartPoints.length > 0 ? (
              <svg viewBox="0 0 500 220" className="w-full h-auto max-h-[220px]">
                <line x1="30" y1="30" x2="470" y2="30" stroke="#E2E8F0" strokeDasharray="3" />
                <line x1="30" y1="110" x2="470" y2="110" stroke="#E2E8F0" strokeDasharray="3" />
                <line x1="30" y1="190" x2="470" y2="190" stroke="#CBD5E1" strokeWidth="1.5" />

                <text x="5" y="34" className="text-[7px] font-bold fill-slate-400 font-mono">PKR {fmt(maxCumulative)}</text>
                <text x="5" y="114" className="text-[7px] font-bold fill-slate-400 font-mono">PKR {fmt(maxCumulative / 2)}</text>
                <text x="5" y="194" className="text-[7px] font-bold fill-slate-400 font-mono">0</text>

                <polyline
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  points={chartPoints.map(p => `${p.x},${p.yBudget}`).join(' ')}
                />
                
                <polyline
                  fill="none"
                  stroke="#4F46E5"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  points={chartPoints.map(p => `${p.x},${p.yActual}`).join(' ')}
                />

                <polyline
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="1"
                  points={chartPoints.map(p => `${p.x},${p.yForecast}`).join(' ')}
                />

                {chartPoints.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.yActual} r="3.5" className="fill-white stroke-indigo-600 stroke-[2] cursor-pointer" />
                    <text x={p.x - 4} y="212" className="text-[8px] font-mono font-bold fill-slate-500">M{p.monthLabel}</text>
                  </g>
                ))}
              </svg>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-wider">
                No monthly data compiled.
              </div>
            )}
          </div>
        </div>

        {/* Right: Budget Calendar */}
        <div className="lg:col-span-4 bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-700" /> Interactive Budget Calendar
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Click any month box to view ledger detail journals.</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {(data.months || []).map((m) => (
              <button
                key={m.month}
                onClick={() => handleMonthClick(m)}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-between text-center transition-all cursor-pointer relative overflow-hidden group ${
                  m.status === 'RED'
                    ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/50'
                    : m.status === 'YELLOW'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/50'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/50'
                }`}
              >
                <span className="text-[9px] font-black uppercase">Month {m.month}</span>
                <span className={`w-2 h-2 rounded-full mt-2 ${
                  m.status === 'RED' ? 'bg-rose-600 animate-pulse' : m.status === 'YELLOW' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <span className="text-[8px] font-mono font-bold mt-2 opacity-80 block truncate w-full">PKR {fmt(m.actual)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sorted Department Heat Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Department Utilization & Forecast Overrides</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Click "Override" to specify override budgets with justifications.</p>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 p-1 rounded-xl shadow-inner">
              <button 
                onClick={() => setHeatMapSort('utilization_desc')}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${heatMapSort === 'utilization_desc' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
              >
                Utilization
              </button>
              <button 
                onClick={() => setHeatMapSort('remaining_desc')}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${heatMapSort === 'remaining_desc' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
              >
                Remaining Balance
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {sortedDepartments.map((dept, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-800 uppercase">{dept.department}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                      dept.utilization >= 100 ? 'bg-rose-50 text-rose-800 border border-rose-100' : dept.utilization >= 80 ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                    }`}>
                      {dept.utilization}% Used
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      dept.utilization >= 100 ? 'bg-rose-500' : dept.utilization >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} style={{ width: `${Math.min(dept.utilization, 100)}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-6 text-[10px] font-semibold text-slate-500">
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">Total Budget</span>
                    <span className="font-mono text-slate-800 font-bold">PKR {fmt(dept.budget)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">Actual Spent</span>
                    <span className="font-mono text-slate-800 font-bold">PKR {fmt(dept.actual)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[8px] uppercase font-bold">Remaining</span>
                    <span className="font-mono text-slate-800 font-bold">PKR {fmt(dept.remaining)}</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      const matchingLine = data.departments.find(d => d.department === dept.department);
                      setOverrideLine({ id: matchingLine?.id || dept.department, name: dept.department });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[9px] uppercase transition-all cursor-pointer border border-slate-200"
                  >
                    <Edit3 size={11} /> Override
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Widget: Top Overspending & 3-Year Trend */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-500" /> Top Overspending Accounts
              </h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Control accounts breaching budget allocations (&gt;100%).</p>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {(data.topOverspending || []).map((acc, idx) => (
                <div key={idx} className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-slate-800">{acc.code}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[140px] font-semibold">{acc.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-rose-600 font-mono">{acc.utilization}%</p>
                    <p className="text-[9px] text-slate-400 font-bold">Limit: PKR {fmt(acc.budget)}</p>
                  </div>
                </div>
              ))}
              {(data.topOverspending || []).length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center text-slate-400 font-bold text-[10px] uppercase gap-1.5">
                  <CheckCircle size={20} className="text-emerald-500" /> No Overspending Breaches
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Strategic 3-Year Trends</h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Year-over-year global allocation comparative logs.</p>
            </div>

            <div className="space-y-3">
              {(data.trends || []).map((t, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-700">{t.year}</span>
                  <div className="flex-1 mx-3 h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(t.budget / trendsMaxValue) * 100}%` }} />
                  </div>
                  <span className="font-bold font-mono text-slate-800">PKR {fmt(t.budget)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Month detail bottom sheet modal */}
      {selectedMonth ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-black text-slate-800 uppercase text-sm tracking-wider">Month {selectedMonth.month} Detail Overview</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Monthly allocation splits and matching journal transactions.</p>
              </div>
              <button 
                onClick={() => { setSelectedMonth(null); setMonthTransactions([]); }}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs font-semibold">
              <div className="p-3.5 bg-slate-50 rounded-2xl">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold">Allocated Split</span>
                <p className="text-base font-black text-slate-800 font-mono mt-1">PKR {fmt(selectedMonth.budget)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold">Actual Consumption</span>
                <p className="text-base font-black text-slate-800 font-mono mt-1">PKR {fmt(selectedMonth.actual)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold">Remaining Cap</span>
                <p className={`text-base font-black font-mono mt-1 ${selectedMonth.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  PKR {fmt(selectedMonth.remaining)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Transactions Posted in Month</p>
              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[200px] overflow-y-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <tr>
                      <th className="p-3">Ref ID</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Source Account</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold">
                    {loadingMonthTx ? (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400 font-bold uppercase tracking-wider animate-pulse">Loading monthly logs...</td>
                      </tr>
                    ) : monthTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400 font-bold uppercase tracking-wider">No matching journal logs.</td>
                      </tr>
                    ) : (
                      monthTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-indigo-600">#{tx.id}</td>
                          <td className="p-3">{tx.date}</td>
                          <td className="p-3 font-mono text-slate-500">{tx.accountCode || 'GL-Direct'}</td>
                          <td className="p-3 text-right font-black font-mono">PKR {fmt(tx.totalAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Manual Override Form Modal */}
      {overrideLine ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-black text-slate-800 uppercase text-sm tracking-wider">Forecast Override</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Define target year-end projections manually (UAT-178).</p>
              </div>
              <button 
                onClick={() => setOverrideLine(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Target Account / Dimension</label>
                <input 
                  type="text" 
                  value={overrideLine.name} 
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Override Forecast (PKR)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 150000"
                  value={overrideAmount}
                  onChange={e => setOverrideAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-850 font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Justification Reason</label>
                <textarea 
                  rows="3" 
                  placeholder="Specify override reasons (e.g. Q4 ad campaigns, travel revision overrides)"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-850 font-bold focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setOverrideLine(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={savingOverride}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl uppercase transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {savingOverride ? 'Saving...' : 'Apply Projections'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4-Step Excel Import Wizard Bottom Sheet */}
      {showImportWizard ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-black text-slate-800 uppercase text-sm tracking-wider flex items-center gap-2">
                  <Upload size={16} className="text-indigo-600" /> Spreadsheet Allocation Import Wizard
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Wizard layout step-by-step validator (UAT-169, UAT-170).</p>
              </div>
              <button 
                onClick={() => setShowImportWizard(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stepper Wizard Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              {['Upload', 'Validate', 'Preview', 'Complete'].map((step, idx) => {
                const currentIdx = idx + 1;
                const isActive = wizardStep === currentIdx;
                const isPast = wizardStep > currentIdx;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black uppercase ${
                      isActive ? 'bg-indigo-600 text-white' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {isPast ? <Check size={11} /> : currentIdx}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase ${
                      isActive ? 'text-indigo-600' : isPast ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Step Content */}
            <div className="space-y-4">
              {wizardStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Paste raw JSON allocation data parsed from your Excel/CSV budget registry template.
                  </p>
                  <textarea
                    rows="6"
                    placeholder='e.g., [
  {"accountCode": "5010", "department": "Marketing", "allocatedAmount": 120000, "monthlySplits": [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000]}
]'
                    value={importRowsJson}
                    onChange={e => setImportRowsJson(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono focus:border-indigo-500 outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleValidateImport}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Run Validation & Validate Sheets
                    </button>
                  </div>
                </div>
              ) : wizardStep === 2 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-800 space-y-2">
                    <p className="flex items-center gap-1.5"><ShieldAlert size={16} /> Validation Errors Found</p>
                    <ul className="list-disc pl-5 font-semibold space-y-1">
                      {importErrors.map((err, idx) => (
                        <li key={idx}>Row {err.rowNum}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Back & Adjust File
                    </button>
                  </div>
                </div>
              ) : wizardStep === 3 ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Preview valid parsed rows. Click commit to import into the budget draft sheet.
                  </p>
                  <div className="border border-slate-150 rounded-2xl max-h-[160px] overflow-y-auto">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="p-2.5">Account Code</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Dept</th>
                          <th className="p-2.5 text-right">Allocated Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                        {importPreview.map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-mono">{row.accountCode}</td>
                            <td className="p-2.5">{row.accountName}</td>
                            <td className="p-2.5">{row.department}</td>
                            <td className="p-2.5 text-right font-mono">PKR {fmt(row.allocatedAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCommitImport}
                      disabled={committingImport}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
                    >
                      {committingImport ? 'Importing...' : 'Commit Import'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm mb-2">
                    <CheckCircle size={24} />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm uppercase">Import Complete!</h4>
                  <p className="text-xs text-slate-400 font-semibold">Budget allocations successfully written to registry database.</p>
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setShowImportWizard(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Close Wizard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
