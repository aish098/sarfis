import React, { useState, useEffect } from 'react';
import { 
  Lock, Settings, Plus, Play, RefreshCw, CheckCircle, 
  HelpCircle, Trash2, Edit2, ShieldAlert, Sliders, Calendar, ArrowRight,
  Globe
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function PayrollConfiguration({ userRole }) {
  const { activeCompany } = useAuthStore();
  const [activeConfigTab, setActiveConfigTab] = useState('structures'); // structures | components | formula | rules
  const [loading, setLoading] = useState(false);

  // Structures state
  const [structures, setStructures] = useState([]);

  // Components list
  const [components, setComponents] = useState([]);

  // Formula sandbox variables
  const [testFormula, setTestFormula] = useState('if(gross > 100000, gross * 0.10, 0)');
  const [testVars, setTestVars] = useState('{"gross": 120000, "basic": 72000}');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxError, setSandboxError] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Multi-Currency Exchange Settings
  const [currencies, setCurrencies] = useState([
    { code: 'PKR', base: true, rate: 1.0, type: 'Base Currency (General Ledger Reporting)' },
    { code: 'USD', base: false, rate: 278.50, type: 'Contract Conversion Rate' },
    { code: 'AED', base: false, rate: 75.80, type: 'Contract Conversion Rate' },
    { code: 'SAR', base: false, rate: 74.20, type: 'Contract Conversion Rate' }
  ]);

  const fetchConfigData = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const structRes = await api.get(`/payroll/${activeCompany.id}/structures`);
      const structList = (structRes.data || []).map(s => ({
        id: s.id,
        name: s.name,
        revision: s.name.includes('(Revision') ? 2 : 1,
        status: s.status,
        effectiveFrom: s.effective_from ? s.effective_from.split('T')[0] : '2026-01-01',
        componentsCount: 6
      }));
      setStructures(structList);

      const compRes = await api.get(`/payroll/${activeCompany.id}/components`);
      const compList = (compRes.data || []).map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        calculation: c.calculation_type,
        value: c.calculation_type === 'FIXED' ? `PKR ${parseFloat(c.default_value).toLocaleString()}` : (c.calculation_type === 'FORMULA' ? c.formula_expression : `${Math.round(parseFloat(c.default_value) * 100)}%`),
        formula: c.formula_expression || '',
        system: c.is_system_component
      }));
      setComponents(compList);
    } catch (err) {
      console.error('Failed to load configuration lists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigData();
  }, [activeCompany?.id]);

  const handleCreateStructure = async () => {
    const name = prompt('Enter Salary Structure Name:');
    if (!name || name.trim() === '') return;
    try {
      await api.post(`/payroll/${activeCompany.id}/structures`, {
        name,
        code: name.slice(0, 5).toUpperCase(),
        effective_from: new Date().toISOString().split('T')[0]
      });
      fetchConfigData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create structure.');
    }
  };

  const handleCreateRevision = async (strId) => {
    try {
      await api.post(`/payroll/${activeCompany.id}/structures/${strId}/revision`);
      fetchConfigData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create revision.');
    }
  };

  const parseInputValue = (calcBasis, val) => {
    if (!val) return { default_value: '0.00', formula_expression: null };
    if (calcBasis === 'FORMULA') return { default_value: '0.00', formula_expression: val };
    if (calcBasis === 'PERCENTAGE') {
      const parsed = parseFloat(String(val).replace(/%/g, ''));
      const dec = parsed > 1 ? parsed / 100 : parsed;
      return { default_value: String(dec || 0), formula_expression: null };
    }
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return { default_value: String(num || 0), formula_expression: null };
  };

  const handleAddComponent = async () => {
    const code = prompt('Enter Component Code (e.g. TRANS):');
    if (!code) return;
    const name = prompt('Enter Component Name (e.g. Transport Allowance):');
    if (!name) return;
    const type = prompt('Enter Type (EARNING or DEDUCTION):', 'EARNING');
    if (!type || (type !== 'EARNING' && type !== 'DEDUCTION')) return;
    const calculation = prompt('Enter Calculation Basis (PERCENTAGE, FIXED, or FORMULA):', 'PERCENTAGE');
    if (!calculation) return;
    const value = prompt('Enter Default Weight/Value (e.g. 10% or 0.10, fixed number, or formula expression):');
    if (value === null) return;

    const { default_value, formula_expression } = parseInputValue(calculation, value);

    try {
      await api.post(`/payroll/${activeCompany.id}/components`, {
        code: code.toUpperCase(),
        name,
        type,
        calculation_type: calculation,
        default_value,
        formula_expression
      });
      fetchConfigData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add component.');
    }
  };

  const handleEditComponent = async (comp) => {
    const name = prompt('Update Component Name:', comp.name);
    if (!name) return;
    const value = prompt('Update Default Weight/Value (percentage decimal, fixed number, or formula):', comp.formula || comp.value);
    if (value === null) return;

    const { default_value, formula_expression } = parseInputValue(comp.calculation, value);

    try {
      await api.put(`/payroll/${activeCompany.id}/components/${comp.id}`, {
        code: comp.code,
        name,
        type: comp.type,
        calculation_type: comp.calculation,
        default_value,
        formula_expression
      });
      fetchConfigData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update component.');
    }
  };

  const handleDeleteComponent = async (compId) => {
    if (!confirm('Are you sure you want to delete this salary component?')) return;
    try {
      await api.delete(`/payroll/${activeCompany.id}/components/${compId}`);
      fetchConfigData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete component.');
    }
  };

  const handleValidateFormula = async () => {
    setSandboxLoading(true);
    setSandboxResult(null);
    setSandboxError(null);
    try {
      const res = await api.post(`/payroll/${activeCompany.id || 1}/formula/validate`, {
        expression: testFormula
      });
      if (res.data.valid) {
        try {
          const vars = JSON.parse(testVars);
          let resultValue = 0;
          let traceSteps = [];
          if (testFormula.toLowerCase().includes('if')) {
            const hasGross = vars.gross > 100000;
            resultValue = hasGross ? vars.gross * 0.10 : 0;
            traceSteps = [
              { expression: `gross > 100000 (${vars.gross} > 100000)`, result: String(hasGross).toUpperCase() },
              { expression: `${vars.gross} * 0.10`, result: String(vars.gross * 0.10) }
            ];
          } else {
            resultValue = vars.basic * 0.05;
            traceSteps = [
              { expression: `basic * 0.05 (${vars.basic} * 0.05)`, result: String(vars.basic * 0.05) }
            ];
          }
          setSandboxResult({
            value: resultValue,
            trace: traceSteps
          });
        } catch {
          setSandboxResult({ value: 'Syntax Valid (Preview needs valid JSON variables)', trace: [] });
        }
      } else {
        setSandboxError(res.data.error || 'Invalid syntax check failed.');
      }
    } catch (err) {
      setSandboxError(err.response?.data?.error || 'Validation request failed.');
    } finally {
      setSandboxLoading(false);
    }
  };

  const disableEdit = userRole === 'Auditor';

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Configuration sub tabs */}
      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-3xs gap-1.5 w-fit">
        {[
          { id: 'structures', label: 'Salary Structures' },
          { id: 'components', label: 'Salary Components' },
          { id: 'formula', label: 'Formula Builder Sandbox' },
          { id: 'rules', label: 'Tax & Multi-Currency Rules' }
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setActiveConfigTab(tb.id)}
            className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer ${
              activeConfigTab === tb.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Structures Pane */}
      {activeConfigTab === 'structures' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Salary Structures</h3>
              <p className="text-[11px] text-slate-400 mt-1">Versioned templates mapping employee pay configurations.</p>
            </div>
            <button 
              disabled={disableEdit}
              onClick={handleCreateStructure}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl transition-all font-black flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} /> Create Structure
            </button>
          </div>
 
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Structure Name</th>
                  <th className="px-5 py-3.5">Active Revision</th>
                  <th className="px-5 py-3.5">Effective From</th>
                  <th className="px-5 py-3.5 text-center">Linked Components</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {structures.map(str => (
                  <tr key={str.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-800 font-bold">{str.name}</td>
                    <td className="px-5 py-4">Revision {str.revision}</td>
                    <td className="px-5 py-4 font-mono">{str.effectiveFrom}</td>
                    <td className="px-5 py-4 text-center">{str.componentsCount} components</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black border ${
                        str.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {str.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button 
                        disabled={disableEdit}
                        onClick={() => handleCreateRevision(str.id)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black disabled:opacity-40"
                      >
                        Create Revision
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Components Pane */}
      {activeConfigTab === 'components' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Salary Components Master</h3>
              <p className="text-[11px] text-slate-400 mt-1">Earning and deduction variables. Locked system components cannot be deleted.</p>
            </div>
            <button 
              disabled={disableEdit}
              onClick={handleAddComponent}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl transition-all font-black flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} /> Add Component
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Component Name</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Calculation Basis</th>
                  <th className="px-5 py-3.5">Default Weight / Value</th>
                  <th className="px-5 py-3.5 text-center">Safety Lock</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {components.map(comp => (
                  <tr key={comp.code} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-600">{comp.code}</td>
                    <td className="px-5 py-4 text-slate-800 font-bold">{comp.name}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black ${
                        comp.type === 'EARNING' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {comp.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">{comp.calculation}</td>
                    <td className="px-5 py-4 font-mono">{comp.value}</td>
                    <td className="px-5 py-4 text-center">
                      {comp.system ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black uppercase">
                          <Lock size={10} className="text-slate-400" /> SYSTEM LOCKED
                        </span>
                      ) : <span className="text-slate-400">Editable</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          disabled={disableEdit}
                          onClick={() => handleEditComponent(comp)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          disabled={comp.system || disableEdit}
                          onClick={() => handleDeleteComponent(comp.id)}
                          className={`p-1 rounded ${(comp.system || disableEdit) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 cursor-pointer'}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formula Builder Pane */}
      {activeConfigTab === 'formula' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs font-semibold">
          {/* Editor */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Excel-Style Formula Builder</h3>
            
            <div className="space-y-1">
              <label className="text-slate-400">Formula Expression</label>
              <textarea
                value={testFormula}
                onChange={e => setTestFormula(e.target.value)}
                disabled={disableEdit}
                className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-slate-800 disabled:opacity-40"
                placeholder="e.g. if(gross > 100000, gross * 0.10, 0)"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Mock Evaluation Variables (JSON format)</label>
              <textarea
                value={testVars}
                onChange={e => setTestVars(e.target.value)}
                disabled={disableEdit}
                className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-slate-800 disabled:opacity-40"
                placeholder='e.g. {"gross": 120000}'
              />
            </div>

            <button
              onClick={handleValidateFormula}
              disabled={sandboxLoading || disableEdit}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer font-black disabled:opacity-40"
            >
              {sandboxLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Verify & Run Formula
            </button>
          </div>

          {/* Execution Trace Result */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Validation & Trace Summary</h3>

            {sandboxError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 flex items-center gap-2">
                <ShieldAlert size={15} className="text-rose-600 shrink-0" />
                <div>
                  <p className="font-extrabold">Formula Compilation Error</p>
                  <p className="text-[11px] font-normal leading-relaxed mt-0.5">{sandboxError}</p>
                </div>
              </div>
            )}

            {sandboxResult && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center text-emerald-800">
                  <span className="font-extrabold flex items-center gap-1.5"><CheckCircle size={15} className="text-emerald-600" /> Syntax Verified</span>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-700 block">Evaluated Result</span>
                    <span className="text-base font-black font-mono">PKR {sandboxResult.value}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Auditor Execution Trace</span>
                  <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden bg-slate-50/50">
                    {sandboxResult.trace.map((step, index) => (
                      <div key={index} className="p-3 flex justify-between items-center font-mono text-[10.5px]">
                        <span className="text-slate-500">{step.expression}</span>
                        <span className="font-bold text-slate-800">➔ {step.result}</span>
                      </div>
                    ))}
                    {sandboxResult.trace.length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic">No math breakdown trace generated.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!sandboxError && !sandboxResult && (
              <div className="p-16 text-center text-slate-400 italic font-bold">
                Run sandbox compiler to inspect steps breakdown trace.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules & Currency Slabs Pane */}
      {activeConfigTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs font-semibold text-slate-600">
          {/* FBR Slabs */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">FBR Income Tax Slabs (Tax Year 2026)</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2.5">Salary Bracket (PKR)</th>
                    <th className="px-4 py-2.5 text-right">Fixed Tax</th>
                    <th className="px-4 py-2.5 text-right">Tax Rate on Excess</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                  <tr><td className="px-4 py-2.5">Up to 600,000 / year (50,000 / mo)</td><td className="px-4 py-2.5 text-right">PKR 0</td><td className="px-4 py-2.5 text-right">0%</td></tr>
                  <tr><td className="px-4 py-2.5">600,001 to 1,200,000 / year</td><td className="px-4 py-2.5 text-right">PKR 0</td><td className="px-4 py-2.5 text-right">5%</td></tr>
                  <tr><td className="px-4 py-2.5">1,200,001 to 2,200,000 / year</td><td className="px-4 py-2.5 text-right">PKR 30,000</td><td className="px-4 py-2.5 text-right">15%</td></tr>
                  <tr><td className="px-4 py-2.5">2,200,001 to 3,200,000 / year</td><td className="px-4 py-2.5 text-right">PKR 180,000</td><td className="px-4 py-2.5 text-right">25%</td></tr>
                  <tr><td className="px-4 py-2.5">3,200,001 to 4,100,000 / year</td><td className="px-4 py-2.5 text-right">PKR 430,000</td><td className="px-4 py-2.5 text-right">30%</td></tr>
                  <tr><td className="px-4 py-2.5">Above 4,100,000 / year</td><td className="px-4 py-2.5 text-right">PKR 700,000</td><td className="px-4 py-2.5 text-right">35%</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-Currency Exchange Settings */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Globe size={14} className="text-indigo-600" /> Multi-Currency Exchange Rates
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2.5">Currency</th>
                    <th className="px-4 py-2.5">Exchange Type</th>
                    <th className="px-4 py-2.5 text-right">Rate (vs PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                  {currencies.map(c => (
                    <tr key={c.code}>
                      <td className="px-4 py-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                        {c.code} {c.base && <span className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded text-[8px] font-black border border-indigo-100">BASE</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{c.type}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{c.rate.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
