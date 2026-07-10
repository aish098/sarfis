import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, Sliders, ArrowLeft, RefreshCw, Calendar, 
  TrendingUp, AlertTriangle, CheckCircle, ShieldAlert,
  FolderMinus, ArrowUpRight, DollarSign, Layers
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function BudgetDashboard() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [data, setData] = useState({
    totalBudget: 0,
    actual: 0,
    committed: 0,
    available: 0,
    utilization: 0,
    warnings: 0,
    blocked: 0,
    forecastYearEnd: 0,
    variance: 0,
    status: 'NO_ACTIVE_BUDGET'
  });

  useEffect(() => {
    if (activeCompany) {
      loadDashboard();
    }
  }, [activeCompany, fiscalYear]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/budgets/dashboard', {
        params: { fiscalYear }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fmt = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EEF2FF] border border-[#E0E7FF] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
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
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-indigo-950 tracking-tight uppercase">Budget Dashboard</h1>
              <span className="text-[10px] font-extrabold uppercase bg-indigo-500/15 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-500/20">Executive Overview</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5">
              Monitor real-time company utilization, forecasting projections, and limit warnings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 md:mt-0">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
            <span className="text-[10px] uppercase text-slate-400">Year:</span>
            <input 
              type="text" 
              value={fiscalYear} 
              onChange={e => setFiscalYear(e.target.value)} 
              className="w-12 outline-none text-slate-800 text-center"
            />
          </div>

          <button 
            onClick={loadDashboard}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-slate-100 shadow-sm bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => navigate('/dashboard/finance/budgets')}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Sliders size={14} /> Allocation Registry
          </button>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Allocated Budget</p>
          <p className="text-2xl font-black text-slate-800 font-mono">PKR {fmt(data.totalBudget)}</p>
          <p className="text-[10px] text-slate-400 font-bold">Approved Version: <span className="text-slate-600">{data.version || 'None'}</span></p>
        </div>

        <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actual Consumed (Posted)</p>
          <p className="text-2xl font-black text-slate-800 font-mono">PKR {fmt(data.actual)}</p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${data.totalBudget > 0 ? (data.actual / data.totalBudget) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Committed Pipeline</p>
          <p className="text-2xl font-black text-indigo-600 font-mono">PKR {fmt(data.committed)}</p>
          <p className="text-[10px] text-slate-400 font-bold">Reserved from pending vouchers</p>
        </div>

        <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Balance</p>
          <p className={`text-2xl font-black font-mono ${data.available < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            PKR {fmt(data.available)}
          </p>
          <p className="text-[10px] text-slate-400 font-bold">Unused control balance</p>
        </div>
      </div>

      {/* Utilization & Health Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Utilization Progress */}
        <div className="lg:col-span-8 bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Overall Budget Utilization</h3>
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{data.utilization}% Used</span>
          </div>

          <div className="space-y-3">
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  data.utilization >= 100 ? 'bg-rose-500' : data.utilization >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(data.utilization, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>0% Initialized</span>
              <span>85% Alert Level</span>
              <span>100% Limit Reached</span>
            </div>
          </div>

          {/* Forecast Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50 text-xs font-semibold">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forecast Year-End</p>
              <p className="text-lg font-black text-slate-800 font-mono mt-1">PKR {fmt(data.forecastYearEnd)}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance Projection</p>
              <p className={`text-lg font-black font-mono mt-1 ${data.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                PKR {fmt(data.variance)}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Budget Health</p>
                <p className={`text-sm font-black mt-1 ${data.status === 'OVER_BUDGET' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {data.status === 'OVER_BUDGET' ? 'OVER BUDGET' : 'HEALTHY'}
                </p>
              </div>
              {data.status === 'OVER_BUDGET' ? (
                <ShieldAlert size={24} className="text-rose-500" />
              ) : (
                <CheckCircle size={24} className="text-emerald-500" />
              )}
            </div>
          </div>
        </div>

        {/* Right: Limits and Warnings */}
        <div className="lg:col-span-4 bg-white p-6 border border-slate-100 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Control Exceptions</h3>
            <p className="text-slate-400 text-xs font-semibold">Accounts requiring reallocation or approval.</p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-800">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert size={16} /> Blocked Accounts
                </span>
                <span className="font-mono text-base font-black">{data.blocked}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-bold text-amber-800">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={16} /> Near Limit Warning
                </span>
                <span className="font-mono text-base font-black">{data.warnings}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard/finance/budgets/vs-actual')}
            className="w-full mt-6 py-2.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-xl text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <BarChart2 size={13} /> View Utilization Reports
          </button>
        </div>
      </div>
    </div>
  );
}
