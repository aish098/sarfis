import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, Layers, Plus, Trash2, ShieldCheck, UserCheck, RefreshCw, 
  HelpCircle, AlertCircle, Save, Calendar, CheckSquare, PlusCircle
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function WorkflowConfigPage() {
  const { activeCompany } = useAuthStore();

  const [activeTab, setActiveTab] = useState('workflows'); // 'workflows' | 'delegations'
  const [docTypes, setDocTypes] = useState([
    { code: 'VOUCHER', name: 'ERP Voucher Approvals' },
    { code: 'JOURNAL', name: 'Manual Journal Approvals' }
  ]);
  const [selectedDocCode, setSelectedDocCode] = useState('VOUCHER');
  const [definitions, setDefinitions] = useState([]);
  
  // Stages list for selected doc
  const [name, setName] = useState('Voucher Workflow Definition');
  const [stages, setStages] = useState([]);

  // Delegations list and form
  const [delegations, setDelegations] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [toUserId, setToUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (activeCompany) {
      loadDefinitions();
      loadDelegations();
      loadCompanyUsers();
    }
  }, [activeCompany]);

  const loadDefinitions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/workflows/definitions');
      setDefinitions(data);
      
      // Seed values for VOUCHER as default selected
      const voucherDef = data.find(d => d.document_type_code === selectedDocCode);
      if (voucherDef) {
        setName(voucherDef.name);
        setStages(voucherDef.stages.map(s => ({
          name: s.name,
          requiredRole: s.required_role || '',
          requiredPermission: s.required_permission || '',
          conditions: s.conditions || [],
          timeoutHours: s.timeout_hours || 24,
          escalateRole: s.escalate_role || '',
          approvalMode: s.approval_mode || 'SEQUENTIAL'
        })));
      } else {
        setName(`${selectedDocCode} Default Workflow`);
        setStages([]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadDelegations = async () => {
    try {
      const { data } = await api.get('/workflows/delegations');
      setDelegations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCompanyUsers = async () => {
    try {
      const { data } = await api.get(`/admin/companies/${activeCompany.id}/sessions`);
      // Fallback fallback sessions usually lists users, let's fetch members!
      const res = await api.get(`/admin/companies/${activeCompany.id}/sessions`).catch(() => ({ data: [] }));
      // We can also fetch via members:
      const membersRes = await api.get(`/admin/companies/${activeCompany.id}/members`).catch(() => ({ data: [] }));
      setCompanyUsers(membersRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDocTypeChange = (code) => {
    setSelectedDocCode(code);
    const def = definitions.find(d => d.document_type_code === code);
    if (def) {
      setName(def.name);
      setStages(def.stages.map(s => ({
        name: s.name,
        requiredRole: s.required_role || '',
        requiredPermission: s.required_permission || '',
        conditions: s.conditions || [],
        timeoutHours: s.timeout_hours || 24,
        escalateRole: s.escalate_role || '',
        approvalMode: s.approval_mode || 'SEQUENTIAL'
      })));
    } else {
      setName(`${code} Approval Workflow`);
      setStages([]);
    }
  };

  const addStage = () => {
    setStages([...stages, {
      name: 'New Approval Stage',
      requiredRole: '',
      requiredPermission: '',
      conditions: [],
      timeoutHours: 24,
      escalateRole: '',
      approvalMode: 'SEQUENTIAL'
    }]);
  };

  const removeStage = (idx) => {
    setStages(stages.filter((_, i) => i !== idx));
  };

  const updateStageField = (idx, field, val) => {
    const updated = [...stages];
    updated[idx][field] = val;
    setStages(updated);
  };

  const addCondition = (stageIdx) => {
    const updated = [...stages];
    updated[stageIdx].conditions = [
      ...(updated[stageIdx].conditions || []),
      { field: 'amount', operator: '>=', value: '100000' }
    ];
    setStages(updated);
  };

  const updateCondition = (stageIdx, condIdx, field, val) => {
    const updated = [...stages];
    updated[stageIdx].conditions[condIdx][field] = val;
    setStages(updated);
  };

  const removeCondition = (stageIdx, condIdx) => {
    const updated = [...stages];
    updated[stageIdx].conditions = updated[stageIdx].conditions.filter((_, i) => i !== condIdx);
    setStages(updated);
  };

  const saveWorkflow = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Ensure workflow document types are pre-seeded in the database
      // Since migrations run automatically, we can assume seeding is done or we run it.
      await api.post('/workflows/definitions', {
        documentTypeCode: selectedDocCode,
        name,
        stages
      });
      setSuccess('Workflow definition and stages saved successfully!');
      loadDefinitions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save workflow definition.');
    }
    setSaving(false);
  };

  const handleCreateDelegation = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!toUserId || !startDate || !endDate) {
      setError('Please fill in all delegation fields.');
      return;
    }
    try {
      await api.post('/workflows/delegations', {
        toUserId: parseInt(toUserId),
        startDate,
        endDate
      });
      setSuccess('User delegation created successfully.');
      setToUserId('');
      setStartDate('');
      setEndDate('');
      loadDelegations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delegate approvals.');
    }
  };

  const handleCancelDelegation = async (id) => {
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/workflows/delegations/${id}/cancel`);
      setSuccess('Delegation cancelled successfully.');
      loadDelegations();
    } catch (err) {
      setError('Failed to cancel delegation.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Settings size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Workflow Configurations</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">System Gates</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              Define role hierarchies, approval thresholds, conditions, and manager delegations.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button 
          onClick={() => setActiveTab('workflows')}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'workflows' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Workflow Definitions
        </button>
        <button 
          onClick={() => setActiveTab('delegations')}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'delegations' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          User Delegations
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-bold animate-pulse">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
          {success}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* WORKFLOWS TAB */}
        {activeTab === 'workflows' && (
          <motion.div key="workflows" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sidebar select */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Document Selection</h3>
              
              <div className="space-y-2">
                {docTypes.map(doc => (
                  <div 
                    key={doc.code}
                    onClick={() => handleDocTypeChange(doc.code)}
                    className={`p-4 rounded-2xl text-xs transition-all border cursor-pointer ${
                      selectedDocCode === doc.code 
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 font-extrabold shadow-sm' 
                        : 'border-slate-100 hover:bg-slate-50 text-slate-600 font-bold'
                    }`}
                  >
                    <p>{doc.name}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">Code: {doc.code}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stages setup */}
            <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-800">Workflow Approval Stages</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Setup approval sequence steps for {selectedDocCode}.</p>
                </div>
                
                <button 
                  onClick={addStage}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-xs transition-all"
                >
                  <PlusCircle size={14} /> Add Stage
                </button>
              </div>

              {/* Workflow Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Workflow Title Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </div>

              {/* Stages List */}
              {stages.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs font-semibold">
                  No approval stages defined. Vouchers/Journals will be auto-approved upon creation.
                </div>
              ) : (
                <div className="space-y-4">
                  {stages.map((stage, idx) => (
                    <div key={idx} className="p-5 border border-slate-100 bg-slate-50/50 rounded-2xl space-y-4 text-xs font-semibold text-slate-700 relative">
                      <button 
                        onClick={() => removeStage(idx)}
                        className="absolute right-4 top-4 text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono text-[10px] font-bold">{idx + 1}</span>
                        <h4 className="font-black text-slate-800 text-[13px]">Stage Step Configuration</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Stage Name</label>
                          <input 
                            type="text"
                            value={stage.name}
                            onChange={e => updateStageField(idx, 'name', e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 outline-none text-xs font-bold focus:border-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Required Role Gate</label>
                          <select 
                            value={stage.requiredRole}
                            onChange={e => updateStageField(idx, 'requiredRole', e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 outline-none text-xs font-bold focus:border-emerald-500"
                          >
                            <option value="">Any Role (Requires Permission)</option>
                            <option value="Manager">Manager</option>
                            <option value="Controller">Controller</option>
                            <option value="Finance Manager">Finance Manager</option>
                            <option value="CFO">CFO</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Required Permission Gate</label>
                          <select 
                            value={stage.requiredPermission}
                            onChange={e => updateStageField(idx, 'requiredPermission', e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 outline-none text-xs font-bold focus:border-emerald-500"
                          >
                            <option value="">None (Role Only)</option>
                            <option value="voucher.post">voucher.post (Voucher Approval)</option>
                            <option value="journal.post">journal.post (Journal Approval)</option>
                            <option value="risk.approve">risk.approve (Risk Override)</option>
                            <option value="period.manage">period.manage (Finance Admin)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Approval SLA Timeout (Hours)</label>
                          <input 
                            type="number"
                            value={stage.timeoutHours}
                            onChange={e => updateStageField(idx, 'timeoutHours', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 outline-none text-xs font-bold focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Conditions list */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Activation Rules / Conditions</span>
                          <button 
                            onClick={() => addCondition(idx)}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-0.5 font-bold"
                          >
                            + Add Condition
                          </button>
                        </div>

                        {stage.conditions?.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No conditions. Stage always runs.</p>
                        ) : (
                          <div className="space-y-2">
                            {stage.conditions?.map((cond, cIdx) => (
                              <div key={cIdx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                                <select 
                                  value={cond.field}
                                  onChange={e => updateCondition(idx, cIdx, 'field', e.target.value)}
                                  className="px-2 py-1 border border-slate-200 rounded outline-none text-xs"
                                >
                                  <option value="amount">Transaction Amount</option>
                                </select>
                                <select 
                                  value={cond.operator}
                                  onChange={e => updateCondition(idx, cIdx, 'operator', e.target.value)}
                                  className="px-2 py-1 border border-slate-200 rounded outline-none text-xs"
                                >
                                  <option value=">=">&gt;=</option>
                                  <option value=">">&gt;</option>
                                  <option value="<=">&lt;=</option>
                                  <option value="=">=</option>
                                </select>
                                <input 
                                  type="number"
                                  value={cond.value}
                                  onChange={e => updateCondition(idx, cIdx, 'value', e.target.value)}
                                  className="px-2 py-0.5 w-24 border border-slate-200 rounded outline-none text-xs font-mono font-bold"
                                />
                                <button 
                                  onClick={() => removeCondition(idx, cIdx)}
                                  className="text-rose-500 hover:text-rose-700 ml-auto transition-all"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Save button */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  disabled={saving}
                  onClick={saveWorkflow}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save Configuration
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* DELEGATIONS TAB */}
        {activeTab === 'delegations' && (
          <motion.div key="delegations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create delegation form */}
            <form onSubmit={handleCreateDelegation} className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Calendar size={13} /> Delegate Approvals</h3>
              
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Delegate User</label>
                  <select 
                    value={toUserId} 
                    onChange={e => setToUserId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="">Choose User...</option>
                    {companyUsers.map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">End Date</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Create Delegation
                </button>
              </div>
            </form>

            {/* Delegations List */}
            <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-800">Active delegations</h3>
              
              {delegations.length === 0 ? (
                <p className="text-slate-400 text-xs italic py-6">No user delegations configured.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <table className="w-full text-xs font-semibold text-slate-700">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="px-5 py-3 text-left">From User</th>
                        <th className="px-5 py-3 text-left">To Delegate</th>
                        <th className="px-5 py-3 text-left">Period</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delegations.map(d => (
                        <tr key={d.id} className="border-b border-slate-50">
                          <td className="px-5 py-3 text-slate-800 font-bold">{d.from_user_name}</td>
                          <td className="px-5 py-3 text-emerald-600 font-bold">{d.to_user_name}</td>
                          <td className="px-5 py-3 font-mono font-bold text-[11px]">
                            {new Date(d.start_date).toLocaleDateString()} to {new Date(d.end_date).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              d.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                            }`}>{d.is_active ? 'Active' : 'Cancelled'}</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {d.is_active && (
                              <button 
                                onClick={() => handleCancelDelegation(d.id)}
                                className="text-rose-600 hover:text-rose-800 hover:underline font-bold text-[11px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
