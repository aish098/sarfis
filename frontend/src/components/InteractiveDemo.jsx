import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sliders, Wallet, TrendingUp, Package, 
  ShieldCheck, Briefcase, BarChart3, Plus, Trash2, 
  CheckCircle2, AlertTriangle, Send, RefreshCw, DollarSign
} from 'lucide-react';

const DEMO_TABS = [
  { id: 'ledger', label: 'General Ledger', icon: BookOpen, accent: '#06b6d4' },
  { id: 'vouchers', label: 'AP/AR Vouchers', icon: Sliders, accent: '#10b981' },
  { id: 'assets', label: 'Asset Depreciation', icon: TrendingUp, accent: '#8b5cf6' },
  { id: 'payroll', label: 'Payroll Simulator', icon: Briefcase, accent: '#ec4899' },
  { id: 'risk', label: 'Credit Risk Watchlist', icon: ShieldCheck, accent: '#ef4444' }
];

export default function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState('ledger');
  
  // Interactive State for Ledger Demo
  const [ledgerLines, setLedgerLines] = useState([
    { account: '1010 - Cash', debit: 50000, credit: 0 },
    { account: '3010 - Capital', debit: 0, credit: 50000 }
  ]);
  const [ledgerMessage, setLedgerMessage] = useState('');

  // Interactive State for Vouchers Demo
  const [vouchers, setVouchers] = useState([
    { id: 'V-001', vendor: 'Apex Wholesale', amount: 15000, status: 'Draft', type: 'Purchase' },
    { id: 'V-002', vendor: 'Titan Logistics', amount: 8400, status: 'Approved', type: 'Purchase' },
    { id: 'V-003', vendor: 'Prime Distrib', amount: 22000, status: 'Posted', type: 'Sales' }
  ]);

  // Interactive State for Assets Demo
  const [assetCost, setAssetCost] = useState(150000);
  const [assetLife, setAssetLife] = useState(5);
  
  // Interactive State for Payroll Demo
  const [baseSalary, setBaseSalary] = useState(60000);
  const [allowance, setAllowance] = useState(8000);

  // General Ledger Handlers
  const addLedgerLine = () => {
    setLedgerLines([...ledgerLines, { account: 'Select Account...', debit: 0, credit: 0 }]);
  };
  const updateLedgerLine = (index, field, val) => {
    const updated = [...ledgerLines];
    updated[index][field] = val;
    setLedgerLines(updated);
  };
  const deleteLedgerLine = (index) => {
    setLedgerLines(ledgerLines.filter((_, i) => i !== index));
  };
  
  const debitsSum = ledgerLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const creditsSum = ledgerLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(debitsSum - creditsSum) < 0.01 && debitsSum > 0;

  const handlePostLedger = () => {
    if (!isBalanced) return;
    setLedgerMessage('🎉 Success: Journal Entry posted to General Ledger successfully! Ledger balances updated.');
    setTimeout(() => setLedgerMessage(''), 5000);
  };

  // Voucher Handlers
  const approveVoucher = (id) => {
    setVouchers(vouchers.map(v => v.id === id ? { ...v, status: 'Approved' } : v));
  };
  const postVoucher = (id) => {
    setVouchers(vouchers.map(v => v.id === id ? { ...v, status: 'Posted' } : v));
  };

  // Asset Calculation
  const annualDepreciation = assetCost / assetLife;

  // Payroll Calculation
  const tax = baseSalary * 0.1;
  const netPay = baseSalary + allowance - tax;

  return (
    <section className="py-28 px-5 sm:px-8 relative overflow-hidden bg-[#030b1a]">
      {/* Background radial highlight */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-5 uppercase tracking-wider"
            style={{ background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>
            Interactive Demo
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-tight"
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Test Drive the Professional Workspace
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Interact with our modules below. See how validation, rules, and workflows behave in real-time.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10 border-b border-slate-800/80 pb-6">
          {DEMO_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setLedgerMessage('');
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  borderColor: isActive ? tab.accent : 'rgba(255,255,255,0.05)',
                  boxShadow: isActive ? `0 0 16px ${tab.accent}15` : 'none'
                }}
              >
                <Icon size={14} style={{ color: isActive ? tab.accent : '#64748b' }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live Simulator Area */}
        <div className="bg-[#050f21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 min-h-[440px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            
            {/* 1. General Ledger Simulator */}
            {activeTab === 'ledger' && (
              <motion.div
                key="ledger"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-[15px] font-black text-white uppercase tracking-wider">Journal Voucher Posting Engine</h3>
                    <p className="text-[12px] text-slate-400 mt-0.5">Dual-entry verification system (Strict IFRS/GAAP rules)</p>
                  </div>
                  <button 
                    onClick={addLedgerLine}
                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold px-4 py-2 rounded-xl border-none cursor-pointer"
                  >
                    <Plus size={13} /> Add Line
                  </button>
                </div>

                {ledgerMessage && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-500/25 rounded-xl flex items-center gap-2 text-xs text-emerald-300 font-bold animate-fade-in">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    {ledgerMessage}
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-850 rounded-2xl bg-black/30">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 font-black text-slate-500 uppercase tracking-widest text-[9.5px]">
                        <th className="py-3 pl-4">Account Reference</th>
                        <th className="py-3 text-right pr-6" style={{ width: '22%' }}>Debit (PKR)</th>
                        <th className="py-3 text-right pr-6" style={{ width: '22%' }}>Credit (PKR)</th>
                        <th className="py-3 text-center" style={{ width: '10%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerLines.map((line, idx) => (
                        <tr key={idx} className="border-b border-slate-900 hover:bg-white/[0.01]">
                          <td className="py-2.5 pl-4">
                            <select 
                              className="bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs w-full focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                              value={line.account}
                              onChange={e => updateLedgerLine(idx, 'account', e.target.value)}
                            >
                              <option>1010 - Cash</option>
                              <option>1030 - Main Bank Account</option>
                              <option>1200 - Accounts Receivable</option>
                              <option>2010 - Accounts Payable</option>
                              <option>3010 - Capital</option>
                              <option>4010 - Sales Revenue</option>
                              <option>Select Account...</option>
                            </select>
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <input 
                              type="number" 
                              className="bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs w-full text-right focus:outline-none focus:border-cyan-500/50"
                              value={line.debit || ''}
                              onChange={e => updateLedgerLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <input 
                              type="number" 
                              className="bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs w-full text-right focus:outline-none focus:border-cyan-500/50"
                              value={line.credit || ''}
                              onChange={e => updateLedgerLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="py-2.5 text-center">
                            <button 
                              onClick={() => deleteLedgerLine(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer border-none bg-transparent"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-950/80 font-black text-white border-t border-slate-800">
                        <td className="py-3.5 pl-4 uppercase tracking-wider text-[10.5px]">Journal Totals</td>
                        <td className="py-3.5 pr-6 text-right font-mono text-[13px]">PKR {debitsSum.toLocaleString()}</td>
                        <td className="py-3.5 pr-6 text-right font-mono text-[13px]">PKR {creditsSum.toLocaleString()}</td>
                        <td className="py-3.5 text-center">
                          {isBalanced ? (
                            <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider">Balanced</span>
                          ) : (
                            <span className="bg-rose-950 text-rose-400 border border-rose-500/20 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider">Unbalanced</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                    <span>The system blocks manual posts to control accounts automatically unless overridden.</span>
                  </div>
                  <button 
                    onClick={handlePostLedger}
                    disabled={!isBalanced}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={13} /> Post to Ledger
                  </button>
                </div>
              </motion.div>
            )}

            {/* 2. AP/AR Vouchers Simulator */}
            {activeTab === 'vouchers' && (
              <motion.div
                key="vouchers"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-[15px] font-black text-white uppercase tracking-wider">Matched Invoice Vouchers</h3>
                  <p className="text-[12px] text-slate-400 mt-0.5">Reconcile purchasing/billing records before posting to general ledger</p>
                </div>

                <div className="grid gap-3.5">
                  {vouchers.map(v => (
                    <div 
                      key={v.id} 
                      className="p-4 bg-slate-950/70 border border-slate-850 rounded-2xl flex items-center justify-between flex-wrap gap-4 text-xs"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center font-mono font-bold text-emerald-400">
                          {v.id}
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-white">{v.vendor}</h4>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{v.type} Invoice</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase tracking-wider">Gross Amount</span>
                          <span className="text-white font-mono font-bold text-[13px]">PKR {v.amount.toLocaleString()}</span>
                        </div>
                        
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase tracking-wider mb-1">State</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.status === 'Draft' ? 'bg-slate-900 text-slate-400 border border-slate-800' :
                            v.status === 'Approved' ? 'bg-blue-950 text-blue-400 border border-blue-500/20' :
                            'bg-emerald-950 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {v.status}
                          </span>
                        </div>

                        <div className="w-28 text-right">
                          {v.status === 'Draft' && (
                            <button 
                              onClick={() => approveVoucher(v.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {v.status === 'Approved' && (
                            <button 
                              onClick={() => postVoucher(v.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer"
                            >
                              Post Ledger
                            </button>
                          )}
                          {v.status === 'Posted' && (
                            <span className="text-[11px] text-slate-500 italic font-medium">Archived & Locked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 3. Asset Depreciation Simulator */}
            {activeTab === 'assets' && (
              <motion.div
                key="assets"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-[15px] font-black text-white uppercase tracking-wider">Asset Register & Depreciation</h3>
                  <p className="text-[12px] text-slate-400 mt-0.5">Straight-Line depreciation scheduler simulator</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1.5">Asset Purchase Cost (PKR)</label>
                      <input 
                        type="number"
                        className="input-enterprise w-full"
                        style={{ background: '#030b1a', border: '1px solid #1e293b', color: '#ffffff' }}
                        value={assetCost}
                        onChange={e => setAssetCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1.5">Useful Life (Years)</label>
                      <input 
                        type="number"
                        className="input-enterprise w-full"
                        style={{ background: '#030b1a', border: '1px solid #1e293b', color: '#ffffff' }}
                        value={assetLife}
                        onChange={e => setAssetLife(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950 border border-slate-850 rounded-2xl space-y-4 text-xs">
                    <h4 className="text-slate-400 uppercase tracking-widest font-black text-[9.5px]">Calculation Breakdown</h4>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-500">Method</span>
                      <span className="text-white font-bold">Straight Line</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-500">Useful Life Cycle</span>
                      <span className="text-white font-bold">{assetLife} Years</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-500">Annual Depreciation Expense</span>
                      <span className="text-violet-400 font-black font-mono text-[13px]">PKR {annualDepreciation.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monthly Ledger Adjustment</span>
                      <span className="text-white font-mono">PKR {(annualDepreciation / 12).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 4. Payroll Simulator */}
            {activeTab === 'payroll' && (
              <motion.div
                key="payroll"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-[15px] font-black text-white uppercase tracking-wider">Salary Run simulator</h3>
                  <p className="text-[12px] text-slate-400 mt-0.5">Simulate rules-based net payroll generation including withholding tax</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1.5">Base Salary (PKR)</label>
                      <input 
                        type="number"
                        className="input-enterprise w-full"
                        style={{ background: '#030b1a', border: '1px solid #1e293b', color: '#ffffff' }}
                        value={baseSalary}
                        onChange={e => setBaseSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1.5">Allowances / Bonuses (PKR)</label>
                      <input 
                        type="number"
                        className="input-enterprise w-full"
                        style={{ background: '#030b1a', border: '1px solid #1e293b', color: '#ffffff' }}
                        value={allowance}
                        onChange={e => setAllowance(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950 border border-slate-850 rounded-2xl space-y-4 text-xs">
                    <h4 className="text-slate-400 uppercase tracking-widest font-black text-[9.5px]">Calculation Breakdown</h4>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-500">Gross Earnings</span>
                      <span className="text-white font-bold">PKR {(baseSalary + allowance).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-500">Withholding Tax (10% Rule)</span>
                      <span className="text-rose-400 font-bold">- PKR {tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold text-white">Net Employee Pay</span>
                      <span className="text-pink-400 font-black font-mono text-[14px]">PKR {netPay.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 5. Credit Risk Simulator */}
            {activeTab === 'risk' && (
              <motion.div
                key="risk"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-[15px] font-black text-white uppercase tracking-wider">Credit Risk & Relationship Watchlist</h3>
                  <p className="text-[12px] text-slate-400 mt-0.5">Entity relationship scorecards (Prevent default transactions)</p>
                </div>

                <div className="grid gap-3.5">
                  {[
                    { entity: 'Starlight Tech Distributors', type: 'Customer', score: 15, level: 'Low', status: 'Active', block: false, color: '#10b981' },
                    { entity: 'Titan Freight Services', type: 'Vendor', score: 75, level: 'High', status: 'Restricted', block: true, color: '#f59e0b' },
                    { entity: 'Prime Logistics Ltd', type: 'Customer', score: 95, level: 'Critical', status: 'Blacklisted', block: true, color: '#ef4444' }
                  ].map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 bg-slate-950/70 border border-slate-850 rounded-2xl flex items-center justify-between flex-wrap gap-4 text-xs"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-10 rounded-full" style={{ background: item.color }} />
                        <div>
                          <h4 className="text-[13px] font-bold text-white">{item.entity}</h4>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{item.type}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-10">
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase tracking-wider">Risk Score</span>
                          <span className="text-white font-mono font-bold text-[13px]">{item.score} / 100</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase tracking-wider mb-0.5">Classification</span>
                          <span className="font-extrabold uppercase text-[10.5px]" style={{ color: item.color }}>{item.level}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block uppercase tracking-wider mb-1">State Limit</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.block ? 'bg-rose-950 text-rose-400 border border-rose-500/20' : 'bg-emerald-950 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {item.block ? 'Cash Only Block' : 'No Limit'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
