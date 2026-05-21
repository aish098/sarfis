import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Calendar, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Calculator, Activity, PieChart, FileText } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import jsPDF from 'jspdf';
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
    <div className="pb-16">
      {/* Top header */}
      <div style={{ background: 'var(--blue-900)' }} className="px-6 lg:px-8 py-7 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="font-display font-extrabold text-[22px] text-white">Financial Reports</h1>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Real-time statements directly aligned with ledger activity.</p>
          </div>
          <div className="flex gap-3 sm:ml-auto">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={load} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
              <RefreshCw size={13} /> Refresh
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleExport}
              className="btn btn-secondary btn-sm"><Download size={13} /> Export</motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setCloseModal(true)} className="btn btn-danger btn-sm">
              <ShieldAlert size={13} /> Close Period
            </motion.button>
          </div>
        </div>
      </div>

      {/* Tab bar + date filters */}
      <div className="sticky top-[60px] z-30 bg-white/95 backdrop-blur border-b border-slate-100 px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
          <div className="flex gap-1 overflow-x-auto hide-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`tab-item flex-shrink-0 ${tab === t.id ? 'active' : ''}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Calendar size={14} className="text-slate-400 flex-shrink-0" />
            {tab === 'balance_sheet' ? (
              <span className="text-[12px] text-slate-500 font-semibold">AS OF
                <input type="date" className="ml-2 text-[13px] text-slate-700 bg-transparent border-none outline-none" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
              </span>
            ) : (
              <>
                <input type="date" className="text-[13px] text-slate-700 bg-transparent border-none outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-slate-300">–</span>
                <input type="date" className="text-[13px] text-slate-700 bg-transparent border-none outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-amber-50 border border-amber-100 mb-5">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
            <p className="text-[13px] text-amber-700 font-medium">{error}</p>
          </div>
        )}

        <div className="card overflow-hidden min-h-[600px]">
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
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }} className="p-6 lg:p-8">
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
            <motion.div className="modal-box w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}>
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
                      <input type="date" className="input-enterprise" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Journal Memo</label>
                      <input className="input-enterprise" value={closeMemo} onChange={e => setCloseMemo(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 px-7 pb-7">
                <button onClick={() => { setCloseModal(false); setCloseResult(null); }} className="btn btn-secondary flex-1">
                  {closeResult ? 'Close' : 'Cancel'}
                </button>
                {!closeResult && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleClose} disabled={closing} className="btn btn-danger flex-[2]">
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
    <div>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Account Name</th>
            <th className="text-right" style={{ width: 160 }}>Debit Balance</th>
            <th className="text-right" style={{ width: 160 }}>Credit Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <td><span className="font-mono text-[12px] text-slate-500">{r.code}</span></td>
              <td><span className="font-medium text-[14px]">{r.name}</span></td>
              <td className="text-right font-mono text-[13px] font-semibold">{r.finalDebit > 0 ? fmt(r.finalDebit) : '—'}</td>
              <td className="text-right font-mono text-[13px] font-semibold">{r.finalCredit > 0 ? fmt(r.finalCredit) : '—'}</td>
            </motion.tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="text-right uppercase font-extrabold tracking-widest text-[11px]">Grand Totals</td>
            <td className="text-right font-mono font-extrabold text-[14px]">{fmt(sumD)}</td>
            <td className="text-right font-mono font-extrabold text-[14px]">{fmt(sumC)}</td>
          </tr>
        </tfoot>
      </table>
      <div className={`flex items-center gap-2.5 mt-4 p-4 rounded-xl border text-[13px] font-semibold ${balanced ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
        {balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        {balanced ? 'TRIAL BALANCE EQUILIBRIUM VERIFIED' : `IMBALANCE DETECTED: ${fmt(Math.abs(sumD - sumC))}`}
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
      <div className="text-center mb-8 pb-6" style={{ borderBottom: '2px solid #0f172a' }}>
        <p className="stmt-company">{companyName}</p>
        <p className="stmt-title mt-1">Income Statement</p>
        <p className="text-[12px] text-slate-400 mt-1">For the period {startDate} to {endDate}</p>
      </div>
      <div className="mb-6">
        <div className="stmt-section-header border-emerald-500 text-emerald-700">Operating Revenue</div>
        {rev.map(r => <div key={r.id} className="stmt-row"><span className={`text-[14px] ${r.is_contra ? 'ml-4 text-slate-500' : ''}`}>{r.name}</span><span className="font-mono text-[14px]">{fmt(r.net)}</span></div>)}
        <div className="stmt-row stmt-total" style={{ background: '#f0fdf4', padding: '10px 8px', borderRadius: 8, marginTop: 4 }}>
          <span className="text-[14px]">Total Revenue</span>
          <span className="font-mono text-[15px] text-emerald-700">{fmt(totalRev)}</span>
        </div>
      </div>
      <div className="mb-6">
        <div className="stmt-section-header border-red-400 text-red-600">Operating Expenses</div>
        {exp.map(r => <div key={r.id} className="stmt-row"><span className={`text-[14px] ${r.is_contra ? 'ml-4 text-slate-500' : ''}`}>{r.name}</span><span className="font-mono text-[14px]">{fmt(r.net)}</span></div>)}
        <div className="stmt-row stmt-total" style={{ background: '#fff1f2', padding: '10px 8px', borderRadius: 8, marginTop: 4 }}>
          <span className="text-[14px]">Total Expenses</span>
          <span className="font-mono text-[15px] text-red-600">{fmt(totalExp)}</span>
        </div>
      </div>
      <div className="stmt-grand-total">
        <span className="font-display font-extrabold uppercase tracking-widest text-[13px]">Net Income</span>
        <span className={`font-mono font-extrabold text-[20px] ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(net)}</span>
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
    <div className="max-w-3xl mx-auto">
      {!balanced && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-[12px] font-semibold text-red-600 text-center">Balance Sheet Imbalance Detected</div>}
      <div className="text-center mb-8 pb-6" style={{ borderBottom: '2px solid #0f172a' }}>
        <p className="stmt-company">{companyName}</p>
        <p className="stmt-title mt-1">Balance Sheet</p>
        <p className="text-[12px] text-slate-400 mt-1">As of {asOfDate}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div className="stmt-section-header border-emerald-500 text-emerald-700 mb-3">Assets</div>
          {assets.map(r => <div key={r.id} className="stmt-row"><span className={`text-[14px] ${r.is_contra ? 'ml-4 text-slate-500' : ''}`}>{r.name}</span><span className="font-mono text-[13px]">{fmt(r.net)}</span></div>)}
          <div className="stmt-row stmt-total mt-2" style={{ background: '#f0fdf4', padding: '10px 8px', borderRadius: 8 }}>
            <span className="text-emerald-800">Total Assets</span><span className="font-mono text-emerald-700">{fmt(tA)}</span>
          </div>
        </div>
        <div>
          <div className="stmt-section-header border-red-400 text-red-600 mb-3">Liabilities</div>
          {liabs.map(r => <div key={r.id} className="stmt-row"><span className={`text-[14px] ${r.is_contra ? 'ml-4 text-slate-500' : ''}`}>{r.name}</span><span className="font-mono text-[13px]">{fmt(r.net)}</span></div>)}
          <div className="stmt-row stmt-total mt-2 mb-6" style={{ background: '#fff1f2', padding: '10px 8px', borderRadius: 8 }}>
            <span className="text-red-800">Total Liabilities</span><span className="font-mono text-red-700">{fmt(tL)}</span>
          </div>
          <div className="stmt-section-header border-blue-400 text-blue-700 mb-3">Equity</div>
          {equity.map(r => <div key={r.id} className="stmt-row"><span className={`text-[14px] ${r.is_contra ? 'ml-4 text-slate-500' : ''}`}>{r.name}</span><span className="font-mono text-[13px]">{fmt(r.net)}</span></div>)}
          <div className="stmt-row stmt-total mt-2" style={{ background: '#eff6ff', padding: '10px 8px', borderRadius: 8 }}>
            <span className="text-blue-800">Total Equity</span><span className="font-mono text-blue-700">{fmt(tE)}</span>
          </div>
          <div className="stmt-grand-total mt-4">
            <span className="font-display font-extrabold uppercase tracking-widest text-[12px]">Total L & E</span>
            <span className="font-mono font-extrabold text-[18px]">{fmt(tL + tE)}</span>
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
  const Section = ({ title, items, net, color }) => (
    <div className="mb-7">
      <div className={`stmt-section-header mb-3`} style={{ borderColor: color, color }}>{title}</div>
      {items.map((item,i) => <div key={i} className="stmt-row"><span className="text-[14px]">{item.name}</span><span className="font-mono text-[13px]">{fmt(item.magnitude)}</span></div>)}
      {items.length === 0 && <p className="text-[12px] text-slate-300 italic py-1 px-1">No activity</p>}
      <div className="flex justify-between items-center mt-2 px-2 py-2.5 rounded-lg font-bold text-[13px]" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <span>Net Cash — {title.split(' ')[0]}</span>
        <span className="font-mono" style={{ color: net >= 0 ? '#059669' : '#dc2626' }}>{fmt(net)}</span>
      </div>
    </div>
  );
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8 pb-6" style={{ borderBottom: '2px solid #0f172a' }}>
        <p className="stmt-company">{companyName}</p>
        <p className="stmt-title mt-1">Statement of Cash Flows · Direct Method</p>
        <p className="text-[12px] text-slate-400 mt-1">{startDate} to {endDate}</p>
      </div>
      <Section title="Operating Activities" items={operating} net={netOp} color="#10b981" />
      <Section title="Investing Activities" items={investing} net={netInv} color="#3b82f6" />
      <Section title="Financing Activities" items={financing} net={netFin} color="#8b5cf6" />
      <div className="stmt-grand-total">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">Total Impact</p>
          <p className="font-display font-bold text-[15px] text-white">Net Increase / Decrease in Cash</p>
        </div>
        <span className={`font-mono font-extrabold text-[22px] ${total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(total)}</span>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FileText size={32} className="text-slate-200 mb-3" />
      <p className="text-[14px] font-semibold text-slate-400">No data available for the selected period.</p>
    </div>
  );
}
