import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Calculator, Hourglass, DollarSign, CheckCircle2, ChevronRight, BarChart2 } from 'lucide-react';

const COMPANIES_DATA = {
  khaan: { name: "Khaan Tech Solutions", cash: 2500000, ar: 1200000, assets: 1500000, eliminations: 0 },
  accountellence: { name: "Accountellence Global Ltd", cash: 5000000, ar: 2400000, assets: 3200000, eliminations: -500000 }, // Intercompany AR
  ayesha: { name: "Ayesha Labs (Subsidiary)", cash: 1800000, ar: 800000, assets: 1200050, eliminations: -300000 }  // Intercompany AR
};

export default function NextLevelFeatures() {
  // Consolidation States
  const [selectedCompanies, setSelectedCompanies] = useState({
    khaan: true,
    accountellence: true,
    ayesha: false
  });

  // Savings Calculator States
  const [hoursSpent, setHoursSpent] = useState(15);
  const [hourlyRate, setHourlyRate] = useState(1500); // PKR per hour

  // Toggle company consolidation check
  const toggleCompany = (key) => {
    setSelectedCompanies(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Consolidation computations
  const consolidatedMetrics = Object.keys(selectedCompanies).reduce((totals, key) => {
    if (selectedCompanies[key]) {
      const data = COMPANIES_DATA[key];
      totals.cash += data.cash;
      totals.ar += data.ar;
      totals.assets += data.assets;
      totals.eliminations += data.eliminations;
    }
    return totals;
  }, { cash: 0, ar: 0, assets: 0, eliminations: 0 });

  const totalConsolidatedAssets = consolidatedMetrics.cash + consolidatedMetrics.ar + consolidatedMetrics.assets + consolidatedMetrics.eliminations;

  // ROI Calculator computations
  const weeklySavings = hoursSpent * 0.8 * hourlyRate; // 80% automation gain
  const annualSavings = weeklySavings * 52;
  const hoursGained = Math.round(hoursSpent * 0.8 * 52);

  return (
    <section className="py-28 px-5 sm:px-8 relative overflow-hidden bg-[#030b1a] border-y border-slate-900">
      
      {/* Background spotlights */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 right-1/4 w-[600px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.03) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-stretch">
        
        {/* Left Side: Multi-Company Consolidation Dashboard Simulator */}
        <div className="flex flex-col h-full space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-5 uppercase tracking-wider"
              style={{ background: 'rgba(6,182,212,0.07)', borderColor: 'rgba(6,182,212,0.22)', color: '#67e8f9' }}>
              <Building2 size={13} className="text-cyan-400" /> Multi-Company Architecture
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-4"
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Consolidated Balance Sheet Engine
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
              ACCOUNTELLENCE supports multi-tenant, multi-branch, and multi-company consolidation. Toggle which subsidiaries to combine below and watch intercompany balances reconcile automatically.
            </p>
          </div>

          {/* Interactive Consolidation Simulator Panel */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-5 sm:p-6 space-y-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Subsidiaries</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded font-bold uppercase">Consolidation Mode</span>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {Object.keys(COMPANIES_DATA).map(key => (
                  <button
                    key={key}
                    onClick={() => toggleCompany(key)}
                    className={`p-3 rounded-xl border text-left transition active:scale-95 cursor-pointer ${
                      selectedCompanies[key]
                        ? 'bg-cyan-950/20 border-cyan-500/30 text-white'
                        : 'bg-slate-950/40 border-slate-850 text-slate-500'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1">Company Entity</div>
                    <div className="text-xs font-extrabold truncate">{COMPANIES_DATA[key].name}</div>
                    <div className="mt-2 text-[10px] font-semibold text-slate-400">
                      {selectedCompanies[key] ? '🟢 Combined' : '⚪ Excluded'}
                    </div>
                  </button>
                ))}
              </div>

              {/* Live Consolidated Ledger */}
              <div className="border border-slate-850 rounded-2xl bg-black/40 overflow-hidden text-xs">
                <div className="grid grid-cols-2 bg-slate-900/60 p-3 font-bold border-b border-slate-800 text-slate-400 text-[10.5px] uppercase tracking-wider">
                  <span>Account Segment</span>
                  <span className="text-right">Consolidated Balance</span>
                </div>
                <div className="p-3 space-y-2.5">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">1000 - Cash & Bank Balance</span>
                    <span className="font-mono text-white font-semibold">PKR {consolidatedMetrics.cash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">1100 - Accounts Receivable</span>
                    <span className="font-mono text-white font-semibold">PKR {consolidatedMetrics.ar.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">1500 - Plant & Equipment Assets</span>
                    <span className="font-mono text-white font-semibold">PKR {consolidatedMetrics.assets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500 italic">Intercompany Elimination Adjustments</span>
                    <span className="font-mono text-rose-400 font-bold">PKR {consolidatedMetrics.eliminations.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 font-bold text-white text-[13px]">
                    <span>Total Consolidated Capital Assets</span>
                    <span className="font-mono text-cyan-400 font-black">PKR {totalConsolidatedAssets.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/20 rounded-2xl text-[11.5px] text-cyan-300 leading-relaxed font-semibold mt-4">
              ℹ️ Intercompany balances are eliminated automatically on consolidation (IFRS 10 guidelines) to prevent double counting of asset valuation.
            </div>
          </div>
        </div>

        {/* Right Side: Enterprise Savings & ROI Calculator */}
        <div className="flex flex-col h-full space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-5 uppercase tracking-wider"
              style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)', color: '#6ee7b7' }}>
              <Calculator size={13} className="text-emerald-400" /> ROI Calculator
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-4"
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Compute Your Savings Instantly
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
              ACCOUNTELLENCE automates the routine tasks that absorb hours of financial workflow. Drag the sliders below to estimate your company savings.
            </p>
          </div>

          {/* Interactive Calculator */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              {/* Sliders */}
              <div className="space-y-5 text-xs mb-5">
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-2">
                    <span>Weekly Manual Accounting Hours</span>
                    <span className="text-emerald-400 font-bold">{hoursSpent} Hours</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    value={hoursSpent}
                    onChange={e => setHoursSpent(parseInt(e.target.value, 10))}
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-2">
                    <span>Finance Employee Hourly Rate (Avg)</span>
                    <span className="text-emerald-400 font-bold">PKR {hourlyRate.toLocaleString()} / hr</span>
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="5000" 
                    step="100"
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              {/* Savings Breakdown */}
              <div className="border border-slate-850 rounded-2xl bg-black/40 overflow-hidden text-xs mb-5">
                <div className="grid grid-cols-2 bg-slate-900/60 p-3 font-bold border-b border-slate-800 text-slate-400 text-[10.5px] uppercase tracking-wider">
                  <span>Savings Category</span>
                  <span className="text-right">Estimated Gain</span>
                </div>
                <div className="p-3 space-y-2.5">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">Manual Entry & Ledgers (40%)</span>
                    <span className="font-mono text-white font-semibold">PKR {Math.round(annualSavings * 0.4).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">Bank Reconciliations (30%)</span>
                    <span className="font-mono text-white font-semibold">PKR {Math.round(annualSavings * 0.3).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payroll Runs & Auditing (30%)</span>
                    <span className="font-mono text-white font-semibold">PKR {Math.round(annualSavings * 0.3).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Results Cards */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-left">
                  <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                    <Hourglass size={12} className="text-emerald-400" /> Time Reclaimed
                  </div>
                  <div className="text-2xl font-black text-white leading-none mb-1 font-mono">{hoursGained} hrs</div>
                  <span className="text-[10px] text-slate-500">annualized time saved</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-left">
                  <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                    <DollarSign size={12} className="text-emerald-400" /> Cost Savings
                  </div>
                  <div className="text-2xl font-black text-emerald-400 leading-none mb-1 font-mono">
                    PKR {Math.round(annualSavings / 1000)}K
                  </div>
                  <span className="text-[10px] text-slate-500">annualized cash saved</span>
                </div>
              </div>
            </div>

            {/* ROI badge info */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-left mt-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black font-mono text-xs">
                80%
              </div>
              <p className="text-[11.5px] text-emerald-300 leading-relaxed font-semibold">
                ACCOUNTELLENCE automates 80% of data entry, ledger posting, and reconciliation. Based on your inputs, your business will save approximately **PKR {annualSavings.toLocaleString()}** annually.
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
