import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  Settings, 
  BarChart, 
  PlusCircle, 
  Play, 
  Calendar, 
  DollarSign, 
  Layers, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function FixedAssetsDashboard() {
  const { activeCompany } = useAuthStore();
  const [metrics, setMetrics] = useState({
    totalCost: 0,
    accumulatedDep: 0,
    netBookValue: 0,
    activeCount: 0
  });
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentLedger, setRecentLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [activeCompany]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch Assets list to calculate metrics and charts locally to avoid backend lag
      const { data: assets } = await api.get('/fixed-assets/assets');
      
      let totalCost = 0;
      let activeCount = 0;
      const categoriesMap = {};

      assets.forEach(a => {
        totalCost += parseFloat(a.purchase_cost || 0);
        if (a.status === 'ACTIVE') activeCount++;
        
        const catName = a.category_name || 'Uncategorized';
        categoriesMap[catName] = (categoriesMap[catName] || 0) + parseFloat(a.purchase_cost || 0);
      });

      // Fetch categories to sum details from Accounting book
      let totalAccumulated = 0;
      const chartCats = Object.entries(categoriesMap).map(([name, value]) => ({ name, value }));

      // Fetch assets with books to get accurate net book value and accumulated dep
      // Let's resolve detail for each asset
      const assetsWithBooks = await Promise.all(
        assets.map(async (a) => {
          try {
            const { data } = await api.get(`/fixed-assets/assets/${a.id}/inquiry`);
            return data;
          } catch {
            return null;
          }
        })
      );

      assetsWithBooks.forEach(item => {
        if (!item) return;
        const acctBook = item.depreciationBooks?.find(b => b.book_name === 'Accounting');
        if (acctBook) {
          totalAccumulated += parseFloat(acctBook.accumulated_depreciation || 0);
        }
      });

      setMetrics({
        totalCost,
        accumulatedDep: totalAccumulated,
        netBookValue: totalCost - totalAccumulated,
        activeCount
      });

      setCategoryData(chartCats);

      // Fetch recent ledger across all assets (we can collect ledger lines from assetsWithBooks)
      const allLedger = [];
      assetsWithBooks.forEach(item => {
        if (!item) return;
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

      // Sort by date desc
      allLedger.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
      setRecentLedger(allLedger.slice(0, 5));

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

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Asset Management</h1>
          <p className="text-slate-500 text-sm font-semibold">Track capitalization, sub-ledger events, and calculate period depreciation runs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/fixed-assets/categories" className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Settings size={14} /> Categories
          </Link>
          <Link to="/dashboard/fixed-assets/wizard" className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-black transition-all flex items-center gap-1.5 shadow-md">
            <Play size={14} /> Run Depreciation
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Acquisition Cost</span>
          <p className="text-xl font-black text-slate-800 font-mono">PKR {metrics.totalCost.toLocaleString()}</p>
          <div className="mt-2 text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Layers size={12} className="text-slate-400" /> {metrics.activeCount} Capitalized Asset Cards
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Accumulated Depreciation</span>
          <p className="text-xl font-black text-slate-800 font-mono text-rose-600">PKR {metrics.accumulatedDep.toLocaleString()}</p>
          <div className="mt-2 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
            <Calendar size={12} /> Under Accounting Book
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Net Book Value</span>
          <p className="text-xl font-black text-slate-800 font-mono text-emerald-600">PKR {metrics.netBookValue.toLocaleString()}</p>
          <div className="mt-2 text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
            <DollarSign size={12} /> Current financial balance sheet carrying value
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Asset Status Registry</span>
          <p className="text-xl font-black text-slate-800 font-mono">{metrics.activeCount} Active</p>
          <div className="mt-2 text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Activity size={12} className="text-emerald-500" /> Capitalized & Depreciating
          </div>
        </div>
      </div>

      {/* Chart Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost by Category */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider mb-4">Capitalization by Category</h3>
          <div className="h-60 w-full relative flex items-center justify-center">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `PKR ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-slate-400 text-sm font-semibold">No category allocations.</span>
            )}
          </div>
          <div className="mt-4 space-y-1.5 flex-1 overflow-y-auto max-h-36 pr-1">
            {categoryData.map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span className="text-slate-600 font-bold">{cat.name}</span>
                </div>
                <span className="font-mono text-slate-500">PKR {cat.value.toLocaleString()}</span>
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
                  <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Depreciation (PKR)" />
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

      {/* Asset Sub-ledger Activities & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Ledger logs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider border-b border-slate-50 pb-2">Recent Sub-Ledger Activities</h3>
          <div className="flow-root">
            <ul className="-mb-8">
              {recentLedger.map((event, idx) => (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {idx !== recentLedger.length - 1 && (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white text-[10px] font-bold ${
                          event.event_type === 'ACQUISITION' ? 'bg-emerald-50 text-emerald-600' :
                          event.event_type === 'DEPRECIATION' ? 'bg-indigo-50 text-indigo-600' :
                          'bg-rose-50 text-rose-600'
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
          <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider">Asset Registry Hub</h3>
          <div className="grid grid-cols-1 gap-2">
            <Link to="/dashboard/fixed-assets/register" className="p-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl border border-slate-100 flex items-center justify-between group transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Briefcase size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black">Asset Register</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Browse and edit master asset cards.</p>
                </div>
              </div>
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
            </Link>

            <Link to="/dashboard/fixed-assets/register?new=true" className="p-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl border border-slate-100 flex items-center justify-between group transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <PlusCircle size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black">Capitalize Asset</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Register and acquire a new asset card.</p>
                </div>
              </div>
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
            </Link>

            <Link to="/dashboard/fixed-assets/categories" className="p-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl border border-slate-100 flex items-center justify-between group transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Settings size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black">Category Mappings</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Map categories to GL accounts.</p>
                </div>
              </div>
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
