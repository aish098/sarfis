import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Calendar, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Calculator, Activity, PieChart, FileText, Zap, X } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const TABS = [
  { id: 'trial_balance', label: 'Trial Balance', icon: Calculator },
  { id: 'income_statement', label: 'Income Statement', icon: Activity },
  { id: 'balance_sheet', label: 'Balance Sheet', icon: PieChart },
  { id: 'cash_flow', label: 'Cash Flow', icon: FileText },
];

const fmt = v => {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  return n < 0
    ? `($${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

export default function ReportsPage() {
  const { activeCompany } = useAuthStore();
  const [tab, setTab] = useState('trial_balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeModal, setCloseModal] = useState(false);
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeMemo, setCloseMemo] = useState('Year-End Closing');
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany) return;

    // Defer state updates to avoid synchronous setState in effect warnings
    await Promise.resolve();

    setLoading(true); setError(''); setData(null);
    try {
      const endpointMap = {
        trial_balance: { url: `/reports/trial-balance/${activeCompany.id}`, params: { startDate, endDate } },
        income_statement: { url: `/reports/income-statement/${activeCompany.id}`, params: { startDate, endDate } },
        balance_sheet: { url: `/reports/balance-sheet/${activeCompany.id}`, params: { asOfDate } },
        cash_flow: { url: `/reports/cash-flow/${activeCompany.id}`, params: { startDate, endDate } },
      };
      const { url, params } = endpointMap[tab];
      const res = await api.get(url, { params });
      setData(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to load report.'); }
    setLoading(false);
  }, [activeCompany, tab, startDate, endDate, asOfDate]);

  useEffect(() => { load(); }, [load]);

  const handleClose = async () => {
    setClosing(true); setCloseResult(null);
    try {
      const res = await api.post(`/reports/close-period/${activeCompany.id}`, { endDate: closeDate, description: closeMemo });
      setCloseResult(res.data); load();
    } catch (err) { setError(err.response?.data?.message || 'Close period failed.'); }
    setClosing(false);
  };

  const handleExport = () => {
    if (!data) return;
    const doc = new jsPDF();
    const activeLabel = TABS.find(t => t.id === tab)?.label || 'Financial Report';
    
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name || 'Sarfis Financials', 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139);
    doc.text(activeLabel, 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Period: ${tab === 'balance_sheet' ? `As of ${asOfDate}` : `${startDate} to ${endDate}`}`, 14, 38);

    let columns = [];
    let rows = [];

    if (tab === 'trial_balance') {
      columns = ['Code', 'Account Name', 'Debit', 'Credit'];
      rows = (data || []).map(acc => {
        const d = parseFloat(acc.total_debit) || 0, c = parseFloat(acc.total_credit) || 0, net = d - c;
        return [acc.code, acc.name, net > 0 ? fmt(net) : '—', net < 0 ? fmt(Math.abs(net)) : '—'];
      }).filter(r => r[2] !== '—' || r[3] !== '—');
    } else if (tab === 'income_statement') {
      columns = ['Account', 'Amount'];
      const rev = (data || []).filter(a => ['income', 'revenue'].includes(a.category?.toLowerCase() || a.type?.toLowerCase())).map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
      const exp = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
      const totalRev = rev.reduce((s, r) => s + r.net, 0);
      const totalExp = exp.reduce((s, r) => s + r.net, 0);
      
      rows = [
        ['REVENUE', ''],
        ...rev.map(r => [r.name, fmt(r.net)]),
        ['Total Revenue', fmt(totalRev)],
        ['', ''],
        ['EXPENSES', ''],
        ...exp.map(e => [e.name, fmt(e.net)]),
        ['Total Expenses', fmt(totalExp)],
        ['', ''],
        ['NET INCOME', fmt(totalRev - totalExp)]
      ];
    } else if (tab === 'balance_sheet') {
      columns = ['Account', 'Amount'];
      const assets = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'asset').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
      const liabs = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'liability').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
      const equity = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'equity').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
      const revLines = (data || []).filter(a => ['income','revenue'].includes((a.category || a.type)?.toLowerCase())).map(a => parseFloat(a.total_credit||0)-parseFloat(a.total_debit||0));
      const expLines = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => parseFloat(a.total_debit||0)-parseFloat(a.total_credit||0));
      const ytd = revLines.reduce((s,n)=>s+n,0) - expLines.reduce((s,n)=>s+n,0);
      if (Math.abs(ytd) > 0.001) equity.push({ name: 'Current Year Earnings', net: ytd });
      
      rows = [
        ['ASSETS', ''],
        ...assets.map(a => [a.name, fmt(a.net)]),
        ['Total Assets', fmt(assets.reduce((s,r)=>s+r.net,0))],
        ['', ''],
        ['LIABILITIES', ''],
        ...liabs.map(l => [l.name, fmt(l.net)]),
        ['Total Liabilities', fmt(liabs.reduce((s,r)=>s+r.net,0))],
        ['', ''],
        ['EQUITY', ''],
        ...equity.map(e => [e.name, fmt(e.net)]),
        ['Total Equity', fmt(equity.reduce((s,r)=>s+r.net,0))]
      ];
    } else if (tab === 'cash_flow') {
      columns = ['Activity', 'Amount'];
      const operating = (data || []).filter(r => ['income','revenue','expense'].includes((r.category || r.type)?.toLowerCase()));
      const investing = (data || []).filter(r => (r.category || r.type)?.toLowerCase() === 'asset');
      const financing = (data || []).filter(r => ['liability','equity'].includes((r.category || r.type)?.toLowerCase()));
      
      rows = [
        ['OPERATING ACTIVITIES', ''],
        ...operating.map(o => [o.name, fmt(o.magnitude)]),
        ['Net Operating Cash', fmt(operating.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0))],
        ['', ''],
        ['INVESTING ACTIVITIES', ''],
        ...investing.map(i => [i.name, fmt(i.magnitude)]),
        ['Net Investing Cash', fmt(investing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0))],
        ['', ''],
        ['FINANCING ACTIVITIES', ''],
        ...financing.map(f => [f.name, fmt(f.magnitude)]),
        ['Net Financing Cash', fmt(financing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0))],
        ['', ''],
        ['NET GAIN/LOSS IN CASH', fmt(operating.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0) + investing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0) + financing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0))]
      ];
    }

    autoTable(doc, {
      startY: 45,
      head: [columns],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { [columns.length - 1]: { halign: 'right' } }
    });

    doc.save(`${activeCompany?.name.replace(/\s+/g, '_')}_${tab}.pdf`);
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6]">
      <style>{`
        /* Hide scrollbar completely by default, only show when hovering and overflow exists */
        body .sarfis-scrollbar::-webkit-scrollbar {
          width: 0px !important;
          background: transparent !important;
        }
        body .sarfis-scrollbar:hover::-webkit-scrollbar {
          width: 5px !important;
        }
        body .sarfis-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
        }
        body .sarfis-scrollbar::-webkit-scrollbar-thumb {
          background: transparent !important;
          border-radius: 99px !important;
          transition: background 0.2s ease;
        }
        body .sarfis-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3) !important;
        }
        .sarfis-scrollbar {
          scrollbar-width: none !important;
        }
        .sarfis-scrollbar:hover {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(16, 185, 129, 0.3) transparent !important;
        }
      `}</style>

      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {/* Sarfis Logo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Zap size={18} className="text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">SARFIS</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Financial Reports</span>
            </div>
            <p className="text-[11.5px] font-semibold text-slate-500 mt-0.5">Real-time statements directly aligned with ledger activity.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2.5 mt-3 md:mt-0">
          <button 
            type="button"
            onClick={load} 
            disabled={loading}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          
          <button 
            type="button"
            onClick={handleExport}
            disabled={!data || loading}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white disabled:opacity-40 disabled:pointer-events-none px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
          >
            <Download size={13} /> Export Report
          </button>

          <button 
            type="button"
            onClick={() => setCloseModal(true)}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 px-4 py-2 text-[12px] font-bold rounded-xl border border-rose-200 transition-all active:scale-95 cursor-pointer"
          >
            <ShieldAlert size={13} /> Close Period
          </button>
        </div>
      </div>

      {/* Tab bar + date filters */}
      <div className="card !rounded-2xl border border-slate-100 bg-white p-4 mb-5 shadow-sm">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 xl:pb-0 sarfis-scrollbar">
            {TABS.map(t => {
              const isActive = tab === t.id;
              return (
                <button 
                  key={t.id} 
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold transition-all cursor-pointer border-2 ${
                    isActive 
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-200' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <t.icon size={13} className={isActive ? 'text-emerald-700' : 'text-slate-400'} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border-2 border-slate-100 shadow-sm focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/5">
            <Calendar size={14} className="text-slate-400 flex-shrink-0" />
            {tab === 'balance_sheet' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">AS OF</span>
                <input 
                  type="date" 
                  className="text-[13px] text-slate-700 border-none outline-none bg-transparent font-semibold cursor-pointer" 
                  value={asOfDate} 
                  onChange={e => setAsOfDate(e.target.value)} 
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input 
                  type="date" 
                  className="text-[13px] text-slate-700 border-none outline-none bg-transparent font-semibold cursor-pointer" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                />
                <span className="text-slate-300 font-bold">—</span>
                <input 
                  type="date" 
                  className="text-[13px] text-slate-700 border-none outline-none bg-transparent font-semibold cursor-pointer" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100 mb-5"
          >
            <AlertTriangle size={15} className="text-rose-600 mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-rose-700 font-semibold flex-1">{error}</p>
            <button type="button" onClick={() => setError('')} className="cursor-pointer">
              <X size={14} className="text-rose-400" />
            </button>
          </motion.div>
        )}

        <div className="card !rounded-2xl border border-slate-100 bg-white shadow-sm min-h-[600px] overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="skeleton h-4 w-20" />
                  <div className="skeleton h-4 flex-1" />
                  <div className="skeleton h-4 w-28" />
                  <div className="skeleton h-4 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div 
                key={tab} 
                initial={{ opacity: 0, y: 12 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }} 
                className="p-6 lg:p-8"
              >
                {tab === 'trial_balance' && <TrialBalance data={data} />}
                {tab === 'income_statement' && <IncomeStatement data={data} companyName={activeCompany?.name} startDate={startDate} endDate={endDate} />}
                {tab === 'balance_sheet' && <BalanceSheet data={data} companyName={activeCompany?.name} asOfDate={asOfDate} />}
                {tab === 'cash_flow' && <CashFlow data={data} companyName={activeCompany?.name} startDate={startDate} endDate={endDate} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Close Period Modal */}
      <AnimatePresence>
        {closeModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div 
              className="modal-box w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="text-center px-7 pt-7 pb-5" style={{ background: '#fff1f2', borderRadius: '20px 20px 0 0' }}>
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                  <ShieldAlert size={22} className="text-red-500" />
                </div>
                <h2 className="font-display font-extrabold text-[18px] text-slate-900">Run Year-End Close</h2>
                <p className="text-[13px] text-slate-500 mt-2 max-w-xs mx-auto">This irreversible mechanism calculates Net Income, zeros all Revenue & Expense accounts, and shifts the result into Retained Earnings.</p>
              </div>
              <div className="p-7 space-y-4">
                {closeResult ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-800 text-[13px]">Period Successfully Closed.</p>
                      <p className="text-[12px] font-mono text-emerald-600 mt-1">Net Income: {fmt(closeResult.netIncome)}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Close Through Date</label>
                      <input type="date" className="input-enterprise font-semibold" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Journal Memo</label>
                      <input className="input-enterprise font-semibold" value={closeMemo} onChange={e => setCloseMemo(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 px-7 pb-7">
                <button 
                  type="button" 
                  onClick={() => { setCloseModal(false); setCloseResult(null); }} 
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2.5 text-[12.5px] font-bold rounded-xl border border-slate-200 transition-all active:scale-95 cursor-pointer"
                >
                  {closeResult ? 'Close' : 'Cancel'}
                </button>
                {!closeResult && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.97 }}
                    onClick={handleClose} 
                    disabled={closing} 
                    className="flex-[2] flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {closing ? <><RefreshCw size={14} className="animate-spin" /> Processing...</> : 'Execute Closing'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrialBalance({ data }) {
  if (!data) return <Empty />;
  const rows = (data || []).map(acc => {
    const d = parseFloat(acc.total_debit) || 0, c = parseFloat(acc.total_credit) || 0, net = d - c;
    return { ...acc, finalDebit: net > 0 ? net : 0, finalCredit: net < 0 ? Math.abs(net) : 0 };
  }).filter(r => r.finalDebit > 0 || r.finalCredit > 0);
  const sumD = rows.reduce((s, r) => s + r.finalDebit, 0);
  const sumC = rows.reduce((s, r) => s + r.finalCredit, 0);
  const balanced = Math.abs(sumD - sumC) < 0.01;
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto lg:overflow-visible pb-6 sarfis-scrollbar">
        <table className="w-full text-left" style={{ minWidth: 600 }}>
          <thead>
            <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 120 }}>Code</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Account Name</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right" style={{ width: 160 }}>Debit Balance</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right" style={{ width: 160 }}>Credit Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EBE8]">
            {rows.map((r, i) => (
              <motion.tr 
                key={r.id} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.015 }}
                className={`group transition-colors relative ${
                  i % 2 === 0 ? 'bg-[#FFFDFB] hover:bg-emerald-50/15' : 'bg-[#FAFAF9] hover:bg-emerald-50/15'
                }`}
              >
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[12px] text-slate-500 font-bold">{r.code}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-bold text-[13.5px] text-slate-800">{r.name}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] font-black text-slate-700">
                  {r.finalDebit > 0 ? fmt(r.finalDebit) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] font-black text-slate-700">
                  {r.finalCredit > 0 ? fmt(r.finalCredit) : '—'}
                </td>
              </motion.tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#EBF2EE' }}>
              <td colSpan={2} className="px-4 py-3 text-right uppercase font-extrabold tracking-widest text-[10px] text-[#2E4D3F]" style={{ borderTop: '2px solid #D1E0D8', borderBottom: '4px double #2E4D3F' }}>
                Grand Totals
              </td>
              <td className="px-4 py-3 text-right font-mono font-black text-[13px] text-[#2E4D3F]" style={{ borderTop: '2px solid #D1E0D8', borderBottom: '4px double #2E4D3F' }}>
                {fmt(sumD)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-black text-[13px] text-[#2E4D3F]" style={{ borderTop: '2px solid #D1E0D8', borderBottom: '4px double #2E4D3F' }}>
                {fmt(sumC)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className={`flex items-center gap-2.5 p-4 rounded-2xl border-2 border-dashed text-[13px] font-bold ${
        balanced 
          ? 'bg-[#EBFDF5] border-[#C2F3DC] text-[#064E3B] shadow-sm shadow-emerald-500/5' 
          : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}>
        {balanced ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-rose-600" />}
        <span>{balanced ? 'TRIAL BALANCE EQUILIBRIUM VERIFIED' : `IMBALANCE DETECTED: ${fmt(Math.abs(sumD - sumC))}`}</span>
      </div>
    </div>
  );
}

function IncomeStatement({ data, companyName, startDate, endDate }) {
  if (!data) return <Empty />;
  const rev = (data || []).filter(a => ['income', 'revenue'].includes((a.category || a.type)?.toLowerCase())).map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
  const exp = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
  const totalRev = rev.reduce((s, r) => s + r.net, 0);
  const totalExp = exp.reduce((s, r) => s + r.net, 0);
  const net = totalRev - totalExp;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8 pb-6 border-b-2 border-[#10b981]/20">
        <p className="stmt-company">{companyName}</p>
        <p className="stmt-title mt-1">Income Statement</p>
        <p className="text-[12px] text-slate-400 mt-1 font-semibold">For the period {startDate} to {endDate}</p>
      </div>
      
      <div className="mb-8">
        <div className="stmt-section-header border-emerald-500 text-emerald-800 font-extrabold text-[12px] mb-3">Operating Revenue</div>
        <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] mb-3">
          {rev.map((r, idx) => (
            <div 
              key={r.id} 
              className={`flex justify-between py-2.5 px-3 text-slate-700 transition-colors font-semibold text-[13.5px] ${
                idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
              }`}
            >
              <span className={r.is_contra ? 'ml-4 text-slate-400' : ''}>{r.name}</span>
              <span className="font-mono font-bold text-slate-800">{fmt(r.net)}</span>
            </div>
          ))}
          {rev.length === 0 && <p className="text-[12.5px] text-slate-400 italic py-3 px-3">No revenue recorded</p>}
        </div>
        <div className="flex justify-between items-center mt-2 px-3 py-2.5 rounded-xl font-black text-[13.5px] bg-[#EBFDF5] border border-[#C2F3DC]">
          <span className="text-[#064E3B] uppercase tracking-wider text-[10px] font-black">Total Revenue</span>
          <span className="font-mono text-emerald-800 font-black text-[15px]">{fmt(totalRev)}</span>
        </div>
      </div>
      
      <div className="mb-8">
        <div className="stmt-section-header border-cyan-500 text-cyan-800 font-extrabold text-[12px] mb-3">Operating Expenses</div>
        <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] mb-3">
          {exp.map((e, idx) => (
            <div 
              key={e.id} 
              className={`flex justify-between py-2.5 px-3 text-slate-700 transition-colors font-semibold text-[13.5px] ${
                idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
              }`}
            >
              <span className={e.is_contra ? 'ml-4 text-slate-400' : ''}>{e.name}</span>
              <span className="font-mono font-bold text-slate-800">{fmt(e.net)}</span>
            </div>
          ))}
          {exp.length === 0 && <p className="text-[12.5px] text-slate-400 italic py-3 px-3">No expenses recorded</p>}
        </div>
        <div className="flex justify-between items-center mt-2 px-3 py-2.5 rounded-xl font-black text-[13.5px] bg-cyan-50 border border-cyan-100">
          <span className="text-cyan-900 uppercase tracking-wider text-[10px] font-black">Total Expenses</span>
          <span className="font-mono text-cyan-800 font-black text-[15px]">{fmt(totalExp)}</span>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] text-white shadow-md shadow-emerald-500/10 p-5 rounded-2xl flex justify-between items-center mt-10">
        <span className="font-display font-extrabold uppercase tracking-widest text-[13px] text-emerald-50">Net Income</span>
        <span className="font-mono font-black text-[22px] text-white">{fmt(net)}</span>
      </div>
    </div>
  );
}

function BalanceSheet({ data, companyName, asOfDate }) {
  if (!data) return <Empty />;
  const assets = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'asset').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
  const liabs = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'liability').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
  const equity = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'equity').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
  const revLines = (data || []).filter(a => ['income','revenue'].includes((a.category || a.type)?.toLowerCase())).map(a => parseFloat(a.total_credit||0)-parseFloat(a.total_debit||0));
  const expLines = (data || []).filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => parseFloat(a.total_debit||0)-parseFloat(a.total_credit||0));
  const ytd = revLines.reduce((s,n)=>s+n,0) - expLines.reduce((s,n)=>s+n,0);
  if (Math.abs(ytd) > 0.001) equity.push({ id: 'ytd', name: 'Current Year Earnings', net: ytd });
  const tA = assets.reduce((s,r)=>s+r.net,0);
  const tL = liabs.reduce((s,r)=>s+r.net,0);
  const tE = equity.reduce((s,r)=>s+r.net,0);
  const balanced = Math.abs(tA - (tL + tE)) < 0.01;
  return (
    <div className="max-w-4xl mx-auto">
      {!balanced && (
        <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-100 text-[12px] font-bold text-rose-700 text-center uppercase tracking-wider flex items-center justify-center gap-2">
          <AlertTriangle size={14} className="text-rose-600 animate-pulse" />
          <span>Balance Sheet Imbalance Detected</span>
        </div>
      )}
      <div className="text-center mb-8 pb-6 border-b-2 border-[#10b981]/20">
        <p className="stmt-company">{companyName}</p>
        <p className="stmt-title mt-1">Balance Sheet</p>
        <p className="text-[12px] text-slate-400 mt-1 font-semibold">As of {asOfDate}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div className="stmt-section-header border-emerald-500 text-emerald-800 font-extrabold text-[12px] mb-3">Assets</div>
          <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] mb-3">
            {assets.map((r, idx) => (
              <div 
                key={r.id} 
                className={`flex justify-between py-2.5 px-3 text-slate-700 transition-colors font-semibold text-[13.5px] ${
                  idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
                }`}
              >
                <span className={r.is_contra ? 'ml-4 text-slate-400' : ''}>{r.name}</span>
                <span className="font-mono font-bold text-slate-800">{fmt(r.net)}</span>
              </div>
            ))}
            {assets.length === 0 && <p className="text-[12.5px] text-slate-400 italic py-3 px-3">No assets recorded</p>}
          </div>
          <div className="flex justify-between items-center mt-2 px-3 py-2.5 rounded-xl font-black text-[13.5px] bg-[#EBFDF5] border border-[#C2F3DC]">
            <span className="text-[#064E3B] uppercase tracking-wider text-[10px] font-black">Total Assets</span>
            <span className="font-mono text-emerald-800 font-black text-[15px]">{fmt(tA)}</span>
          </div>
        </div>
        
        <div>
          <div className="stmt-section-header border-cyan-500 text-cyan-800 font-extrabold text-[12px] mb-3">Liabilities</div>
          <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] mb-3">
            {liabs.map((r, idx) => (
              <div 
                key={r.id} 
                className={`flex justify-between py-2.5 px-3 text-slate-700 transition-colors font-semibold text-[13.5px] ${
                  idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
                }`}
              >
                <span className={r.is_contra ? 'ml-4 text-slate-400' : ''}>{r.name}</span>
                <span className="font-mono font-bold text-slate-800">{fmt(r.net)}</span>
              </div>
            ))}
            {liabs.length === 0 && <p className="text-[12.5px] text-slate-400 italic py-3 px-3">No liabilities recorded</p>}
          </div>
          <div className="flex justify-between items-center mt-2 px-3 py-2.5 rounded-xl font-black text-[13.5px] bg-cyan-50 border border-cyan-100 mb-6">
            <span className="text-cyan-900 uppercase tracking-wider text-[10px] font-black">Total Liabilities</span>
            <span className="font-mono text-cyan-800 font-black text-[15px]">{fmt(tL)}</span>
          </div>
          
          <div className="stmt-section-header border-emerald-500 text-emerald-800 font-extrabold text-[12px] mb-3">Equity</div>
          <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] mb-3">
            {equity.map((r, idx) => (
              <div 
                key={r.id || idx} 
                className={`flex justify-between py-2.5 px-3 text-slate-700 transition-colors font-semibold text-[13.5px] ${
                  idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
                }`}
              >
                <span className={r.is_contra ? 'ml-4 text-slate-400' : ''}>{r.name}</span>
                <span className="font-mono font-bold text-slate-800">{fmt(r.net)}</span>
              </div>
            ))}
            {equity.length === 0 && <p className="text-[12.5px] text-slate-400 italic py-3 px-3">No equity recorded</p>}
          </div>
          <div className="flex justify-between items-center mt-2 px-3 py-2.5 rounded-xl font-black text-[13.5px] bg-[#EBFDF5] border border-[#C2F3DC]">
            <span className="text-[#064E3B] uppercase tracking-wider text-[10px] font-black">Total Equity</span>
            <span className="font-mono text-emerald-800 font-black text-[15px]">{fmt(tE)}</span>
          </div>
          
          <div className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] text-white shadow-md shadow-emerald-500/10 p-4 rounded-xl flex justify-between items-center mt-6">
            <span className="font-display font-extrabold uppercase tracking-widest text-[12px] text-emerald-50">Total L & E</span>
            <span className="font-mono font-black text-[18px] text-white">{fmt(tL + tE)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashFlow({ data, companyName, startDate, endDate }) {
  if (!data || !data.length) return <Empty />;
  const operating = (data || []).filter(r => ['income','revenue','expense'].includes((r.category || r.type)?.toLowerCase()));
  const investing = (data || []).filter(r => (r.category || r.type)?.toLowerCase() === 'asset');
  const financing = (data || []).filter(r => ['liability','equity'].includes((r.category || r.type)?.toLowerCase()));
  const netOp = operating.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0);
  const netInv = investing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0);
  const netFin = financing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0);
  const total = netOp + netInv + netFin;
  const Section = ({ title, items, net, sectionHeaderClass, netBg, netBorder, netText }) => (
    <div className="mb-7">
      <div className={`stmt-section-header font-extrabold text-[12px] mb-3 ${sectionHeaderClass}`}>{title}</div>
      <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] mb-3">
        {items.map((item, idx) => (
          <div 
            key={idx} 
            className={`flex justify-between py-2.5 px-3 text-slate-700 transition-colors font-semibold text-[13.5px] ${
              idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
            }`}
          >
            <span>{item.name}</span>
            <span className="font-mono font-bold text-slate-800">{fmt(item.magnitude)}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-[12.5px] text-slate-400 italic py-3 px-3">No activity recorded</p>}
      </div>
      <div className={`flex justify-between items-center mt-2 px-3 py-2.5 rounded-xl font-black text-[13px] border ${netBg} ${netBorder}`}>
        <span className={`${netText} uppercase tracking-wider text-[10px] font-black`}>Net Cash — {title.split(' ')[0]}</span>
        <span className="font-mono font-black text-[14px]" style={{ color: net >= 0 ? '#059669' : '#dc2626' }}>{fmt(net)}</span>
      </div>
    </div>
  );
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8 pb-6 border-b-2 border-[#10b981]/20">
        <p className="stmt-company">{companyName}</p>
        <p className="stmt-title mt-1 font-display">Statement of Cash Flows</p>
        <p className="text-[12.5px] text-slate-400 mt-1 font-semibold">Direct Method • Period {startDate} to {endDate}</p>
      </div>
      
      <Section 
        title="Operating Activities" 
        items={operating} 
        net={netOp} 
        sectionHeaderClass="border-emerald-500 text-emerald-800"
        netBg="bg-[#EBFDF5]" 
        netBorder="border-[#C2F3DC]" 
        netText="text-[#064E3B]"
      />
      
      <Section 
        title="Investing Activities" 
        items={investing} 
        net={netInv} 
        sectionHeaderClass="border-cyan-500 text-cyan-800"
        netBg="bg-cyan-50" 
        netBorder="border-cyan-100" 
        netText="text-cyan-900"
      />
      
      <Section 
        title="Financing Activities" 
        items={financing} 
        net={netFin} 
        sectionHeaderClass="border-teal-500 text-teal-800"
        netBg="bg-teal-50/50" 
        netBorder="border-teal-100/50" 
        netText="text-teal-900"
      />
      
      <div className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] text-white shadow-md shadow-emerald-500/10 p-5 rounded-2xl flex justify-between items-center mt-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-50 mb-0.5">Total Impact</p>
          <p className="font-display font-black text-[15px] text-white">Net Increase / Decrease in Cash</p>
        </div>
        <span className="font-mono font-black text-[22px] text-white">{fmt(total)}</span>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-[#EBFDF5] border border-[#C2F3DC]">
        <FileText size={28} className="text-emerald-500" />
      </div>
      <p className="font-bold text-slate-700 text-[14px]">No Reports Data Found</p>
      <p className="text-[13px] text-slate-400 mt-1 font-semibold max-w-xs mx-auto">Select a valid period and click Refresh to generate the report statements.</p>
    </div>
  );
}
