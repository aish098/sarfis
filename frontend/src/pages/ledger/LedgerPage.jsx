import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Download, RefreshCw, ChevronDown, FileText, Trash2, ArrowUpRight, ArrowDownRight, DollarSign, LayoutPanelLeft } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function LedgerPage() {
  const { activeCompany } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
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
      body: ledgerData.entries.map(tx => [
        new Date(tx.entry_date).toLocaleDateString(),
        tx.description + (tx.reference ? ` (${tx.reference})` : ''),
        tx.parsedDebit > 0 ? fmt(tx.parsedDebit) : '—',
        tx.parsedCredit > 0 ? fmt(tx.parsedCredit) : '—',
        fmt(tx.runningBalance),
      ]),
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
      // Update local state instead of reloading everything
      setTransactions(prev => prev.filter(tx => (tx.entry_id || tx.id) !== entryId));
    } catch (err) {
      console.error('Failed to void entry:', err);
    }
  };

  return (
    <div className="p-6 lg:p-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900">General Ledger</h1>
          <p className="text-[13px] text-slate-500 mt-1">View and analyze account transactions</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={exportPDF} className="btn btn-primary">
          <Download size={15} /> Export PDF
        </motion.button>
      </div>

      {/* Account selector */}
      <div className="card p-5 mb-5">
        <div className="flex flex-col xl:flex-row gap-6 xl:items-center">
          <div className="flex-1 max-w-xl">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Select Account</label>
            <div className="relative">
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="input-enterprise font-medium text-[14px] cursor-pointer appearance-none pr-10"
                style={{ paddingLeft: '44px', paddingTop: '0px', paddingBottom: '0px' }}>
                <option value="" disabled>— Select an account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {selectedAcc && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-5 mt-3">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Account</p>
                  <p className="font-semibold text-slate-800 text-[14px]">{selectedAcc.name}</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Code</p>
                  <p className="font-mono font-semibold text-slate-700 text-[13px]">{selectedAcc.code}</p>
                </div>
              </motion.div>
            )}
          </div>

          {selectedAcc && !isLoading && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-3 gap-4">
              {[
                { icon: ArrowUpRight, label: 'Total Debits', value: fmt(ledgerData.totalDebits), color: '#059669' },
                { icon: ArrowDownRight, label: 'Total Credits', value: fmt(ledgerData.totalCredits), color: '#dc2626' },
                { icon: DollarSign, label: 'Balance', value: fmt(ledgerData.closingBalance), color: parseFloat(ledgerData.closingBalance) >= 0 ? '#059669' : '#dc2626', big: true },
              ].map(s => (
                <div key={s.label} className="text-center px-4 py-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{s.label}</p>
                  <p className={`font-mono font-extrabold ${s.big ? 'text-[18px]' : 'text-[16px]'}`} style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input-enterprise text-[13px]" 
              style={{ paddingLeft: '44px' }}
              placeholder="Search descriptions or references..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ border: '1.5px solid #e2e8f0', background: 'white' }}>
            <Calendar size={14} className="text-slate-400 flex-shrink-0" />
            <input type="date" className="text-[13px] text-slate-700 border-none outline-none bg-transparent" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="text-slate-300 font-bold">—</span>
            <input type="date" className="text-[13px] text-slate-700 border-none outline-none bg-transparent" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
            className="btn btn-secondary btn-sm flex-shrink-0"><RefreshCw size={14} /> Reset</button>
        </div>
      </div>

      {/* Ledger table */}
      <div className="card overflow-hidden" style={{ minHeight: 400 }}>
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f1f5f9' }}>
              <LayoutPanelLeft size={28} className="text-slate-300" />
            </div>
            <h3 className="font-display font-bold text-[16px] text-slate-700 mb-2">Access General Ledger</h3>
            <p className="text-[13px] text-slate-400 max-w-xs">Select an account above to view its chronological transaction history.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-24" />
              </div>
            ))}
          </div>
        ) : ledgerData.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <FileText size={28} className="text-slate-300 mb-3" />
            <p className="font-semibold text-slate-600 text-[14px]">No Transactions Found</p>
            <p className="text-[13px] text-slate-400 mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Description / Reference</th>
                  <th className="text-right" style={{ width: 120 }}>Debit</th>
                  <th className="text-right" style={{ width: 120 }}>Credit</th>
                  <th className="text-right" style={{ width: 130, background: '#f0fdf4' }}>Balance</th>
                  <th style={{ width: 60 }} className="text-center">Void</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.entries.map((tx, i) => (
                  <motion.tr key={tx.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.025 }}
                    className="hover:bg-slate-50/60 transition-colors group">
                    <td>
                      <span className="font-medium text-[13px] text-slate-700 whitespace-nowrap">
                        {new Date(tx.entry_date).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-[13.5px] text-slate-800 truncate">{tx.description}</p>
                      {tx.reference && <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{tx.reference}</p>}
                    </td>
                    <td className="text-right font-mono text-[13px] font-semibold text-slate-700">
                      {tx.parsedDebit > 0 ? fmt(tx.parsedDebit) : ''}
                    </td>
                    <td className="text-right font-mono text-[13px] font-semibold text-slate-700">
                      {tx.parsedCredit > 0 ? fmt(tx.parsedCredit) : ''}
                    </td>
                    <td className="text-right font-mono font-extrabold text-[13px]" style={{ background: 'rgba(240,253,244,0.5)' }}>
                      <span className={parseFloat(tx.runningBalance) >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {fmt(tx.runningBalance)}
                      </span>
                    </td>
                    <td className="text-center">
                      <button onClick={() => handleVoid(tx.entry_id || tx.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
