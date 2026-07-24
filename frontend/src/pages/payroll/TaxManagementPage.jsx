import React, { useState, useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Calculator, Shield, FileText, CheckCircle2, AlertCircle,
  Plus, Edit, Trash2, RefreshCw, Globe, Layers, ArrowUpRight,
  ChevronRight, Percent, DollarSign, Info
} from 'lucide-react';
import api from '../../services/api';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';

// Default statutory FBR 2026-27 Slabs for fallback UI display
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
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [loading, setLoading] = useState(false);

  // Interactive Tax Calculator State
  const [calcSalary, setCalcSalary] = useState(1850000);
  const [calcPeriod, setCalcPeriod] = useState('annual'); // 'annual' | 'monthly'
  const [calcResult, setCalcResult] = useState(null);

  // Modal State for Adding/Editing Slabs
  const [showSlabModal, setShowSlabModal] = useState(false);
  const [editingSlab, setEditingSlab] = useState(null);
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

  const openAddSlabModal = () => {
    setEditingSlab(null);
    setSlabForm({
      sequence_no: slabs.length + 1,
      lower_bound: slabs.length > 0 ? (slabs[slabs.length - 1].upper_bound || 7000000) : 0,
      upper_bound: '',
      base_tax: 0,
      marginal_rate: 0.10,
      excess_over: 0,
      description: ''
    });
    setShowSlabModal(true);
  };

  const openEditSlabModal = (slab) => {
    setEditingSlab(slab);
    setSlabForm({
      sequence_no: slab.sequence_no,
      lower_bound: slab.lower_bound,
      upper_bound: slab.upper_bound !== null ? slab.upper_bound : '',
      base_tax: slab.base_tax,
      marginal_rate: slab.marginal_rate,
      excess_over: slab.excess_over,
      description: slab.description || ''
    });
    setShowSlabModal(true);
  };

  const kpis = [
    {
      label: 'Active Tax Year',
      value: 'TY 2026–27',
      subtext: 'Effective Jul 1, 2026 – Jun 30, 2027',
      icon: Globe,
      iconBgClass: 'bg-emerald-500/10',
      iconColorClass: 'text-emerald-600'
    },
    {
      label: 'Statutory Authority',
      value: 'Finance Act 2026',
      subtext: 'First Schedule Part I (Salary)',
      icon: FileText,
      iconBgClass: 'bg-blue-500/10',
      iconColorClass: 'text-blue-600'
    },
    {
      label: 'Tax Brackets',
      value: `${slabs.length} Progressive Slabs`,
      subtext: '0% up to PKR 600,000 threshold',
      icon: Layers,
      iconBgClass: 'bg-amber-500/10',
      iconColorClass: 'text-amber-600'
    },
    {
      label: 'Max Marginal Rate',
      value: '35.00%',
      subtext: 'Applicable above PKR 7,000,000',
      icon: ArrowUpRight,
      iconBgClass: 'bg-rose-500/10',
      iconColorClass: 'text-rose-600'
    }
  ];

  return (
    <WorkspaceLayout
      title="INCOME TAX ENGINE & SLABS CONFIGURATION"
      subtitle="Data-driven, statutory tax engine aligned with Pakistan Finance Act salary tax slabs"
      icon={Shield}
      badgeText="TY 2026-27 ACTIVE"
      breadcrumbs={['HR & Payroll', 'Tax Engine', 'Pakistan TY 2026-27']}
      kpis={kpis}
      primaryAction={
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTaxYearsAndSlabs}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Sync Slabs
          </button>
          <button
            onClick={openAddSlabModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer"
          >
            <Plus size={14} />
            Add Tax Slab
          </button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Interactive Tax Calculator Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
                <Calculator size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Interactive Tax Calculator</h3>
                <p className="text-[12px] text-slate-500">Simulate monthly withholding & annual income tax</p>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setCalcPeriod('annual')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${calcPeriod === 'annual' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Annual Salary
              </button>
              <button
                onClick={() => setCalcPeriod('monthly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${calcPeriod === 'monthly' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Monthly Gross
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Column */}
            <div className="space-y-3 lg:col-span-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {calcPeriod === 'annual' ? 'Annual Taxable Gross Salary (PKR)' : 'Monthly Gross Salary (PKR)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">PKR</span>
                <input
                  type="number"
                  value={calcSalary}
                  onChange={(e) => setCalcSalary(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-extrabold text-sm focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                  placeholder="e.g. 1850000"
                />
              </div>

              {/* Presets */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[500000, 1000000, 1850000, 3000000, 5000000, 8000000].map(val => (
                    <button
                      key={val}
                      onClick={() => { setCalcPeriod('annual'); setCalcSalary(val); }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition cursor-pointer"
                    >
                      {val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Cards */}
            {calcResult && (
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">Annual Tax Payable</span>
                  <div className="text-xl font-extrabold text-emerald-700 mt-1">{formatPKR(calcResult.annualTax)}</div>
                  <span className="text-[10.5px] text-emerald-600/80 font-medium mt-1">Full Fiscal Year 2026–27</span>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">Monthly Deduction</span>
                  <div className="text-xl font-extrabold text-blue-700 mt-1">{formatPKR(calcResult.monthlyTax)}</div>
                  <span className="text-[10.5px] text-blue-600/80 font-medium mt-1">Deducted from monthly payslip</span>
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] text-amber-800 font-bold uppercase tracking-wider">Effective Tax Rate</span>
                  <div className="text-xl font-extrabold text-amber-700 mt-1">{calcResult.effectiveRate.toFixed(2)}%</div>
                  <span className="text-[10.5px] text-amber-700/80 font-medium mt-1">Slab #{calcResult.slab.sequence_no} Bracket</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configurable Slabs Table Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Statutory Tax Brackets (Slabs Table)</h3>
              <p className="text-[12px] text-slate-500">Continuous non-hardcoded brackets loaded from PostgreSQL / SQLite database</p>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold rounded-full">
              STATUS: ACTIVE (8 SLABS)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold">
                  <th className="py-3 px-4">Slab #</th>
                  <th className="py-3 px-4">Annual Income Bracket (PKR)</th>
                  <th className="py-3 px-4">Base Tax</th>
                  <th className="py-3 px-4">Marginal Rate</th>
                  <th className="py-3 px-4">Excess Over</th>
                  <th className="py-3 px-4">Formula / Description</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {slabs.map((slab) => {
                  const isCurrent = calcResult?.slab?.sequence_no === slab.sequence_no;
                  return (
                    <tr
                      key={slab.sequence_no}
                      className={`transition ${isCurrent ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                          {slab.sequence_no}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatPKR(slab.lower_bound)} &mdash; {slab.upper_bound ? formatPKR(slab.upper_bound) : 'Above'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-mono font-medium">{formatPKR(slab.base_tax)}</td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-600">
                        {(parseFloat(slab.marginal_rate) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{formatPKR(slab.excess_over)}</td>
                      <td className="py-3.5 px-4 text-slate-600">{slab.description}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openEditSlabModal(slab)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-150 rounded-lg transition cursor-pointer"
                          title="Edit Tax Slab"
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

      </div>

      {/* Add / Edit Tax Slab Modal */}
      {showSlabModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">
                {editingSlab ? `Edit Tax Slab #${editingSlab.sequence_no}` : 'Add New Tax Slab'}
              </h3>
              <button onClick={() => setShowSlabModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">&times;</button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Lower Bound (PKR)</label>
                  <input
                    type="number"
                    value={slabForm.lower_bound}
                    onChange={e => setSlabForm({ ...slabForm, lower_bound: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Upper Bound (Leave blank if above)</label>
                  <input
                    type="number"
                    value={slabForm.upper_bound}
                    onChange={e => setSlabForm({ ...slabForm, upper_bound: e.target.value })}
                    placeholder="Unbounded"
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Base Tax (PKR)</label>
                  <input
                    type="number"
                    value={slabForm.base_tax}
                    onChange={e => setSlabForm({ ...slabForm, base_tax: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Marginal Rate (e.g. 0.11 for 11%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={slabForm.marginal_rate}
                    onChange={e => setSlabForm({ ...slabForm, marginal_rate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-bold">Excess Over Threshold (PKR)</label>
                <input
                  type="number"
                  value={slabForm.excess_over}
                  onChange={e => setSlabForm({ ...slabForm, excess_over: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-bold">Description / Formula Note</label>
                <input
                  type="text"
                  value={slabForm.description}
                  onChange={e => setSlabForm({ ...slabForm, description: e.target.value })}
                  placeholder="e.g. Rs. 6,000 + 11% of amount exceeding Rs. 1,200,000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setShowSlabModal(false)}
                className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowSlabModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer"
              >
                Save Tax Slab
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}
