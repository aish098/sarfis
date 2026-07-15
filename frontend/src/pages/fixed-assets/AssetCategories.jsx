import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, Save, AlertCircle, PlusCircle, Edit, Info, Database, BarChart3, TrendingDown, ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';

export default function AssetCategories() {
  const { activeCompany } = useAuthStore();
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selected category state
  const [selectedCat, setSelectedCat] = useState(null);
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'accounting' | 'statistics'
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    category_name: '',
    default_useful_life_years: 5,
    default_depreciation_method: 'STRAIGHT_LINE',
    default_salvage_percent: 10,
    asset_account_id: '',
    accumulated_depreciation_account_id: '',
    depreciation_expense_account_id: ''
  });

  // Live impact variables
  const [testLife, setTestLife] = useState(5);
  const [testMethod, setTestMethod] = useState('STRAIGHT_LINE');
  const [testSalvage, setTestSalvage] = useState(10);

  useEffect(() => {
    fetchCategoriesAccountsAssets();
  }, [activeCompany]);

  const fetchCategoriesAccountsAssets = async () => {
    try {
      setLoading(true);
      const [catsRes, accsRes, assetsRes] = await Promise.all([
        api.get('/fixed-assets/categories'),
        api.get('/accounts'),
        api.get('/fixed-assets/assets')
      ]);
      setCategories(catsRes.data);
      setAccounts(accsRes.data || []);
      setAssets(assetsRes.data || []);
      
      if (catsRes.data.length > 0) {
        handleSelectCategory(catsRes.data[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSelectCategory = (cat) => {
    setSelectedCat(cat);
    setIsEditing(false);
    setFormData({
      category_name: cat.category_name,
      default_useful_life_years: cat.default_useful_life_years,
      default_depreciation_method: cat.default_depreciation_method,
      default_salvage_percent: cat.default_salvage_percent,
      asset_account_id: cat.asset_account_id || '',
      accumulated_depreciation_account_id: cat.accumulated_depreciation_account_id || '',
      depreciation_expense_account_id: cat.depreciation_expense_account_id || ''
    });
    setTestLife(cat.default_useful_life_years);
    setTestMethod(cat.default_depreciation_method);
    setTestSalvage(cat.default_salvage_percent);
  };

  const handleAddClick = () => {
    setSelectedCat(null);
    setIsEditing(true);
    setFormData({
      category_name: '',
      default_useful_life_years: 5,
      default_depreciation_method: 'STRAIGHT_LINE',
      default_salvage_percent: 10,
      asset_account_id: '',
      accumulated_depreciation_account_id: '',
      depreciation_expense_account_id: ''
    });
    setTestLife(5);
    setTestMethod('STRAIGHT_LINE');
    setTestSalvage(10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        default_useful_life_years: parseInt(testLife),
        default_depreciation_method: testMethod,
        default_salvage_percent: parseFloat(testSalvage),
        asset_account_id: formData.asset_account_id ? parseInt(formData.asset_account_id) : null,
        accumulated_depreciation_account_id: formData.accumulated_depreciation_account_id ? parseInt(formData.accumulated_depreciation_account_id) : null,
        depreciation_expense_account_id: formData.depreciation_expense_account_id ? parseInt(formData.depreciation_expense_account_id) : null
      };

      if (selectedCat) {
        await api.put(`/fixed-assets/categories/${selectedCat.id}`, payload);
      } else {
        await api.post('/fixed-assets/categories', payload);
      }

      setIsEditing(false);
      fetchCategoriesAccountsAssets();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update category.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter asset/contra-asset/expense accounts
  const assetAccounts = accounts.filter(a => a.code.startsWith('1') || a.type === 'Asset');
  const contraAccounts = accounts.filter(a => a.code.startsWith('1') || a.type === 'Asset');
  const expenseAccounts = accounts.filter(a => a.code.startsWith('5') || a.type === 'Expense');

  // Statistics calculation for selected category
  const getCatStats = () => {
    if (!selectedCat) return { count: 0, bookValue: 0, avgAge: 0, depThisYear: 0 };
    const catAssets = assets.filter(a => a.category_id === selectedCat.id);
    const count = catAssets.length;
    let totalBV = 0;
    let totalAge = 0;
    
    catAssets.forEach(a => {
      totalBV += parseFloat(a.purchase_cost || 0); // basic fallback
      const ageYrs = (new Date() - new Date(a.purchase_date)) / (1000 * 60 * 60 * 24 * 365.25);
      totalAge += ageYrs;
    });

    return {
      count,
      bookValue: totalBV,
      avgAge: count > 0 ? (totalAge / count).toFixed(1) : 0,
      depThisYear: totalBV * 0.15 // mockup value
    };
  };

  const stats = getCatStats();

  // Live impact math engine on a PKR 1,000,000 asset
  const getLiveImpact = () => {
    const cost = 1000000;
    
    // OLD default math
    let oldVal = 0;
    if (selectedCat) {
      const oldLife = parseInt(selectedCat.default_useful_life_years || 5);
      const oldSalvage = parseFloat(selectedCat.default_salvage_percent || 10);
      const oldMethod = selectedCat.default_depreciation_method;
      
      const oldSalValue = (cost * oldSalvage) / 100;
      if (oldMethod === 'STRAIGHT_LINE') {
        oldVal = (cost - oldSalValue) / (oldLife * 12);
      } else {
        const annualRate = 2 / oldLife;
        oldVal = (cost * annualRate) / 12;
      }
    }

    // NEW target math
    let newVal = 0;
    const newSalValue = (cost * parseFloat(testSalvage)) / 100;
    if (testMethod === 'STRAIGHT_LINE') {
      newVal = (cost - newSalValue) / (parseInt(testLife) * 12);
    } else {
      const annualRate = 2 / parseInt(testLife);
      newVal = (cost * annualRate) / 12;
    }

    return {
      oldDep: Math.round(oldVal),
      newDep: Math.round(newVal),
      diff: Math.round(newVal - oldVal)
    };
  };

  const impact = getLiveImpact();

  return (
    <WorkspaceLayout
      title="Category Settings"
      subtitle="Establish default rules and map asset accounts to General Ledger postings."
      icon={Settings}
      badgeText="Fixed Assets"
      breadcrumbs={['ACCOUNTELLENCE', 'Fixed Assets', 'Category Settings']}
      primaryAction={
        <div className="flex gap-2">
          <Link 
            to="/dashboard/fixed-assets"
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <button 
            onClick={handleAddClick} 
            className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md border-none cursor-pointer"
          >
            <PlusCircle size={14} /> Create Category
          </button>
        </div>
      }
    >
      <div className="col-span-full space-y-6">

      {/* Main Grid split-view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column category list */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-fit">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Asset Classes</span>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
              {categories.length} Classes
            </span>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`w-full p-4 text-left transition-all flex items-center justify-between ${
                    selectedCat?.id === cat.id ? 'bg-emerald-50/40 text-emerald-700 font-bold border-l-4 border-emerald-600' : 'text-slate-600 hover:bg-slate-50/30'
                  }`}
                >
                  <div>
                    <p className="text-xs font-black">{cat.category_name}</p>
                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                      {cat.default_depreciation_method} • {cat.default_useful_life_years} Years
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {assets.filter(a => a.category_id === cat.id).length} assets
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column details and tabs control center */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCat || isEditing ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header and editing tools */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                    <Settings size={14} className="text-emerald-600" />
                    {isEditing ? (selectedCat ? 'Configure category policies' : 'New category setup') : selectedCat.category_name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Verify asset definitions and accounting journals before saving.</p>
                </div>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md text-[10px] font-black transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Edit size={11} /> Modify default rules
                  </button>
                )}
              </div>

              {/* Detail Tabs menu */}
              {!isEditing && (
                <div className="px-5 border-b border-slate-100 flex items-center gap-4 text-xs font-bold text-slate-500 bg-white">
                  <button onClick={() => setActiveTab('general')} className={`py-3 border-b-2 transition-all ${activeTab === 'general' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-700'}`}>
                    General Parameters
                  </button>
                  <button onClick={() => setActiveTab('accounting')} className={`py-3 border-b-2 transition-all ${activeTab === 'accounting' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-700'}`}>
                    Accounting GL Rules
                  </button>
                  <button onClick={() => setActiveTab('statistics')} className={`py-3 border-b-2 transition-all ${activeTab === 'statistics' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-700'}`}>
                    Statistics
                  </button>
                </div>
              )}

              {/* Form submit wraps everything */}
              <form onSubmit={handleSubmit}>
                <div className="p-5">
                  {error && (
                    <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 font-bold">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  {/* General Configuration */}
                  {(isEditing || activeTab === 'general') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-4 text-xs font-semibold text-slate-600">
                        {isEditing && (
                          <div className="space-y-1">
                            <label className="text-slate-500">Asset Category Name</label>
                            <input
                              type="text"
                              required
                              value={formData.category_name}
                              onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white font-bold"
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-slate-500">Useful Life (Years)</label>
                            {isEditing ? (
                              <input
                                type="number"
                                required
                                value={testLife}
                                onChange={(e) => setTestLife(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white font-mono"
                              />
                            ) : (
                              <p className="p-2 bg-slate-50 rounded border border-slate-100 font-bold text-slate-800">{selectedCat.default_useful_life_years} Years</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500">Salvage Value Percentage (%)</label>
                            {isEditing ? (
                              <input
                                type="number"
                                required
                                value={testSalvage}
                                onChange={(e) => setTestSalvage(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white font-mono"
                              />
                            ) : (
                              <p className="p-2 bg-slate-50 rounded border border-slate-100 font-bold text-slate-800">{selectedCat.default_salvage_percent}%</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500">Depreciation Calculation Rule</label>
                          {isEditing ? (
                            <select
                              value={testMethod}
                              onChange={(e) => setTestMethod(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white text-slate-600 font-bold"
                            >
                              <option value="STRAIGHT_LINE">Straight Line</option>
                              <option value="REDUCING_BALANCE">Reducing Balance (Double Declining)</option>
                              <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                            </select>
                          ) : (
                            <p className="p-2 bg-slate-50 rounded border border-slate-100 font-bold text-slate-800">{selectedCat.default_depreciation_method}</p>
                          )}
                        </div>
                      </div>

                      {/* Live Impact Preview Card */}
                      <div className="md:col-span-1 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                            <TrendingDown size={12} /> Live Impact Preview
                          </h4>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Estimated monthly cost on PKR 1,000,000 asset.</p>
                          <div className="mt-4 space-y-2 text-xs font-semibold">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Old Dep:</span>
                              <span className="font-mono text-slate-600">PKR {selectedCat ? impact.oldDep.toLocaleString() : '0'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-emerald-600 font-bold">New Dep:</span>
                              <span className="font-mono text-emerald-700 font-bold">PKR {impact.newDep.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`mt-4 p-2 rounded text-[10px] font-bold text-center border ${
                          impact.diff > 0 ? 'bg-rose-50 text-rose-700 border-rose-100' :
                          impact.diff < 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          Diff: {impact.diff > 0 ? `+PKR ${impact.diff.toLocaleString()}` : `PKR ${impact.diff.toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Accounting tab / fields */}
                  {(isEditing || activeTab === 'accounting') && (
                    <div className="space-y-4 text-xs font-semibold text-slate-600">
                      <div className="space-y-1">
                        <label className="text-slate-500">Fixed Asset Account (Dr Purchase)</label>
                        {isEditing ? (
                          <select
                            value={formData.asset_account_id}
                            onChange={(e) => setFormData({ ...formData, asset_account_id: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white text-slate-600 font-mono"
                          >
                            <option value="">Select Asset Account...</option>
                            {assetAccounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="p-2 bg-slate-50 rounded border border-slate-100 font-bold text-slate-800 font-mono">
                            {accounts.find(a => a.id === selectedCat.asset_account_id) ? `${accounts.find(a => a.id === selectedCat.asset_account_id).code} - ${accounts.find(a => a.id === selectedCat.asset_account_id).name}` : 'Unmapped'}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-500">Accumulated Dep. Account (Cr Allocation)</label>
                        {isEditing ? (
                          <select
                            value={formData.accumulated_depreciation_account_id}
                            onChange={(e) => setFormData({ ...formData, accumulated_depreciation_account_id: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white text-slate-600 font-mono"
                          >
                            <option value="">Select Contra-Asset Account...</option>
                            {contraAccounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="p-2 bg-slate-50 rounded border border-slate-100 font-bold text-slate-800 font-mono">
                            {accounts.find(a => a.id === selectedCat.accumulated_depreciation_account_id) ? `${accounts.find(a => a.id === selectedCat.accumulated_depreciation_account_id).code} - ${accounts.find(a => a.id === selectedCat.accumulated_depreciation_account_id).name}` : 'Unmapped'}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-500">Depreciation Expense Account (Dr Period)</label>
                        {isEditing ? (
                          <select
                            value={formData.depreciation_expense_account_id}
                            onChange={(e) => setFormData({ ...formData, depreciation_expense_account_id: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white text-slate-600 font-mono"
                          >
                            <option value="">Select Expense Account...</option>
                            {expenseAccounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="p-2 bg-slate-50 rounded border border-slate-100 font-bold text-slate-800 font-mono">
                            {accounts.find(a => a.id === selectedCat.depreciation_expense_account_id) ? `${accounts.find(a => a.id === selectedCat.depreciation_expense_account_id).code} - ${accounts.find(a => a.id === selectedCat.depreciation_expense_account_id).name}` : 'Unmapped'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Statistics tab */}
                  {!isEditing && activeTab === 'statistics' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-1">Active Assets</span>
                        <p className="text-sm font-black text-slate-800 font-mono">{stats.count}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-1">Carrying Value</span>
                        <p className="text-sm font-black text-slate-800 font-mono">PKR {stats.bookValue.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-1">Average Age</span>
                        <p className="text-sm font-black text-slate-800 font-mono">{stats.avgAge} Yrs</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-1">Dep recorded this year</span>
                        <p className="text-sm font-black text-rose-600 font-mono">PKR {stats.depThisYear.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save and cancel handlers */}
                {isEditing && (
                  <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all shadow-md flex items-center gap-1"
                    >
                      <Save size={13} /> {submitting ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center text-xs font-semibold text-slate-400 space-y-2">
              <Database size={24} className="mx-auto text-slate-300" />
              <p>Select a category class on the left list to view configuration settings, statistics, and live impact previews.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </WorkspaceLayout>
  );
}
