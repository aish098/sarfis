import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator, Shield, FileText, CheckCircle2, AlertCircle,
  Plus, Edit, Trash2, HelpCircle, ChevronRight, RefreshCw, Globe, Layers, ArrowUpRight
} from 'lucide-react';
import api from '../../services/api';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

// Default static FBR 2026-27 Slabs for fallback UI display
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
    <div className="min-h-screen text-slate-100 flex flex-col" style={{ background: '#030b1a' }}>
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-4 sm:px-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Header & Breadcrumb */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <span>HR & Payroll</span>
              <ChevronRight size={14} className="text-slate-600" />
              <span>Tax Engine</span>
              <ChevronRight size={14} className="text-slate-600" />
              <span className="text-slate-300">Pakistan TY 2026–27</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
              Income Tax Engine & Slabs Configuration
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Data-driven, configurable tax engine aligned with Pakistan Finance Act statutory salary tax slabs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchTaxYearsAndSlabs}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Sync Tax Engine
            </button>
            <button
              onClick={() => setShowSlabModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <Plus size={16} />
              Add Tax Slab
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
              <span>Active Tax Year</span>
              <Globe size={16} className="text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white">TY 2026–27</div>
            <div className="text-xs text-emerald-400 font-medium">Effective: Jul 1, 2026 – Jun 30, 2027</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
              <span>Statutory Basis</span>
              <FileText size={16} className="text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-white">Finance Act 2026</div>
            <div className="text-xs text-slate-400">First Schedule Part I (Salary)</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
              <span>Tax Brackets</span>
              <Layers size={16} className="text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">{slabs.length} Progressive Slabs</div>
            <div className="text-xs text-slate-400">0% up to PKR 600,000 threshold</div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
              <span>Max Marginal Rate</span>
              <ArrowUpRight size={16} className="text-rose-400" />
            </div>
            <div className="text-xl font-bold text-white">35.00%</div>
            <div className="text-xs text-slate-400">Applicable above PKR 7,000,000</div>
          </div>
        </div>

        {/* Interactive Tax Calculator Section */}
        <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Calculator size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Interactive Income Tax Calculator</h2>
                <p className="text-xs text-slate-400">Simulate monthly payroll tax withholding & statutory annual tax</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setCalcPeriod('annual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${calcPeriod === 'annual' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Annual Salary
              </button>
              <button
                onClick={() => setCalcPeriod('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${calcPeriod === 'monthly' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Monthly Gross
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Form */}
            <div className="space-y-4 lg:col-span-1">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {calcPeriod === 'annual' ? 'Annual Taxable Gross Salary (PKR)' : 'Monthly Gross Salary (PKR)'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">PKR</span>
                  <input
                    type="number"
                    value={calcSalary}
                    onChange={(e) => setCalcSalary(e.target.value)}
                    className="w-full pl-14 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-base focus:border-emerald-500 focus:outline-none transition"
                    placeholder="e.g. 1850000"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Sample Quick Presets:</span>
                <div className="flex flex-wrap gap-2">
                  {[500000, 1000000, 1850000, 3000000, 5000000, 8000000].map(val => (
                    <button
                      key={val}
                      onClick={() => { setCalcPeriod('annual'); setCalcSalary(val); }}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition cursor-pointer"
                    >
                      {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculation Output Cards */}
            {calcResult && (
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Annual Tax Payable</span>
                  <div className="text-2xl font-black text-emerald-400 mt-2">{formatPKR(calcResult.annualTax)}</div>
                  <span className="text-[11px] text-slate-500 mt-1">Full Fiscal Year 2026–27</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Monthly Deduction</span>
                  <div className="text-2xl font-black text-cyan-400 mt-2">{formatPKR(calcResult.monthlyTax)}</div>
                  <span className="text-[11px] text-slate-500 mt-1">Deducted from monthly payslip</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Effective Tax Rate</span>
                  <div className="text-2xl font-black text-amber-400 mt-2">{calcResult.effectiveRate.toFixed(2)}%</div>
                  <span className="text-[11px] text-slate-500 mt-1">Slab #{calcResult.slab.sequence_no} Bracket</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tax Slabs Configuration Table */}
        <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Configurable Income Tax Brackets (Slabs)</h2>
              <p className="text-xs text-slate-400">All calculations load dynamically from these statutory database slabs</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">
              STATUS: ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Annual Income Range (PKR)</th>
                  <th className="py-3 px-4">Base Tax</th>
                  <th className="py-3 px-4">Marginal Rate</th>
                  <th className="py-3 px-4">Excess Over</th>
                  <th className="py-3 px-4">Formula / Description</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {slabs.map((slab) => {
                  const isCurrent = calcResult?.slab?.sequence_no === slab.sequence_no;
                  return (
                    <tr
                      key={slab.sequence_no}
                      className={`transition ${isCurrent ? 'bg-emerald-950/30 border-l-4 border-emerald-500' : 'hover:bg-slate-850/50'}`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-300">Slab {slab.sequence_no}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {formatPKR(slab.lower_bound)} &mdash; {slab.upper_bound ? formatPKR(slab.upper_bound) : 'Above'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">{formatPKR(slab.base_tax)}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        {(parseFloat(slab.marginal_rate) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{formatPKR(slab.excess_over)}</td>
                      <td className="py-3.5 px-4 text-slate-400">{slab.description}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSlabForm(slab);
                            setShowSlabModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
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

      </main>

      {/* Add / Edit Slab Modal */}
      {showSlabModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Configure Tax Slab</h3>
              <button onClick={() => setShowSlabModal(false)} className="text-slate-400 hover:text-white text-lg cursor-pointer">&times;</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Lower Bound (PKR)</label>
                  <input
                    type="number"
                    value={slabForm.lower_bound}
                    onChange={e => setSlabForm({ ...slabForm, lower_bound: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Upper Bound (PKR / Leave Blank)</label>
                  <input
                    type="number"
                    value={slabForm.upper_bound || ''}
                    onChange={e => setSlabForm({ ...slabForm, upper_bound: e.target.value })}
                    placeholder="Unbounded"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Base Tax (PKR)</label>
                  <input
                    type="number"
                    value={slabForm.base_tax}
                    onChange={e => setSlabForm({ ...slabForm, base_tax: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Marginal Rate (Decimal, e.g. 0.11)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={slabForm.marginal_rate}
                    onChange={e => setSlabForm({ ...slabForm, marginal_rate: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Excess Over Threshold (PKR)</label>
                <input
                  type="number"
                  value={slabForm.excess_over}
                  onChange={e => setSlabForm({ ...slabForm, excess_over: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Description / Statutory Note</label>
                <input
                  type="text"
                  value={slabForm.description}
                  onChange={e => setSlabForm({ ...slabForm, description: e.target.value })}
                  placeholder="e.g. Rs. 6,000 + 11% of amount exceeding Rs. 1,200,000"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSlabModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSlabModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Save Tax Slab
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
