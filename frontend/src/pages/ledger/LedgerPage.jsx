import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Download, RefreshCw, ChevronDown, FileText, Trash2, ArrowUpRight, ArrowDownRight, DollarSign, LayoutPanelLeft, Zap } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function LedgerPage({ globalSearch = "" }) {
  const { activeCompany } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  
  const search = globalSearch || localSearch;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
  }, [activeCompany]);

  useEffect(() => {
    const fetchLedger = async () => {
      if (!selectedId) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/ledger/account/${selectedId}`);
        setTransactions(res.data);
      } catch (err) {
        console.error('Failed to load ledger:', err);
      }
      setIsLoading(false);
    };

    fetchLedger();
  }, [selectedId]);

  const selectedAcc = accounts.find(a => String(a.id) === String(selectedId));

  const ledgerData = useMemo(() => {
    let filtered = transactions.filter(tx => {
      const d = new Date(tx.entry_date);
      const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase()) || (tx.reference || '').toLowerCase().includes(search.toLowerCase());
      const matchFrom = dateFrom ? d >= new Date(dateFrom) : true;
      const matchTo = dateTo ? d <= new Date(dateTo) : true;
      return matchSearch && matchFrom && matchTo;
    }).sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));

    const entries = [];
    let balance = 0, totalDebits = 0, totalCredits = 0;
    
    filtered.forEach(tx => {
      const debit = parseFloat(tx.debit) || 0;
      const credit = parseFloat(tx.credit) || 0;
      balance += debit - credit;
      totalDebits += debit;
      totalCredits += credit;
      entries.push({ 
        ...tx, 
        parsedDebit: debit, 
        parsedCredit: credit, 
        runningBalance: balance 
      });
    });

    return { entries, totalDebits, totalCredits, closingBalance: balance };
  }, [transactions, search, dateFrom, dateTo]);

  const fmt = v => {
    if (v === undefined || v === null) return '—';
    const n = parseFloat(v), abs = Math.abs(n);
    const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2 });
    return n < 0 ? `(${s})` : s;
  };

  const exportPDF = () => {
    if (!selectedAcc || !ledgerData.entries.length) { alert('No data to export.'); return; }
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`General Ledger: ${selectedAcc.name}`, 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Account: ${selectedAcc.code} • Company: ${activeCompany?.name}`, 14, 28);
    autoTable(doc, {
      head: [['Date', 'Description / Reference', 'Debit', 'Credit', 'Balance']],
      body: ledgerData.entries.map(tx => {
        const txDate = tx.entry_date ? new Date(tx.entry_date) : null;
        const formattedDate = txDate && !isNaN(txDate.getTime()) ? txDate.toLocaleDateString() : '—';
        return [
          formattedDate,
          tx.description + (tx.reference ? ` (${tx.reference})` : ''),
          tx.parsedDebit > 0 ? fmt(tx.parsedDebit) : '—',
          tx.parsedCredit > 0 ? fmt(tx.parsedCredit) : '—',
          fmt(tx.runningBalance),
        ];
      }),
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 13, 36] },
    });
    doc.save(`ledger_${selectedAcc.code}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleVoid = async (entryId) => {
    if (!window.confirm('Void and delete this entry? This cannot be undone.')) return;
    try { 
      await api.delete(`/journal/${entryId}`); 
      setTransactions(prev => prev.filter(tx => (tx.entry_id || tx.id) !== entryId));
    } catch (err) {
      console.error('Failed to void entry:', err);
    }
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
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">General Ledger</span>
            </div>
            <p className="text-[11.5px] font-semibold text-slate-500 mt-0.5">Chronological transaction history & accounts audit logs</p>
          </div>
        </div>
        
        <div className="flex gap-2.5 mt-3 md:mt-0">
          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={exportPDF} 
            disabled={!selectedAcc || !ledgerData.entries.length}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white disabled:opacity-40 disabled:pointer-events-none px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
          >
            <Download size={14} /> Export PDF Report
          </motion.button>
        </div>
      </div>

      {/* Account Selector Card */}
      <div className="card !rounded-2xl border border-slate-100 bg-white p-5 mb-5 shadow-sm" style={{ overflow: 'visible' }}>
        <div className="flex flex-col xl:flex-row gap-6 xl:items-center justify-between">
          <div className="flex-1 max-w-xl">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Select Ledger Account</label>
            <div className="relative">
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="w-full bg-white border-2 border-slate-100 rounded-xl px-10 text-[14px] text-slate-900 placeholder:text-slate-400 font-semibold transition-all outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 h-10 flex items-center pr-10 cursor-pointer appearance-none">
                <option value="" disabled>— Select an account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
              <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {selectedAcc && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-5 mt-4">
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Account Title</p>
                  <p className="font-bold text-slate-800 text-[14px]">{selectedAcc.name}</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Code</p>
                  <p className="font-mono font-bold text-[#064E3B] text-[13px]">{selectedAcc.code}</p>
                </div>
              </motion.div>
            )}
          </div>

          {selectedAcc && !isLoading && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-4 xl:mt-0">
              {[
                { icon: ArrowUpRight, label: 'Total Debits', value: fmt(ledgerData.totalDebits), color: '#059669', bg: '#EBFDF5', border: '#C2F3DC' },
                { icon: ArrowDownRight, label: 'Total Credits', value: fmt(ledgerData.totalCredits), color: '#e11d48', bg: '#FFF1F2', border: '#FFE4E6' },
                { icon: DollarSign, label: 'Balance', value: fmt(ledgerData.closingBalance), color: parseFloat(ledgerData.closingBalance) >= 0 ? '#059669' : '#e11d48', bg: parseFloat(ledgerData.closingBalance) >= 0 ? '#EBFDF5' : '#FFF1F2', border: parseFloat(ledgerData.closingBalance) >= 0 ? '#C2F3DC' : '#FFE4E6', big: true },
              ].map(s => (
                <div key={s.label} className="text-center px-4 py-3.5 rounded-2xl transition-all hover:shadow-sm" style={{ background: s.bg, border: `1.5px solid ${s.border}` }}>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-center gap-1">
                    <s.icon size={11} style={{ color: s.color }} />
                    {s.label}
                  </p>
                  <p className={`font-mono font-black ${s.big ? 'text-[17px]' : 'text-[15px]'}`} style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="card !rounded-2xl border border-slate-100 bg-white p-4 mb-5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              className="w-full bg-white border-2 border-slate-100 rounded-xl pl-10 pr-4 text-[13px] text-slate-800 placeholder:text-slate-400 font-semibold outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5"
              style={{ height: '40px' }}
              placeholder="Search descriptions or references..."
              value={localSearch} 
              onChange={e => setLocalSearch(e.target.value)} 
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 px-4 py-2 rounded-xl bg-white border-2 border-slate-100 shadow-sm focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/5">
            <Calendar size={14} className="text-slate-400 flex-shrink-0" />
            <input type="date" className="text-[13px] text-slate-700 border-none outline-none bg-transparent font-semibold cursor-pointer" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="text-slate-300 font-bold">—</span>
            <input type="date" className="text-[13px] text-slate-700 border-none outline-none bg-transparent font-semibold cursor-pointer" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          
          <button 
            onClick={() => { setLocalSearch(''); setDateFrom(''); setDateTo(''); }}
            className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 text-[12.5px] font-bold rounded-xl border border-slate-200 transition-all active:scale-95 cursor-pointer flex-shrink-0"
          >
            <RefreshCw size={14} /> Reset Filters
          </button>
        </div>
      </div>

      {/* Ledger table */}
      <div className="card !rounded-2xl border border-slate-100 bg-white" style={{ overflow: 'visible', minHeight: 400 }}>
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-emerald-50 border border-emerald-100">
              <LayoutPanelLeft size={28} className="text-emerald-500" />
            </div>
            <h3 className="font-display font-extrabold text-[16px] text-slate-800 mb-2">Access General Ledger</h3>
            <p className="text-[13px] text-slate-400 max-w-xs font-semibold">Select a general ledger account above to load transaction history and running balances.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 flex-1" />
                <div className="skeleton h-5 w-20" />
                <div className="skeleton h-5 w-20" />
                <div className="skeleton h-5 w-24" />
              </div>
            ))}
          </div>
        ) : ledgerData.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <FileText size={28} className="text-slate-300 mb-3" />
            <p className="font-bold text-slate-700 text-[14px]">No Transactions Found</p>
            <p className="text-[13px] text-slate-400 mt-1 font-semibold">Try adjusting your filters or date periods.</p>
          </div>
        ) : (
          <div className="overflow-x-auto lg:overflow-visible pb-24" style={{ minHeight: '380px' }}>
            <table className="w-full text-left" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]" style={{ width: 120 }}>Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Description / Reference</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right" style={{ width: 130 }}>Debit</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right" style={{ width: 130 }}>Credit</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-right" style={{ width: 140 }}>Balance</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-center" style={{ width: 60 }}>Void</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE8]">
                {ledgerData.entries.map((tx, i) => (
                  <tr key={tx.id || i}
                    className={`group transition-colors relative focus-within:z-30 ${
                      i % 2 === 0 ? 'bg-[#FFFDFB] hover:bg-emerald-50/15' : 'bg-[#FAFAF9] hover:bg-emerald-50/15'
                    }`}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-[13px] text-slate-700 whitespace-nowrap">
                        {new Date(tx.entry_date).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-[13.5px] text-slate-800 truncate">{tx.description}</p>
                      {tx.reference && <p className="text-[11px] text-slate-400 mt-0.5 font-mono font-bold tracking-wider">{tx.reference}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[13px] font-black text-slate-700">
                      {tx.parsedDebit > 0 ? fmt(tx.parsedDebit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[13px] font-black text-slate-700">
                      {tx.parsedCredit > 0 ? fmt(tx.parsedCredit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-black text-[13px]">
                      <span className={parseFloat(tx.runningBalance) >= 0 ? 'text-emerald-700' : 'text-[#e11d48]'}>
                        {fmt(tx.runningBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => handleVoid(tx.entry_id || tx.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
