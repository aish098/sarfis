import React, { useState, useEffect } from 'react';
import { 
  Settings, Layers, Plus, Trash2, ShieldCheck, UserCheck, RefreshCw, 
  HelpCircle, AlertCircle, Save, Calendar, CheckSquare, PlusCircle, 
  Copy, Edit, CheckCircle2, Sliders, PlayCircle
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function BudgetRegisterPage() {
  const { activeCompany } = useAuthStore();

  const [budgets, setBudgets] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [selectedBudget, setSelectedBudget] = useState(null);
  
  // List of accounts for dropdown
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Budget Header Form State
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [name, setName] = useState('');
  const [versionName, setVersionName] = useState('Original');
  const [status, setStatus] = useState('DRAFT');
  const [isEditingHeader, setIsEditingHeader] = useState(false);

  // Budget Lines State
  const [lines, setLines] = useState([]);

  // Copy Budget Modal State
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyYear, setCopyYear] = useState('2027');
  const [pctIncrease, setPctIncrease] = useState('5');

  useEffect(() => {
    if (activeCompany) {
      loadBudgets();
      loadAccounts();
    }
  }, [activeCompany]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/budgets');
      setBudgets(data);
      if (data.length > 0) {
        handleSelectBudget(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadAccounts = async () => {
    try {
      // Fetch postable accounts
      const { data } = await api.get(`/erp/accounts/${activeCompany.id}`);
      setAccounts(data.filter(a => a.is_postable));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectBudget = async (id) => {
    setSelectedBudgetId(id);
    setIsEditingHeader(false);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.get(`/budgets/${id}`);
      setSelectedBudget(data.header);
      setLines(data.lines.map(l => ({
        accountId: l.account_id,
        department: l.department || '',
        project: l.project || '',
        branch: l.branch || '',
        allocatedAmount: l.allocated_amount,
        alertThresholdPct: l.alert_threshold_pct,
        controlLevel: l.control_level
      })));
      
      // Update form values
      setFiscalYear(data.header.fiscal_year);
      setName(data.header.name);
      setVersionName(data.header.version_name);
      setStatus(data.header.status);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNew = () => {
    setSelectedBudget(null);
    setSelectedBudgetId('');
    setLines([]);
    setFiscalYear(new Date().getFullYear().toString());
    setName('New Budget Plan');
    setVersionName('Original');
    setStatus('DRAFT');
    setIsEditingHeader(true);
  };

  const saveHeader = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/budgets', {
        id: selectedBudgetId || null,
        fiscalYear,
        name,
        versionName,
        status
      });
      setSuccess('Budget details saved successfully!');
      setIsEditingHeader(false);
      
      // Reload lists and select the saved header
      const budgetsRes = await api.get('/budgets');
      setBudgets(budgetsRes.data);
      handleSelectBudget(data.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save budget header.');
    }
    setSaving(false);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        accountId: accounts[0]?.id || '',
        department: '',
        project: '',
        branch: '',
        allocatedAmount: '100000',
        alertThresholdPct: '90',
        controlLevel: 'BLOCK'
      }
    ]);
  };

  const removeLine = (idx) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLineField = (idx, field, val) => {
    const updated = [...lines];
    updated[idx][field] = val;
    setLines(updated);
  };

  const saveLines = async () => {
    if (!selectedBudgetId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/budgets/${selectedBudgetId}/lines`, { lines });
      setSuccess('Budget allocations and dimension rules updated successfully!');
      handleSelectBudget(selectedBudgetId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save budget lines.');
    }
    setSaving(false);
  };

  const handleCopyBudget = async () => {
    if (!selectedBudgetId) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/budgets/copy', {
        fromBudgetId: selectedBudgetId,
        newFiscalYear: copyYear,
        pctIncrease: parseFloat(pctIncrease || 0)
      });
      setSuccess(`Budget rolled forward to ${copyYear} successfully!`);
      setShowCopyModal(false);
      loadBudgets();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to copy budget.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sliders className="text-emerald-600" size={24} /> Budget Allocation Registry
          </h1>
          <p className="text-slate-500 text-sm font-semibold">Manage cost center spending allocations, multi-dimensional targets, and version controls.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <PlusCircle size={14} /> Create Budget
          </button>
          
          {selectedBudgetId && (
            <button 
              onClick={() => setShowCopyModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              <Copy size={14} /> Roll Forward
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
          {success}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
          {error}
        </div>
      )}

      {/* Main Split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left pane: selector and details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Budget Version Registers</h3>
            
            <div className="space-y-2">
              <select 
                value={selectedBudgetId}
                onChange={e => handleSelectBudget(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none"
              >
                <option value="" disabled>Choose Budget...</option>
                {budgets.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.fiscal_year} - {b.version_name})</option>
                ))}
              </select>
            </div>

            {selectedBudget && !isEditingHeader && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-600 space-y-2.5">
                <div className="flex justify-between"><span>Fiscal Year:</span><span className="font-bold text-slate-800">{selectedBudget.fiscal_year}</span></div>
                <div className="flex justify-between"><span>Version:</span><span className="font-bold text-slate-800">{selectedBudget.version_name}</span></div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    selectedBudget.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>{selectedBudget.status}</span>
                </div>
                <button 
                  onClick={() => setIsEditingHeader(true)}
                  className="w-full mt-2 py-2 border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 rounded-lg transition-all"
                >
                  Edit Header Details
                </button>
              </div>
            )}
          </div>

          {/* Header Form Editor */}
          {isEditingHeader && (
            <form onSubmit={saveHeader} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Edit size={13} /> Header Specifications</h3>
              
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Budget Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs font-bold focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fiscal Year</label>
                    <input 
                      type="text" 
                      value={fiscalYear}
                      onChange={e => setFiscalYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs font-bold focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Version</label>
                    <input 
                      type="text" 
                      value={versionName}
                      onChange={e => setVersionName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs font-bold focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Activation Status</label>
                  <select 
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none text-xs font-bold focus:border-emerald-500 bg-white"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active (Enforces Checks)</option>
                    <option value="CLOSED">Closed (Deactivated)</option>
                  </select>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsEditingHeader(false)}
                    className="w-1/2 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="w-1/2 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold shadow"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Right pane: Allocation lines builder */}
        <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800">Allocation Lines</h3>
              <p className="text-slate-400 text-xs mt-0.5">Edit allocation lines, classification dimensions, thresholds, and override limits.</p>
            </div>
            
            {selectedBudgetId && (
              <button 
                onClick={addLine}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-xs transition-all"
              >
                <PlusCircle size={14} /> Add Line
              </button>
            )}
          </div>

          {!selectedBudgetId ? (
            <div className="text-center py-20 text-slate-400 text-xs font-semibold border border-dashed border-slate-100 rounded-2xl">
              Choose or create a budget registers version from the left panel to configure allocations.
            </div>
          ) : (
            <div className="space-y-4">
              {lines.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-semibold border border-dashed border-slate-100 rounded-2xl">
                  No line allocations set. Tap "Add Line" to begin.
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {lines.map((line, idx) => (
                    <div key={idx} className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end text-xs font-semibold relative pr-10">
                      <button 
                        onClick={() => removeLine(idx)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>

                      {/* Account selection */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">GL Account</label>
                        <select 
                          value={line.accountId}
                          onChange={e => updateLineField(idx, 'accountId', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded bg-white font-bold"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Department */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Dept</label>
                        <select 
                          value={line.department}
                          onChange={e => updateLineField(idx, 'department', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded bg-white font-bold"
                        >
                          <option value="">None</option>
                          <option value="Marketing">Marketing</option>
                          <option value="HR">HR</option>
                          <option value="Sales">Sales</option>
                          <option value="Finance">Finance</option>
                          <option value="IT">IT</option>
                        </select>
                      </div>

                      {/* Branch */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Branch</label>
                        <select 
                          value={line.branch}
                          onChange={e => updateLineField(idx, 'branch', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded bg-white font-bold"
                        >
                          <option value="">None</option>
                          <option value="Karachi">Karachi</option>
                          <option value="Lahore">Lahore</option>
                          <option value="Islamabad">Islamabad</option>
                        </select>
                      </div>

                      {/* Amount */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Allocation (PKR)</label>
                        <input 
                          type="number" 
                          value={line.allocatedAmount}
                          onChange={e => updateLineField(idx, 'allocatedAmount', e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded text-right font-mono font-bold"
                        />
                      </div>

                      {/* Control Level */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Control Policy</label>
                        <select 
                          value={line.controlLevel}
                          onChange={e => updateLineField(idx, 'controlLevel', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded bg-white font-bold"
                        >
                          <option value="BLOCK">Block (Auto Workflow)</option>
                          <option value="WARN">Warn Only</option>
                          <option value="NONE">None</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  disabled={saving || lines.length === 0}
                  onClick={saveLines}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Allocations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Copy / Roll Forward Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-slate-800 text-[14px]">Copy & Roll Forward Budget</h3>
            <p className="text-xs text-slate-500 font-medium">Replicate current allocation lines to a new fiscal period with percentage adjustments.</p>
            
            <div className="space-y-3 text-xs font-semibold text-slate-600">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Year</label>
                <input 
                  type="text" 
                  value={copyYear}
                  onChange={e => setCopyYear(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none font-bold"
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Percentage Adjustment (+ / - %)</label>
                <input 
                  type="number" 
                  value={pctIncrease}
                  onChange={e => setPctIncrease(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setShowCopyModal(false)}
                className="w-1/2 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleCopyBudget}
                className="w-1/2 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-xs shadow-md"
              >
                Copy Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
