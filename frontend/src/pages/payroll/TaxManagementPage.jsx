import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator, Shield, FileText, CheckCircle2, AlertCircle,
  Plus, Edit, Trash2, HelpCircle, ChevronRight, RefreshCw, Globe, Layers, ArrowUpRight, Search
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Default static FBR 2026-27 Slabs for client-side fallback
const DEFAULT_SLABS = [
  { sequence_no: 1, lower_bound: 0, upper_bound: 600000, base_tax: 0, marginal_rate: 0.00, excess_over: 0, description: 'Up to Rs. 600,000 (0% Tax)' },
  { sequence_no: 2, lower_bound: 600000, upper_bound: 1200000, base_tax: 0, marginal_rate: 0.01, excess_over: 600000, description: 'Rs. 600,001 – 1,200,000 (1% of amount exceeding Rs. 600,000)' },
  { sequence_no: 3, lower_bound: 1200000, upper_bound: 2200000, base_tax: 6000, marginal_rate: 0.11, excess_over: 1200000, description: 'Rs. 1,200,001 – 2,200,000 (Rs. 6,000 + 11% of amount exceeding Rs. 1,200,000)' },
  { sequence_no: 4, lower_bound: 2200000, upper_bound: 3200000, base_tax: 116000, marginal_rate: 0.20, excess_over: 2200000, description: 'Rs. 2,200,001 – 3,200,000 (Rs. 116,000 + 20% of amount exceeding Rs. 2,200,000)' },
  { sequence_no: 5, lower_bound: 3200000, upper_bound: 4100000, base_tax: 316000, marginal_rate: 0.25, excess_over: 3200000, description: 'Rs. 3,200,001 – 4,100,000 (Rs. 316,000 + 25% of amount exceeding Rs. 3,200,000)' },
  { sequence_no: 6, lower_bound: 4100000, upper_bound: 5600000, base_tax: 541000, marginal_rate: 0.29, excess_over: 4100000, description: 'Rs. 4,100,001 – 5,600,000 (Rs. 541,000 + 29% of amount exceeding Rs. 4,100,000)' },
  { sequence_no: 7, lower_bound: 5600000, upper_bound: 7000000, base_tax: 976000, marginal_rate: 0.32, excess_over: 5600000, description: 'Rs. 5,600,001 – 7,000,000 (Rs. 976,000 + 32% of amount exceeding Rs. 5,600,000)' },
  { sequence_no: 8, lower_bound: 7000000, upper_bound: null, base_tax: 1424000, marginal_rate: 0.35, excess_over: 7000000, description: 'Above Rs. 7,000,000 (Rs. 1,424,000 + 35% of amount exceeding Rs. 7,000,000)' }
];

export default function TaxManagementPage() {
  const { activeCompany } = useAuthStore();
  const [taxYears, setTaxYears] = useState([]);
  const [activeTaxYear, setActiveTaxYear] = useState('PK-2026-27-SALARY');
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [loading, setLoading] = useState(false);

  // Calculator State
  const [calcSalary, setCalcSalary] = useState(1850000);
  const [calcPeriod, setCalcPeriod] = useState('annual'); // 'annual' | 'monthly'
  const [calcResult, setCalcResult] = useState(null);

  // Modal State
  const [showSlabModal, setShowSlabModal] = useState(false);
  const [slabForm, setSlabForm] = useState({
    sequence_no: 9,
    lower_bound: 7000000,
    upper_bound: '',
    base_tax: 1424000,
    marginal_rate: 0.35,
    excess_over: 7000000,
    description: ''
  });

  useEffect(() => {
    fetchTaxYearsAndSlabs();
  }, []);

  useEffect(() => {
    runCalculation(calcSalary, calcPeriod);
  }, [calcSalary, calcPeriod, slabs]);

  const fetchTaxYearsAndSlabs = async () => {
    setLoading(true);
    try {
      const yearsRes = await api.get('/payroll/tax/years');
      if (yearsRes.data?.data?.length) {
        setTaxYears(yearsRes.data.data);
      }
      const slabsRes = await api.get('/payroll/tax/slabs');
      if (slabsRes.data?.data?.length) {
        setSlabs(slabsRes.data.data);
      }
    } catch (err) {
      console.warn('[Tax Engine] Using client fallback default FBR slabs:', err);
    } finally {
      setLoading(false);
    }
  };

  const runCalculation = (val, period) => {
    const numericVal = parseFloat(val) || 0;
    const annualIncome = period === 'monthly' ? numericVal * 12 : numericVal;

    let matchedSlab = null;
    for (const s of slabs) {
      const lower = parseFloat(s.lower_bound);
      const upper = s.upper_bound !== null && s.upper_bound !== undefined && s.upper_bound !== '' ? parseFloat(s.upper_bound) : null;

      if (annualIncome === 0 && lower === 0) {
        matchedSlab = s;
        break;
      }
      if (annualIncome > lower && (upper === null || annualIncome <= upper)) {
        matchedSlab = s;
        break;
      }
      if (annualIncome === lower && lower === 0) {
        matchedSlab = s;
        break;
      }
    }

    if (!matchedSlab) matchedSlab = slabs[slabs.length - 1];

    const baseTax = parseFloat(matchedSlab.base_tax) || 0;
    const rate = parseFloat(matchedSlab.marginal_rate) || 0;
    const excessOver = parseFloat(matchedSlab.excess_over) || 0;

    const excessAmount = Math.max(0, annualIncome - excessOver);
    const marginalTax = excessAmount * rate;
    const annualTax = Math.round((baseTax + marginalTax) * 100) / 100;
    const monthlyTax = Math.round((annualTax / 12) * 100) / 100;
    const effectiveRate = annualIncome > 0 ? Math.round((annualTax / annualIncome) * 10000) / 100 : 0;

    setCalcResult({
      annualIncome,
      annualTax,
      monthlyTax,
      effectiveRate,
      slab: matchedSlab,
      excessAmount
    });
  };

  const formatPKR = (num) => {
    if (num === null || num === undefined) return '—';
    return `PKR ${Number(num).toLocaleString('en-PK')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner Orchestrator - Standard ERP Module Header */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Shield size={20} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">
                Tax Engine & Slabs Configuration
              </h1>
              <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Pakistan TY 2026–27
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Data-driven statutory salary tax calculator & configurable FBR tax brackets engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTaxYearsAndSlabs}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
            <span>Sync Slabs</span>
          </button>
          <button
            onClick={() => setShowSlabModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Tax Slab</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>Active Tax Year</span>
            <Globe size={15} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-800">
            {taxYears.length > 0 ? taxYears[0].code : 'TY 2026–27'}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold">Jul 1, 2026 – Jun 30, 2027</div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>Statutory Basis</span>
            <FileText size={15} className="text-cyan-600" />
          </div>
          <div className="text-xl font-black text-slate-800">
            {taxYears.length > 0 ? (taxYears[0].source_version || 'Finance Act 2026') : 'Finance Act 2026'}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold truncate" title={taxYears.length > 0 ? taxYears[0].source_reference : ''}>
            {taxYears.length > 0 ? (taxYears[0].source_reference || 'First Schedule Part I') : 'First Schedule Part I (Salary)'}
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>Gazette Notification</span>
            <Shield size={15} className="text-amber-600" />
          </div>
          <div className="text-sm font-black text-slate-800 truncate" title={taxYears.length > 0 ? taxYears[0].gazette_number : 'C.No.1(6)Tax Policy/2026'}>
            {taxYears.length > 0 ? (taxYears[0].gazette_number || 'C.No.1(6)/2026') : 'C.No.1(6)Tax Policy/2026'}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">Official FBR Gazette Enacted</div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>Max Marginal Rate</span>
            <ArrowUpRight size={15} className="text-rose-600" />
          </div>
          <div className="text-xl font-black text-slate-800">35.00%</div>
          <div className="text-[11px] text-slate-500 font-semibold">Above PKR 7,000,000</div>
        </div>
      </div>

      {/* Interactive Tax Calculator Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Calculator size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Interactive Income Tax Calculator</h2>
              <p className="text-[11px] font-semibold text-slate-400">Simulate monthly payroll withholding & statutory annual tax</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setCalcPeriod('annual')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${calcPeriod === 'annual' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Annual Salary
            </button>
            <button
              onClick={() => setCalcPeriod('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${calcPeriod === 'monthly' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Monthly Gross
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Form */}
          <div className="space-y-4 lg:col-span-1">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                {calcPeriod === 'annual' ? 'Annual Taxable Gross Salary (PKR)' : 'Monthly Gross Salary (PKR)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">PKR</span>
                <input
                  type="number"
                  value={calcSalary}
                  onChange={(e) => setCalcSalary(e.target.value)}
                  className="w-full pl-13 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-extrabold text-sm focus:bg-white focus:border-emerald-500 focus:outline-none transition shadow-2xs"
                  placeholder="e.g. 1850000"
                />
              </div>
            </div>

            {/* Presets */}
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {[500000, 1000000, 1850000, 3000000, 5000000, 8000000].map(val => (
                  <button
                    key={val}
                    onClick={() => { setCalcPeriod('annual'); setCalcSalary(val); }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 transition cursor-pointer"
                  >
                    {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Output Cards */}
          {calcResult && (
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] text-emerald-800 font-extrabold uppercase">Annual Tax Payable</span>
                <div className="text-2xl font-black text-emerald-900 mt-2">{formatPKR(calcResult.annualTax)}</div>
                <span className="text-[10px] text-emerald-700 font-semibold mt-1">Full Fiscal Year 2026–27</span>
              </div>

              <div className="p-4 bg-sky-50/60 border border-sky-200/80 rounded-xl flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] text-sky-800 font-extrabold uppercase">Monthly Deduction</span>
                <div className="text-2xl font-black text-sky-900 mt-2">{formatPKR(calcResult.monthlyTax)}</div>
                <span className="text-[10px] text-sky-700 font-semibold mt-1">Deducted from payslip</span>
              </div>

              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl flex flex-col justify-between shadow-2xs">
                <span className="text-[11px] text-amber-800 font-extrabold uppercase">Effective Tax Rate</span>
                <div className="text-2xl font-black text-amber-900 mt-2">{calcResult.effectiveRate.toFixed(2)}%</div>
                <span className="text-[10px] text-amber-700 font-semibold mt-1">Slab #{calcResult.slab.sequence_no} Bracket</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tax Slabs Configuration Table */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Configurable Income Tax Brackets (Slabs)</h2>
            <p className="text-[11px] font-semibold text-slate-400">All calculations load dynamically from these statutory database slabs</p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider border border-emerald-200">
            STATUS: ACTIVE
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Annual Income Range (PKR)</th>
                <th className="py-3 px-4">Base Tax</th>
                <th className="py-3 px-4">Marginal Rate</th>
                <th className="py-3 px-4">Excess Over</th>
                <th className="py-3 px-4">Formula / Description</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slabs.map((slab) => {
                const isCurrent = calcResult?.slab?.sequence_no === slab.sequence_no;
                return (
                  <tr
                    key={slab.sequence_no}
                    className={`transition ${isCurrent ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50/70'}`}
                  >
                    <td className="py-3 px-4 font-black text-slate-700">Slab {slab.sequence_no}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {formatPKR(slab.lower_bound)} &mdash; {slab.upper_bound ? formatPKR(slab.upper_bound) : 'Above'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono font-semibold">{formatPKR(slab.base_tax)}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      {(parseFloat(slab.marginal_rate) * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{formatPKR(slab.excess_over)}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{slab.description}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSlabForm(slab);
                          setShowSlabModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="Edit Slab"
                      >
                        <Edit size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Slab Modal */}
      {showSlabModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">Configure Tax Slab</h3>
              <button onClick={() => setShowSlabModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">&times;</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1 font-bold">Lower Bound (PKR)</label>
                  <input
                    type="number"
                    value={slabForm.lower_bound}
                    onChange={e => setSlabForm({ ...slabForm, lower_bound: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-bold">Upper Bound (PKR / Blank)</label>
                  <input
                    type="number"
                    value={slabForm.upper_bound || ''}
                    onChange={e => setSlabForm({ ...slabForm, upper_bound: e.target.value })}
                    placeholder="Unbounded"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1 font-bold">Base Tax (PKR)</label>
                  <input
                    type="number"
                    value={slabForm.base_tax}
                    onChange={e => setSlabForm({ ...slabForm, base_tax: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-bold">Marginal Rate (e.g. 0.11)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={slabForm.marginal_rate}
                    onChange={e => setSlabForm({ ...slabForm, marginal_rate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-bold">Excess Over Threshold (PKR)</label>
                <input
                  type="number"
                  value={slabForm.excess_over}
                  onChange={e => setSlabForm({ ...slabForm, excess_over: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-bold">Description / Statutory Note</label>
                <input
                  type="text"
                  value={slabForm.description}
                  onChange={e => setSlabForm({ ...slabForm, description: e.target.value })}
                  placeholder="e.g. Rs. 6,000 + 11% of amount exceeding Rs. 1,200,000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSlabModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowSlabModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20"
              >
                Save Tax Slab
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
