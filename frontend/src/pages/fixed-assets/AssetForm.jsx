import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function AssetForm({ onClose, onSuccess, categories }) {
  const [formData, setFormData] = useState({
    asset_code: '',
    asset_name: '',
    category_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    placed_in_service_date: new Date().toISOString().split('T')[0],
    purchase_cost: '',
    salvage_value: '',
    useful_life_years: '',
    depreciation_method: 'STRAIGHT_LINE',
    serial_number: '',
    location_id: '',
    custodian_employee_id: '',
    notes: '',
    estimated_total_units: ''
  });
  const [warehouses, setWarehouses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWarehouses();
    fetchEmployees();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const { data } = await api.get('/warehouses');
      setWarehouses(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get('/employees');
      setEmployees(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCategoryChange = (catId) => {
    const selectedCat = categories.find(c => c.id === parseInt(catId));
    if (selectedCat) {
      const cost = parseFloat(formData.purchase_cost || 0);
      const computedSalvage = cost > 0 
        ? (cost * parseFloat(selectedCat.default_salvage_percent)) / 100 
        : '';

      setFormData(prev => ({
        ...prev,
        category_id: catId,
        useful_life_years: selectedCat.default_useful_life_years,
        depreciation_method: selectedCat.default_depreciation_method,
        salvage_value: computedSalvage
      }));
    } else {
      setFormData(prev => ({ ...prev, category_id: catId }));
    }
  };

  const handleCostChange = (costVal) => {
    const cost = parseFloat(costVal || 0);
    const selectedCat = categories.find(c => c.id === parseInt(formData.category_id));
    let salvage = formData.salvage_value;

    if (selectedCat && cost > 0) {
      salvage = (cost * parseFloat(selectedCat.default_salvage_percent)) / 100;
    }

    setFormData(prev => ({
      ...prev,
      purchase_cost: costVal,
      salvage_value: salvage
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        purchase_cost: parseFloat(formData.purchase_cost),
        salvage_value: parseFloat(formData.salvage_value || 0),
        useful_life_years: parseInt(formData.useful_life_years),
        location_id: formData.location_id ? parseInt(formData.location_id) : null,
        custodian_employee_id: formData.custodian_employee_id ? parseInt(formData.custodian_employee_id) : null,
        estimated_total_units: formData.depreciation_method === 'UNITS_OF_PRODUCTION' ? parseFloat(formData.estimated_total_units) : null
      };

      await api.post('/fixed-assets/assets', payload);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to capitalize asset card.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800 uppercase">Capitalize Fixed Asset Card</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col min-h-0 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 font-bold animate-pulse">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
            {/* Asset Code */}
            <div className="space-y-1">
              <label className="text-slate-500">Asset Ref / Code</label>
              <input
                type="text"
                required
                placeholder="e.g. AST-VHC-001"
                value={formData.asset_code}
                onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono font-bold uppercase"
              />
            </div>

            {/* Asset Name */}
            <div className="space-y-1">
              <label className="text-slate-500">Asset Description Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Toyota Corolla (Active)"
                value={formData.asset_name}
                onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-bold"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-slate-500">Asset Class Category</label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-bold"
              >
                <option value="">Select Category Class...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>
            </div>

            {/* Serial Number */}
            <div className="space-y-1">
              <label className="text-slate-500">Serial Number / Chassis Code (Optional)</label>
              <input
                type="text"
                placeholder="e.g. S/N 49829"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono"
              />
            </div>

            {/* Purchase Date */}
            <div className="space-y-1">
              <label className="text-slate-500">Acquisition Purchase Date</label>
              <input
                type="date"
                required
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono"
              />
            </div>

            {/* Placed in Service Date */}
            <div className="space-y-1">
              <label className="text-slate-500">Placed in Service Date</label>
              <input
                type="date"
                required
                value={formData.placed_in_service_date}
                onChange={(e) => setFormData({ ...formData, placed_in_service_date: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono"
              />
            </div>

            {/* Cost */}
            <div className="space-y-1">
              <label className="text-slate-500">Acquisition Cost Value (PKR)</label>
              <input
                type="number"
                required
                placeholder="0.00"
                value={formData.purchase_cost}
                onChange={(e) => handleCostChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono font-bold"
              />
            </div>

            {/* Salvage Value */}
            <div className="space-y-1">
              <label className="text-slate-500">Estimated Salvage Value (PKR)</label>
              <input
                type="number"
                placeholder="0.00"
                value={formData.salvage_value}
                onChange={(e) => setFormData({ ...formData, salvage_value: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono font-bold"
              />
            </div>

            {/* Useful Life */}
            <div className="space-y-1">
              <label className="text-slate-500">Estimated Useful Life (Years)</label>
              <input
                type="number"
                required
                placeholder="5"
                value={formData.useful_life_years}
                onChange={(e) => setFormData({ ...formData, useful_life_years: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono"
              />
            </div>

            {/* Depreciation Method */}
            <div className="space-y-1">
              <label className="text-slate-500">Depreciation Rule Method</label>
              <select
                required
                value={formData.depreciation_method}
                onChange={(e) => setFormData({ ...formData, depreciation_method: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600 font-bold"
              >
                <option value="STRAIGHT_LINE">Straight Line</option>
                <option value="REDUCING_BALANCE">Reducing Balance (Double Declining)</option>
                <option value="UNITS_OF_PRODUCTION">Units of Production</option>
              </select>
            </div>

            {/* Units Capacity (Conditional) */}
            {formData.depreciation_method === 'UNITS_OF_PRODUCTION' && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-indigo-600 font-black">Estimated Total Capacity Units (KM / Hrs / Cycles)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={formData.estimated_total_units}
                  onChange={(e) => setFormData({ ...formData, estimated_total_units: e.target.value })}
                  className="w-full px-3 py-1.5 bg-indigo-50/20 border border-indigo-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono font-bold"
                />
              </div>
            )}

            {/* Location */}
            <div className="space-y-1">
              <label className="text-slate-500">Asset Physical Location (Optional)</label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600"
              >
                <option value="">No Location Assigned...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Custodian */}
            <div className="space-y-1">
              <label className="text-slate-500">Custodian / Owner Employee (Optional)</label>
              <select
                value={formData.custodian_employee_id}
                onChange={(e) => setFormData({ ...formData, custodian_employee_id: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-600"
              >
                <option value="">No Custodian Assigned...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-slate-500">Internal Card Remarks / Notes</label>
              <textarea
                rows={2}
                placeholder="Acquisition parameters, warranty, or insurance details..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 -mx-5 -mb-5 p-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-black transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Save size={14} /> {submitting ? 'Capitalizing...' : 'Capitalize Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
