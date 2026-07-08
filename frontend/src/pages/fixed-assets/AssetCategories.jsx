import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, PlusCircle, Edit } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function AssetCategories() {
  const { activeCompany } = useAuthStore();
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form/Modal states
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category_name: '',
    default_useful_life_years: 5,
    default_depreciation_method: 'STRAIGHT_LINE',
    default_salvage_percent: 10,
    asset_account_id: '',
    accumulated_depreciation_account_id: '',
    depreciation_expense_account_id: ''
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategoriesAndAccounts();
  }, [activeCompany]);

  const fetchCategoriesAndAccounts = async () => {
    try {
      setLoading(true);
      const [catsRes, accsRes] = await Promise.all([
        api.get('/fixed-assets/categories'),
        api.get('/accounts')
      ]);
      setCategories(catsRes.data);
      setAccounts(accsRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleEditClick = (cat) => {
    setEditingId(cat.id);
    setFormData({
      category_name: cat.category_name,
      default_useful_life_years: cat.default_useful_life_years,
      default_depreciation_method: cat.default_depreciation_method,
      default_salvage_percent: cat.default_salvage_percent,
      asset_account_id: cat.asset_account_id || '',
      accumulated_depreciation_account_id: cat.accumulated_depreciation_account_id || '',
      depreciation_expense_account_id: cat.depreciation_expense_account_id || ''
    });
    setShowForm(true);
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      category_name: '',
      default_useful_life_years: 5,
      default_depreciation_method: 'STRAIGHT_LINE',
      default_salvage_percent: 10,
      asset_account_id: '',
      accumulated_depreciation_account_id: '',
      depreciation_expense_account_id: ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        default_useful_life_years: parseInt(formData.default_useful_life_years),
        default_salvage_percent: parseFloat(formData.default_salvage_percent),
        asset_account_id: formData.asset_account_id ? parseInt(formData.asset_account_id) : null,
        accumulated_depreciation_account_id: formData.accumulated_depreciation_account_id ? parseInt(formData.accumulated_depreciation_account_id) : null,
        depreciation_expense_account_id: formData.depreciation_expense_account_id ? parseInt(formData.depreciation_expense_account_id) : null
      };

      if (editingId) {
        await api.put(`/fixed-assets/categories/${editingId}`, payload);
      } else {
        await api.post('/fixed-assets/categories', payload);
      }

      setShowForm(false);
      fetchCategoriesAndAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update category.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter asset/liability/expense accounts for dropdowns
  const assetAccounts = accounts.filter(a => a.code.startsWith('1') || a.type === 'Asset');
  const liabilityAccounts = accounts.filter(a => a.code.startsWith('1') || a.type === 'Asset'); // Acc Dep are contra-assets, code starting with 1
  const expenseAccounts = accounts.filter(a => a.code.startsWith('5') || a.type === 'Expense');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Category Settings</h1>
          <p className="text-slate-500 text-sm font-semibold">Establish default rules and map asset accounts to General Ledger postings.</p>
        </div>
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md">
          <PlusCircle size={14} /> New Category
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Category Name</th>
                    <th className="px-4 py-3">Dep. Rule</th>
                    <th className="px-4 py-3 text-center">Life Limit</th>
                    <th className="px-4 py-3 text-right">Salvage %</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold">
                  {categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-slate-50/20">
                      <td className="px-4 py-3.5 font-bold text-slate-800">{cat.category_name}</td>
                      <td className="px-4 py-3.5 font-mono">{cat.default_depreciation_method}</td>
                      <td className="px-4 py-3.5 text-center">{cat.default_useful_life_years} Years</td>
                      <td className="px-4 py-3.5 text-right font-mono">{cat.default_salvage_percent}%</td>
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => handleEditClick(cat)} className="p-1 text-slate-400 hover:text-indigo-600 transition-all rounded hover:bg-slate-100">
                          <Edit size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Categories Setup / Edit Form */}
        <div className="lg:col-span-1">
          {showForm ? (
            <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-right-5 duration-200">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase">
                <Settings size={15} /> {editingId ? 'Modify Category' : 'Create Category'}
              </h3>

              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 font-bold">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                <div className="space-y-1">
                  <label className="text-slate-500">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IT Computers & Equipment"
                    value={formData.category_name}
                    onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-500">Default Life (Yrs)</label>
                    <input
                      type="number"
                      required
                      value={formData.default_useful_life_years}
                      onChange={(e) => setFormData({ ...formData, default_useful_life_years: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500">Salvage Value %</label>
                    <input
                      type="number"
                      required
                      value={formData.default_salvage_percent}
                      onChange={(e) => setFormData({ ...formData, default_salvage_percent: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500">Depreciation Method</label>
                  <select
                    value={formData.default_depreciation_method}
                    onChange={(e) => setFormData({ ...formData, default_depreciation_method: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-bold"
                  >
                    <option value="STRAIGHT_LINE">Straight Line</option>
                    <option value="REDUCING_BALANCE">Reducing Balance</option>
                    <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                  </select>
                </div>

                <hr className="border-slate-100 my-2" />
                <h4 className="text-[10px] uppercase tracking-wider text-indigo-600 font-black">GL Accounts Integration</h4>

                {/* Asset Mapped Account */}
                <div className="space-y-1">
                  <label className="text-slate-500">Fixed Asset Account (Dr Purchase)</label>
                  <select
                    value={formData.asset_account_id}
                    onChange={(e) => setFormData({ ...formData, asset_account_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-mono"
                  >
                    <option value="">Select Asset Account...</option>
                    {assetAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Accumulated Dep Account */}
                <div className="space-y-1">
                  <label className="text-slate-500">Accumulated Dep. Account (Cr Allocation)</label>
                  <select
                    value={formData.accumulated_depreciation_account_id}
                    onChange={(e) => setFormData({ ...formData, accumulated_depreciation_account_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-mono"
                  >
                    <option value="">Select Contra-Asset Account...</option>
                    {liabilityAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Expense Account */}
                <div className="space-y-1">
                  <label className="text-slate-500">Depreciation Expense Account (Dr Period)</label>
                  <select
                    value={formData.depreciation_expense_account_id}
                    onChange={(e) => setFormData({ ...formData, depreciation_expense_account_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-mono"
                  >
                    <option value="">Select Expense Account...</option>
                    {expenseAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-md flex items-center gap-1"
                >
                  <Save size={13} /> {submitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center text-xs font-semibold text-slate-500 space-y-2">
              <p>Select a category edit button on the left grid, or create a new category to configure defaults and GL account mappings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
