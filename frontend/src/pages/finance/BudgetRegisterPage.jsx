import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Layers, Plus, Trash2, ShieldCheck, UserCheck, RefreshCw, 
  HelpCircle, AlertCircle, Save, Calendar, CheckSquare, PlusCircle, 
  Copy, Edit, CheckCircle2, Sliders, PlayCircle, ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function BudgetRegisterPage() {
  const navigate = useNavigate();
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

  // Budget Revisions, Transfers & Monthly allocations State (Phase 16A)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromLineId, setTransferFromLineId] = useState('');
  const [transferToLineId, setTransferToLineId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const [activeMonthlyLine, setActiveMonthlyLine] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);

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
        id: l.id,
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

  const handleCreateRevision = async () => {
    if (!selectedBudgetId) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`/budgets/${selectedBudgetId}/revision`);
      setSuccess(`New budget revision created successfully: ${data.version_name}`);
      loadBudgets();
      handleSelectBudget(data.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create budget revision.');
    }
    setSaving(false);
  };

  const handleSubmitApproval = async () => {
    if (!selectedBudgetId) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`/budgets/${selectedBudgetId}/submit-approval`);
      setSuccess('Budget plan submitted for workflow approval.');
      loadBudgets();
      handleSelectBudget(selectedBudgetId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit budget for approval.');
    }
    setSaving(false);
  };

  const handleTransferBudget = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/budgets/transfers', {
        fromLineId: transferFromLineId,
        toLineId: transferToLineId,
        amount: parseFloat(transferAmount),
        reason: transferReason
      });
      setSuccess('Budget transfer posted successfully.');
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferReason('');
      handleSelectBudget(selectedBudgetId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to execute budget transfer.');
    }
    setSaving(false);
  };

  const openMonthlyModal = async (line, idx) => {
    if (!line.id && selectedBudgetId) {
      alert("Please save the budget lines first before setting monthly distributions.");
      return;
    }
    setActiveMonthlyLine({ line, idx });
    try {
      const { data } = await api.get(`/budgets/lines/${line.id}/monthly`);
      setMonthlyAllocations(data);
    } catch (err) {
      console.error(err);
      const total = parseFloat(line.allocatedAmount || 0);
      const equalSplit = (total / 12).toFixed(2);
      const defaults = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        allocated_amount: equalSplit,
        actual_amount: 0,
        committed_amount: 0,
        remaining_amount: equalSplit
      }));
      setMonthlyAllocations(defaults);
    }
  };

  const saveMonthlyAllocations = async () => {
    if (!activeMonthlyLine) return;
    try {
      await api.post(`/budgets/lines/${activeMonthlyLine.line.id}/monthly`, {
        allocations: monthlyAllocations
      });
      const total = monthlyAllocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount || 0), 0);
      updateLineField(activeMonthlyLine.idx, 'allocatedAmount', total.toString());
      setActiveMonthlyLine(null);
      setSuccess("Monthly allocations updated successfully.");
    } catch (err) {
      setError("Failed to save monthly allocations.");
    }
  };

  const isReadOnly = selectedBudget?.status === 'ACTIVE' || selectedBudget?.status === 'SUBMITTED';

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
            <Sliders size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-indigo-950 tracking-tight uppercase">Budget Registry</h1>
              <span className="text-[10px] font-extrabold uppercase bg-indigo-500/15 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-500/20">Allocation Rules</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center mt-0.5">
              Manage cost center spending allocations, multi-dimensional targets, and version controls.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
          <button 
            onClick={() => navigate('/dashboard/finance/budgets/dashboard')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            <BarChart2 size={13} /> Dashboard
          </button>

          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer shadow-emerald-500/10"
          >
            <PlusCircle size={13} /> Create Draft
          </button>
          
          {selectedBudget && selectedBudget.status === 'DRAFT' && (
            <button 
              onClick={handleSubmitApproval}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer shadow-blue-500/10"
            >
              <CheckSquare size={13} /> Submit Approval
            </button>
          )}

          {selectedBudget && selectedBudget.status === 'ACTIVE' && (
            <>
              <button 
                onClick={handleCreateRevision}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer shadow-purple-500/10"
              >
                <RefreshCw size={13} /> Create Revision
              </button>
              
              <button 
                onClick={() => {
                  setTransferFromLineId(lines[0]?.id || '');
                  setTransferToLineId(lines[1]?.id || '');
                  setShowTransferModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer shadow-amber-500/10"
              >
                <Sliders size={13} /> Transfer Funds
              </button>
            </>
          )}

          {selectedBudgetId && (
            <button 
              onClick={() => setShowCopyModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Copy size={13} /> Roll Forward
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
                      {!isReadOnly && (
                        <button 
                          onClick={() => removeLine(idx)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}

                      {/* Account selection */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">GL Account</label>
                        <select 
                          value={line.accountId}
                          disabled={isReadOnly}
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
                          disabled={isReadOnly}
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
                          disabled={isReadOnly}
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
                        <div className="flex gap-1.5 items-center">
                          <input 
                            type="number" 
                            disabled={isReadOnly}
                            value={line.allocatedAmount}
                            onChange={e => updateLineField(idx, 'allocatedAmount', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded text-right font-mono font-bold"
                          />
                          {line.id && (
                            <button
                              type="button"
                              onClick={() => openMonthlyModal(line, idx)}
                              className="p-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded transition-all cursor-pointer shrink-0"
                              title="Configure Monthly Distribution Grid"
                            >
                              <Calendar size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Control Level */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Control Policy</label>
                        <select 
                          value={line.controlLevel}
                          disabled={isReadOnly}
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
                  disabled={saving || lines.length === 0 || isReadOnly}
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

      {/* Monthly Distribution Spreadsheet Grid Modal (Phase 16A) */}
      {activeMonthlyLine && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 max-w-2xl w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-[14px]">Monthly Budget Spreadsheet</h3>
                <p className="text-slate-400 text-[10px] font-semibold">
                  Configure allocation overrides for account <span className="text-indigo-600">
                    {accounts.find(a => a.id === activeMonthlyLine.line.accountId)?.code}
                  </span>
                </p>
              </div>
              <button 
                onClick={() => setActiveMonthlyLine(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-x-auto max-h-[350px] border border-slate-150 rounded-xl">
              <table className="w-full text-xs font-semibold text-slate-700 text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    <th className="px-4 py-2">Month</th>
                    <th className="px-4 py-2 text-right">Budget Limit</th>
                    <th className="px-4 py-2 text-right">Actual Spent</th>
                    <th className="px-4 py-2 text-right">Committed</th>
                    <th className="px-4 py-2 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyAllocations.map((item, i) => {
                    const monthNames = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    return (
                      <tr key={i} className="hover:bg-slate-50/40 font-mono">
                        <td className="px-4 py-2 font-sans text-slate-800 font-bold">{monthNames[item.month - 1]}</td>
                        <td className="px-4 py-2 text-right">
                          <input 
                            type="number"
                            disabled={isReadOnly}
                            value={item.allocated_amount}
                            onChange={(e) => {
                              const updated = [...monthlyAllocations];
                              updated[i].allocated_amount = e.target.value;
                              updated[i].remaining_amount = parseFloat(e.target.value || 0) - (parseFloat(item.actual_amount || 0) + parseFloat(item.committed_amount || 0));
                              setMonthlyAllocations(updated);
                            }}
                            className="w-24 p-1 border border-slate-200 rounded text-right font-bold"
                          />
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500">PKR {parseFloat(item.actual_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-indigo-600">PKR {parseFloat(item.committed_amount || 0).toLocaleString()}</td>
                        <td className={`px-4 py-2 text-right font-bold ${item.remaining_amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          PKR {parseFloat(item.remaining_amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] font-bold text-slate-400">
                Sum of Allocations: <span className="font-mono text-slate-700 font-extrabold text-xs">
                  PKR {monthlyAllocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount || 0), 0).toLocaleString()}
                </span>
              </span>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setActiveMonthlyLine(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={isReadOnly}
                  onClick={saveMonthlyAllocations}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Save Split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Funds Transfer Modal (Phase 16A) */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleTransferBudget} className="bg-white p-6 rounded-3xl border border-slate-100 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-slate-800 text-[14px]">Inter-Departmental Budget Transfer</h3>
            <p className="text-xs text-slate-400 font-semibold">Move allocations between cost center registry items while preserving audit limits.</p>

            <div className="space-y-3.5 text-xs font-semibold text-slate-600">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Source Account (Transfer Out)</label>
                <select 
                  value={transferFromLineId}
                  onChange={e => setTransferFromLineId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold"
                >
                  {lines.map(l => {
                    const acc = accounts.find(a => a.id === l.accountId);
                    return <option key={l.id} value={l.id}>{acc?.code} - {acc?.name} ({l.department || 'No Dept'})</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Account (Transfer In)</label>
                <select 
                  value={transferToLineId}
                  onChange={e => setTransferToLineId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold"
                >
                  {lines.map(l => {
                    const acc = accounts.find(a => a.id === l.accountId);
                    return <option key={l.id} value={l.id}>{acc?.code} - {acc?.name} ({l.department || 'No Dept'})</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Transfer Amount (PKR)</label>
                <input 
                  type="number"
                  required
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
                  placeholder="e.g. 50000"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason / Justification</label>
                <textarea 
                  required
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-semibold"
                  placeholder="Enter adjustment reason..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setShowTransferModal(false)}
                className="w-1/2 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={saving}
                className="w-1/2 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-xs shadow-md"
              >
                {saving ? 'Processing...' : 'Post Transfer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
