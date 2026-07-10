import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, RefreshCw, Filter, ShieldAlert, CheckCircle2, 
  ChevronRight, Calendar, User, FileText, ArrowUpRight, Percent, AlertTriangle, ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function BudgetVsActualReport() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [reportData, setReportData] = useState({ header: null, lines: [] });
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');

  // Selected override info modal
  const [activeTab, setActiveTab] = useState('comparison'); // 'comparison' | 'overrides'

  useEffect(() => {
    if (activeCompany) {
      loadReport();
      loadOverrides();
    }
  }, [activeCompany, fiscalYear, department, branch]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/budgets/reports/vs-actual', {
        params: {
          fiscalYear,
          department: department || undefined,
          branch: branch || undefined
        }
      });
      setReportData(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadOverrides = async () => {
    try {
      const { data } = await api.get('/budgets/reports/overrides');
      setOverrides(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Compute overall stats
  const totalAllocated = reportData.lines.reduce((sum, l) => sum + l.allocated, 0);
  const totalConsumed = reportData.lines.reduce((sum, l) => sum + l.consumed, 0);
  const totalActual = reportData.lines.reduce((sum, l) => sum + l.actual, 0);
  const totalCommitted = reportData.lines.reduce((sum, l) => sum + l.committed, 0);
  const totalRemaining = totalAllocated - totalConsumed;
  const overallPct = totalAllocated > 0 ? (totalConsumed / totalAllocated) * 100 : 0;

  const fmt = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-emerald-800 hover:bg-emerald-100/50 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <BarChart2 size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Budget vs Actual</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Dashboard</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5">
              Monitor real-time budget utilization, committed reservations, and override logs.
            </p>
          </div>
        </div>

        <button 
          onClick={loadReport} 
          className="mt-3 md:mt-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-100 shadow-sm transition-all bg-white"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button 
          onClick={() => setActiveTab('comparison')}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'comparison' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Budget Utilization
        </button>
        <button 
          onClick={() => setActiveTab('overrides')}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overrides' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Override Logs ({overrides.length})
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end text-xs font-semibold text-slate-600">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Filter size={11} /> Year</label>
          <input 
            type="text"
            value={fiscalYear}
            onChange={e => setFiscalYear(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 w-24 outline-none font-bold"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
          <select 
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-bold w-36 outline-none"
          >
            <option value="">All Departments</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Sales">Sales</option>
            <option value="Finance">Finance</option>
            <option value="IT">IT</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch</label>
          <select 
            value={branch}
            onChange={e => setBranch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-bold w-36 outline-none"
          >
            <option value="">All Branches</option>
            <option value="Karachi">Karachi</option>
            <option value="Lahore">Lahore</option>
            <option value="Islamabad">Islamabad</option>
          </select>
        </div>
      </div>

      {activeTab === 'comparison' ? (
        <>
          {/* Main KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm text-xs font-bold text-slate-400">
              <p className="uppercase tracking-wider">Total Allocated Budget</p>
              <p className="text-xl font-black text-slate-800 mt-1 font-mono">PKR {fmt(totalAllocated)}</p>
            </div>
            
            <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm text-xs font-bold text-slate-400">
              <p className="uppercase tracking-wider">Actual Consumed (Posted)</p>
              <p className="text-xl font-black text-slate-800 mt-1 font-mono">PKR {fmt(totalActual)}</p>
            </div>

            <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm text-xs font-bold text-slate-400">
              <p className="uppercase tracking-wider">Committed Pipeline</p>
              <p className="text-xl font-black text-indigo-600 mt-1 font-mono">PKR {fmt(totalCommitted)}</p>
            </div>

            <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm text-xs font-bold text-slate-400">
              <p className="uppercase tracking-wider">Remaining Balance</p>
              <p className={`text-xl font-black mt-1 font-mono ${totalRemaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                PKR {fmt(totalRemaining)}
              </p>
            </div>
          </div>

          {/* Consumption utilisation overall indicator */}
          <div className="bg-white p-6 border border-slate-100 rounded-3xl shadow-sm space-y-3">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500 uppercase tracking-wider">Overall Budget Consumption</span>
              <span className="text-slate-800 font-mono">{overallPct.toFixed(1)}% Used</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                style={{ width: `${Math.min(overallPct, 100)}%` }} 
                className={`h-full rounded-full transition-all duration-500 ${
                  overallPct >= 100 ? 'bg-rose-500' : overallPct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>

          {/* Report Lines table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                <RefreshCw className="animate-spin mx-auto mb-3 text-emerald-500" size={24} /> Loading comparisons...
              </div>
            ) : reportData.lines.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs font-semibold">
                No budget allocation records found matching active filters.
              </div>
            ) : (
              <table className="w-full text-xs font-semibold text-slate-700">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="px-5 py-3.5 text-left">GL Account</th>
                    <th className="px-5 py-3.5 text-left">Department</th>
                    <th className="px-5 py-3.5 text-left">Branch</th>
                    <th className="px-5 py-3.5 text-right">Allocated</th>
                    <th className="px-5 py-3.5 text-right">Committed</th>
                    <th className="px-5 py-3.5 text-right">Actual</th>
                    <th className="px-5 py-3.5 text-right">Consumed</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-left w-36">Utilisation</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.lines.map(line => (
                    <tr key={line.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <p className="text-slate-800 font-extrabold">{line.account_code}</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">{line.account_name}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-bold">{line.department || '—'}</td>
                      <td className="px-5 py-4 text-slate-500 font-bold">{line.branch || '—'}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-700">PKR {fmt(line.allocated)}</td>
                      <td className="px-5 py-4 text-right font-mono text-indigo-600">PKR {fmt(line.committed)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-800">PKR {fmt(line.actual)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-900 font-extrabold">PKR {fmt(line.consumed)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          line.pctUsed >= 100 ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          line.pctUsed >= 85 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {line.pctUsed >= 100 ? 'Breached' : line.pctUsed >= 85 ? 'Warning' : 'Healthy'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              style={{ width: `${Math.min(line.pctUsed, 100)}%` }} 
                              className={`h-full rounded-full ${
                                line.pctUsed >= 100 ? 'bg-rose-500' : line.pctUsed >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono font-bold text-right">{line.pctUsed.toFixed(1)}%</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* OVERRIDES LOG PANEL */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {overrides.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs font-semibold">
              No CFO budget override releases logged.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {overrides.map((ov, idx) => (
                <div key={idx} className="p-5 flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-[9px] font-black text-indigo-700 uppercase tracking-wider">
                        {ov.document_type_code} #{ov.document_id}
                      </span>
                      <span className="text-slate-400 font-bold">Approved Budget Override</span>
                    </div>
                    <p className="font-extrabold text-slate-800 text-[13px]">{ov.comments || 'Manual budget override release'}</p>
                    <div className="flex items-center gap-2 text-slate-400 font-semibold mt-1">
                      <span className="flex items-center gap-0.5"><User size={11} /> {ov.actioned_by}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5"><Calendar size={11} /> {new Date(ov.actioned_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl">
                      <CheckCircle2 size={13} /> CFO Released
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
