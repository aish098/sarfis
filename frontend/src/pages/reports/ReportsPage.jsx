import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Calendar, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, 
  Calculator, Activity, PieChart, FileText, Zap, X, FileSpreadsheet, Printer, ArrowRight,
  Layers
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { jsPDF } from 'jspdf';
import InventoryValuationReport from './InventoryValuationReport';
import { exportUnifiedPDF, exportUnifiedCSV } from '../../utils/documentExporter';

const TABS = [
  { id: 'trial_balance', label: 'Trial Balance', icon: Calculator },
  { id: 'income_statement', label: 'Income Statement', icon: Activity },
  { id: 'balance_sheet', label: 'Balance Sheet', icon: PieChart },
  { id: 'cash_flow', label: 'Cash Flow', icon: FileText },
  { id: 'inventory_valuation', label: 'Inventory Valuation', icon: Layers },
];

const fmt = v => {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  return n < 0
    ? `($${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { activeCompany, settings } = useAuthStore();
  const currencyLabel = settings?.baseCurrency || 'PKR';

  const [tab, setTab] = useState('trial_balance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Financial Note Drawer States
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [selectedNoteAccount, setSelectedNoteAccount] = useState(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteData, setNoteData] = useState(null);
  const [noteError, setNoteError] = useState('');
  const [statementVersion, setStatementVersion] = useState('Draft');

  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
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
        inventory_valuation: { url: `/inventory/${activeCompany.id}/valuation-report`, params: { asOfDate } },
      };
      const { url, params } = endpointMap[tab];
      const res = await api.get(url, { params });
      setData(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to load report.'); }
    setLoading(false);
  }, [activeCompany, tab, startDate, endDate, asOfDate]);

  const openNoteDrawer = async (account) => {
    setSelectedNoteAccount(account);
    setNoteDrawerOpen(true);
    setNoteLoading(true);
    setNoteData(null);
    setNoteError('');
    try {
      const res = await api.get(`/reports/balance-sheet/note/${account.id}`, {
        params: { asOfDate }
      });
      setNoteData(res.data);
    } catch (err) {
      console.error(err);
      setNoteError('Failed to load note schedule.');
    } finally {
      setNoteLoading(false);
    }
  };

  const formatAmount = (v, isContra = false) => {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    const absVal = Math.abs(n);
    const formattedNum = absVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const stylePreference = settings?.negativeBalanceStyle || 'minus';

    if (n < 0 || (isContra && n > 0)) {
      const displayVal = n > 0 && isContra ? -n : n;
      const formattedAbs = Math.abs(displayVal).toLocaleString('en-US', { minimumFractionDigits: 2 });
      if (stylePreference === 'parentheses') {
        return `(${currencyLabel} ${formattedAbs})`;
      }
      if (stylePreference === 'red') {
        return <span className="text-rose-600 font-bold">-{currencyLabel} {formattedAbs}</span>;
      }
      return `-${currencyLabel} ${formattedAbs}`;
    }
    return `${currencyLabel} ${formattedNum}`;
  };

  const exportNoteToPDF = async () => {
    if (!noteData) return;
    const doc = new jsPDF();

    // Hex to RGB converter helper
    const hexToRgb = (hex) => {
      let c = hex.replace('#', '');
      if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      const num = parseInt(c, 16);
      return [num >> 16, (num >> 8) & 0x00ff, num & 0x0000ff];
    };
    const brandRgb = hexToRgb(settings?.accentColor || '#10b981');

    if (settings?.logoUrl) {
      const logoUrl = settings.logoUrl.startsWith('http') ? settings.logoUrl : `${import.meta.env.PROD ? window.location.origin : 'http://localhost:5001'}${settings.logoUrl}`;
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const maxWidth = 35;
            const maxHeight = 12;
            let width = maxWidth;
            let height = maxWidth / (img.width / img.height);
            
            if (height > maxHeight) {
              height = maxHeight;
              width = maxHeight * (img.width / img.height);
            }
            doc.addImage(img, 'PNG', 196 - width, 8, width, height);
          } catch (e) {
            console.error('Failed to draw logo on PDF:', e);
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoUrl;
      });
    }
    
    // 1. Company Name & Main Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(activeCompany?.name.toUpperCase() || 'ACCOUNTELLENCE FINANCIALS', 14, 20);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text('Notes to the Financial Statements', 14, 26);
    doc.text(`Financial Period: FY${new Date(asOfDate).getFullYear()} | Version: ${statementVersion.toUpperCase()}`, 14, 32);
    
    // Draw divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 36, 196, 36);

    // 2. Note Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    const noteNumStr = noteData.metadata.noteNumber ? `NOTE ${noteData.metadata.noteNumber}: ` : '';
    doc.text(`${noteNumStr}${noteData.account.name.toUpperCase()}`, 14, 44);

    // Draw divider line
    doc.line(14, 48, 196, 48);

    // 3. Carrying Summary Card Table
    const summaryData = [
      ['Opening Balance', `${currencyLabel} ${noteData.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Current Movements', `${currencyLabel} ${noteData.movements.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Closing Balance', `${currencyLabel} ${noteData.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]
    ];

    autoTable(doc, {
      startY: 52,
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3, fontStyle: 'bold' },
      columnStyles: {
        0: { textColor: [100, 116, 139], width: 60 },
        1: { halign: 'right', textColor: [30, 41, 59] }
      }
    });

    // 4. Reconciliation Status Card
    const reconciliationY = doc.lastAutoTable.finalY + 8;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('RECONCILIATION SUMMARY', 14, reconciliationY);

    const reconStatus = noteData.reconciliation.status === 'VERIFIED'
      ? `✓ VERIFIED (No differences detected between General Ledger and ${noteData.metadata.source})`
      : `⚠ DISCREPANCY DETECTED (Difference: ${currencyLabel} ${noteData.reconciliation.difference.toLocaleString('en-US', { minimumFractionDigits: 2 })})`;

    const reconRows = [
      ['Reconciliation Status', reconStatus],
      ['GL Control Balance', `${currencyLabel} ${noteData.reconciliation.ledgerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Sub-ledger Balance', `${currencyLabel} ${noteData.reconciliation.subledgerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]
    ];

    autoTable(doc, {
      startY: reconciliationY + 4,
      body: reconRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [100, 116, 139], width: 50 },
        1: { textColor: [30, 41, 59] }
      }
    });

    // 5. Supporting Schedule Breakdown Table
    const breakdownY = doc.lastAutoTable.finalY + 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('SUPPORTING SCHEDULE / COMPOSITION', 14, breakdownY);

    const breakdownRows = (noteData.breakdown || []).map(b => [
      b.item,
      `${currencyLabel} ${b.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `${b.percent}%`
    ]);

    autoTable(doc, {
      startY: breakdownY + 4,
      head: [['Item Name', 'Carrying Amount', 'Contribution %']],
      body: breakdownRows,
      theme: 'striped',
      headStyles: { fillColor: brandRgb, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' }
      }
    });

    // 6. Recent GL Postings
    const postingsY = doc.lastAutoTable.finalY + 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('RECENT GENERAL LEDGER POSTINGS', 14, postingsY);

    const journalRows = (noteData.journalEntries || []).map(je => [
      new Date(je.date).toLocaleDateString(),
      je.voucher_number ? `${je.voucher_type} #${je.voucher_number}` : je.description || 'Journal Entry',
      je.debit > 0 ? `${currencyLabel} ${je.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
      je.credit > 0 ? `${currencyLabel} ${je.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'
    ]);

    autoTable(doc, {
      startY: postingsY + 4,
      head: [['Date', 'Reference / Description', 'Debit', 'Credit']],
      body: journalRows,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    // Footer info
    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated Automatically by ACCOUNTELLENCE System on ${new Date(noteData.metadata.lastUpdated).toLocaleString()}`, 14, finalY);

    doc.save(`GL_Note_${noteData.account.code}_V${statementVersion}.pdf`);
  };

  useEffect(() => { load(); }, [load]);

  const handleClose = async () => {
    setClosing(true); setCloseResult(null);
    try {
      const res = await api.post(`/reports/close-period/${activeCompany.id}`, { endDate: closeDate, description: closeMemo });
      setCloseResult(res.data); load();
    } catch (err) { setError(err.response?.data?.message || 'Close period failed.'); }
    setClosing(false);
  };

  const handleExport = (exportType = 'pdf') => {
    if (!data) return;
    const activeLabel = TABS.find(t => t.id === tab)?.label || 'Financial Report';
    
    const formatLocalDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const periodStr = tab === 'balance_sheet' ? `As of ${formatLocalDate(asOfDate)}` : `${formatLocalDate(startDate)} to ${formatLocalDate(endDate)}`;
    const accountList = Array.isArray(data) ? data : (data?.items || []);

    let columns = [];
    let rows = [];
    let kpis = [];

    if (tab === 'trial_balance') {
      columns = ['Code', 'Account Name', 'Category', 'Debit (PKR)', 'Credit (PKR)'];
      const tbItems = accountList.map(acc => {
        const d = parseFloat(acc.total_debit || acc.debit || 0);
        const c = parseFloat(acc.total_credit || acc.credit || 0);
        const net = d - c;
        const finalDebit = net > 0 ? net : 0;
        const finalCredit = net < 0 ? Math.abs(net) : 0;
        return {
          code: acc.code || '—',
          name: acc.name || '—',
          category: acc.category || '—',
          finalDebit,
          finalCredit
        };
      }).filter(r => r.finalDebit > 0 || r.finalCredit > 0);

      const sumD = tbItems.reduce((s, r) => s + r.finalDebit, 0);
      const sumC = tbItems.reduce((s, r) => s + r.finalCredit, 0);

      kpis = [
        { label: 'TOTAL DEBIT', value: `PKR ${fmt(sumD)}`, color: 'emerald' },
        { label: 'TOTAL CREDIT', value: `PKR ${fmt(sumC)}`, color: 'rose' },
        { label: 'STATUS', value: Math.abs(sumD - sumC) < 0.01 ? 'BALANCED' : 'UNBALANCED', color: 'blue' }
      ];

      rows = [
        ...tbItems.map(i => [
          i.code,
          i.name,
          i.category,
          i.finalDebit > 0 ? fmt(i.finalDebit) : '—',
          i.finalCredit > 0 ? fmt(i.finalCredit) : '—'
        ]),
        ['Grand Totals', 'Summary', 'Total', fmt(sumD), fmt(sumC)]
      ];
    } else if (tab === 'income_statement') {
      columns = ['Account Code / Name', 'Category', 'Balance (PKR)'];
      const rev = accountList.filter(a => ['income', 'revenue'].includes(a.category?.toLowerCase() || a.type?.toLowerCase())).map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
      const exp = accountList.filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
      const totalRev = rev.reduce((s, r) => s + r.net, 0);
      const totalExp = exp.reduce((s, r) => s + r.net, 0);
      
      kpis = [
        { label: 'TOTAL REVENUE', value: `PKR ${fmt(totalRev)}`, color: 'emerald' },
        { label: 'TOTAL EXPENSES', value: `PKR ${fmt(totalExp)}`, color: 'rose' },
        { label: 'NET PROFIT', value: `PKR ${fmt(totalRev - totalExp)}`, color: 'blue' }
      ];

      rows = [
        ...rev.map(r => [r.name, 'Revenue', fmt(r.net)]),
        ['Total Revenue', 'Summary', fmt(totalRev)],
        ...exp.map(e => [e.name, 'Expense', fmt(e.net)]),
        ['Total Expenses', 'Summary', fmt(totalExp)],
        ['NET INCOME', 'Net Summary', fmt(totalRev - totalExp)]
      ];
    } else if (tab === 'balance_sheet') {
      columns = ['Account Name', 'Classification', 'Balance (PKR)'];
      const assets = accountList.filter(a => (a.category || a.type)?.toLowerCase() === 'asset').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
      const liabs = accountList.filter(a => (a.category || a.type)?.toLowerCase() === 'liability').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
      const equity = accountList.filter(a => (a.category || a.type)?.toLowerCase() === 'equity').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);

      const tA = assets.reduce((s,r)=>s+r.net,0);
      const tL = liabs.reduce((s,r)=>s+r.net,0);
      const tE = equity.reduce((s,r)=>s+r.net,0);

      kpis = [
        { label: 'TOTAL ASSETS', value: `PKR ${fmt(tA)}`, color: 'emerald' },
        { label: 'TOTAL LIABILITIES', value: `PKR ${fmt(tL)}`, color: 'rose' },
        { label: 'TOTAL EQUITY', value: `PKR ${fmt(tE)}`, color: 'blue' }
      ];

      rows = [
        ...assets.map(a => [a.name, 'Asset', fmt(a.net)]),
        ['Total Assets', 'Summary', fmt(tA)],
        ...liabs.map(l => [l.name, 'Liability', fmt(l.net)]),
        ['Total Liabilities', 'Summary', fmt(tL)],
        ...equity.map(e => [e.name, 'Equity', fmt(e.net)]),
        ['Total Equity', 'Summary', fmt(tE)]
      ];
    } else if (tab === 'cash_flow') {
      columns = ['Activity / Item Name', 'Classification', 'Amount (PKR)'];
      const operating = accountList.filter(r => ['income','revenue','expense'].includes((r.category || r.type)?.toLowerCase()));
      const investing = accountList.filter(r => (r.category || r.type)?.toLowerCase() === 'asset');
      const financing = accountList.filter(r => ['liability','equity'].includes((r.category || r.type)?.toLowerCase()));
      
      const netOperating = operating.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0);
      const netInvesting = investing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0);
      const netFinancing = financing.reduce((s,r)=>s+(parseFloat(r.magnitude)||0),0);

      kpis = [
        { label: 'OPERATING CASH', value: `PKR ${fmt(netOperating)}`, color: 'emerald' },
        { label: 'INVESTING CASH', value: `PKR ${fmt(netInvesting)}`, color: 'blue' },
        { label: 'FINANCING CASH', value: `PKR ${fmt(netFinancing)}`, color: 'rose' }
      ];

      rows = [
        ...operating.map(o => [o.name, 'Operating Activity', fmt(o.magnitude)]),
        ['Net Operating Cash Flow', 'Operating Summary', fmt(netOperating)],
        ...investing.map(i => [i.name, 'Investing Activity', fmt(i.magnitude)]),
        ['Net Investing Cash Flow', 'Investing Summary', fmt(netInvesting)],
        ...financing.map(f => [f.name, 'Financing Activity', fmt(f.magnitude)]),
        ['Net Financing Cash Flow', 'Financing Summary', fmt(netFinancing)]
      ];
    }

    const exportOptions = {
      title: activeLabel,
      companyName: activeCompany?.name || 'ACCOUNTELLENCE Corporate Workspace',
      period: periodStr,
      kpis,
      columns,
      rows,
      filename: `${(activeCompany?.name || 'Accountellence').replace(/\s+/g, '_')}_${tab}.${exportType === 'excel' ? 'csv' : 'pdf'}`
    };

    if (exportType === 'excel' || exportType === 'csv') {
      exportUnifiedCSV(exportOptions);
    } else {
      exportUnifiedPDF(exportOptions);
    }
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6]">
      <style>{`
        /* Hide scrollbar completely by default, only show when hovering and overflow exists */
        body .accountellence-scrollbar::-webkit-scrollbar {
          width: 0px !important;
          background: transparent !important;
        }
        body .accountellence-scrollbar:hover::-webkit-scrollbar {
          width: 5px !important;
        }
        body .accountellence-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
        }
        body .accountellence-scrollbar::-webkit-scrollbar-thumb {
          background: transparent !important;
          border-radius: 99px !important;
          transition: background 0.2s ease;
        }
        body .accountellence-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3) !important;
        }
        .accountellence-scrollbar {
          scrollbar-width: none !important;
        }
        .accountellence-scrollbar:hover {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(16, 185, 129, 0.3) transparent !important;
        }
      `}</style>

      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {/* Accountellence Logo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Zap size={18} className="text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">ACCOUNTELLENCE</h1>
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
            onClick={() => handleExport('pdf')}
            disabled={!data || loading}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white disabled:opacity-40 disabled:pointer-events-none px-4 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
          >
            <Download size={13} /> PDF
          </button>

          <button 
            type="button"
            onClick={() => handleExport('excel')}
            disabled={!data || loading}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 text-[12.5px] font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet size={13} /> Excel
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
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 xl:pb-0 accountellence-scrollbar">
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

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border-2 border-slate-100 shadow-sm focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/5">
              <Calendar size={14} className="text-slate-400 flex-shrink-0" />
              {tab === 'balance_sheet' || tab === 'inventory_valuation' ? (
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

            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border-2 border-slate-100 shadow-sm focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Version</span>
              <select
                value={statementVersion}
                onChange={e => setStatementVersion(e.target.value)}
                className="text-[13px] text-slate-700 border-none outline-none bg-transparent font-bold cursor-pointer text-slate-800"
              >
                <option value="Draft">Draft</option>
                <option value="Adjusted">Adjusted</option>
                <option value="Final">Final</option>
              </select>
            </div>
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
                {tab === 'balance_sheet' && <BalanceSheet data={data} companyName={activeCompany?.name} asOfDate={asOfDate} formatAmount={formatAmount} openNoteDrawer={openNoteDrawer} />}
                {tab === 'cash_flow' && <CashFlow data={data} companyName={activeCompany?.name} startDate={startDate} endDate={endDate} />}
                {tab === 'inventory_valuation' && <InventoryValuationReport data={data} asOfDate={asOfDate} companyName={activeCompany?.name} />}
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

      {/* Financial Notes Side Drawer */}
      <AnimatePresence>
        {noteDrawerOpen && selectedNoteAccount && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoteDrawerOpen(false)}
            />

            {/* Slide over Container */}
            <div className="absolute inset-y-0 right-0 max-w-xl w-full flex pl-10">
              <motion.div 
                className="w-full bg-white shadow-2xl flex flex-col h-full overflow-hidden border-l border-slate-100"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              >
                {/* Header */}
                <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <FileText size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-indigo-700 tracking-wider">Note supporting schedule</h3>
                      <h2 className="text-sm font-black text-slate-800 tracking-tight">{selectedNoteAccount.name}</h2>
                      <p className="text-[10px] text-slate-400 font-mono">GL Account: {selectedNoteAccount.code}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={exportNoteToPDF}
                      disabled={!noteData || noteLoading}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                      title="Export Note to PDF"
                    >
                      <Download size={15} />
                    </button>
                    <button 
                      onClick={() => setNoteDrawerOpen(false)} 
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-semibold text-slate-600">
                  {noteLoading ? (
                    <div className="p-16 text-center space-y-3">
                      <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                      <p className="text-slate-400">Loading note details...</p>
                    </div>
                  ) : noteError ? (
                    <div className="p-8 text-center text-rose-600">
                      <AlertTriangle size={24} className="mx-auto mb-2 text-rose-500" />
                      <p>{noteError}</p>
                    </div>
                  ) : noteData ? (
                    <div className="space-y-6">
                      {/* System Cross-Reference Card */}
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-3xs grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black mb-0.5">Source Registry</span>
                          <span className="font-extrabold text-slate-700">{noteData.metadata.source}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black mb-0.5">Generated By</span>
                          <span className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md text-[10.5px] inline-block font-mono">
                            {noteData.metadata.generated}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black mb-0.5">Generated On</span>
                          <span className="font-extrabold text-slate-700">
                            {new Date(noteData.metadata.lastUpdated).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black mb-0.5">Financial Period</span>
                          <span className="font-extrabold text-slate-700 font-mono">FY{new Date(asOfDate).getFullYear()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black mb-0.5">Supporting Records</span>
                          <span className="font-extrabold text-slate-700">{noteData.metadata.supportingRecordsCount} Items</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black mb-0.5">Report Version</span>
                          <span className={`font-extrabold text-[10px] px-1.5 py-0.5 rounded-md inline-block uppercase tracking-wider ${
                            statementVersion === 'Final'
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                              : statementVersion === 'Adjusted'
                              ? 'text-amber-700 bg-amber-50 border border-amber-200'
                              : 'text-slate-600 bg-slate-100 border border-slate-200'
                          }`}>
                            {statementVersion}
                          </span>
                        </div>
                      </div>

                      {/* Reconciliation Audit Panel */}
                      <div className={`p-4 rounded-xl border flex flex-col gap-2.5 shadow-3xs ${
                        noteData.reconciliation.status === 'VERIFIED'
                          ? 'bg-[#EBFDF5] border-[#C2F3DC] text-[#064E3B]'
                          : noteData.reconciliation.status === 'WARNING'
                          ? 'bg-amber-50/50 border-amber-200 text-amber-800'
                          : noteData.reconciliation.status === 'MISMATCH'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-black text-[12px] uppercase tracking-wider">
                            {noteData.reconciliation.status === 'VERIFIED' ? (
                              <><CheckCircle2 size={15} className="text-emerald-600" /> <span>✓ Verified</span></>
                            ) : noteData.reconciliation.status === 'WARNING' ? (
                              <><AlertTriangle size={15} className="text-amber-500 animate-pulse" /> <span>⚠ Variance Warning</span></>
                            ) : noteData.reconciliation.status === 'MISMATCH' ? (
                              <><ShieldAlert size={15} className="text-rose-600 animate-pulse" /> <span className="font-black">⚠ Discrepancy Alert</span></>
                            ) : (
                              <span>Reconciliation N/A</span>
                            )}
                          </div>
                          <span className="font-mono font-black text-[12px]">
                            {noteData.reconciliation.status === 'VERIFIED' ? 'No Differences' : `Diff: ${formatAmount(noteData.reconciliation.difference)}`}
                          </span>
                        </div>
                        
                        {/* Diagnostics & Possible Causes */}
                        <div className="text-[11px] font-medium leading-relaxed opacity-95 pl-5 space-y-1">
                          {noteData.reconciliation.reasons?.map((reason, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-[12px] leading-none select-none text-slate-400 font-bold">•</span>
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black">Opening Balance</span>
                          <span className="font-mono text-slate-700 font-black text-[13px]">
                            {formatAmount(noteData.openingBalance)}
                          </span>
                        </div>
                        <div className="bg-indigo-50/30 border border-indigo-100 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                          <span className="text-[9px] uppercase tracking-wider text-indigo-500 block font-black">Period Movement</span>
                          <span className="font-mono text-indigo-700 font-black text-[13px]">
                            {noteData.movements > 0 ? '+' : ''}{formatAmount(noteData.movements)}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center space-y-1 shadow-2xs">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black">Closing Balance</span>
                          <span className="font-mono text-slate-800 font-black text-[13px]">
                            {formatAmount(noteData.closingBalance)}
                          </span>
                        </div>
                      </div>

                      {/* Supporting Schedule Breakdown Table */}
                      <div className="space-y-2">
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-wider text-indigo-600 flex items-center justify-between">
                          <span>Supporting Schedule / Composition</span>
                          <span className="text-[9px] text-slate-400 capitalize normal-case font-normal font-sans">
                            Breakdown by {noteData.account.name.toLowerCase().includes('depreciation') ? 'Asset Cards' : 'Incidents & Details'}
                          </span>
                        </h4>
                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                              <tr className="border-b border-slate-100">
                                <th className="px-3 py-2">Item Description</th>
                                <th className="px-3 py-2 text-right">Carrying Amount</th>
                                <th className="px-3 py-2 text-center" style={{ width: 80 }}>% Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[11px] font-semibold text-slate-600 bg-white">
                              {noteData.breakdown?.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-2">
                                    {item.drilldownType === 'asset' ? (
                                      <button 
                                        onClick={() => { setNoteDrawerOpen(false); navigate(`/dashboard/fixed-assets/register?assetId=${item.drilldownId}`); }}
                                        className="text-left font-black text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        {item.item} <ArrowRight size={10} />
                                      </button>
                                    ) : item.drilldownType === 'client' ? (
                                      <button 
                                        onClick={() => { setNoteDrawerOpen(false); navigate('/dashboard/crm'); }}
                                        className="text-left font-black text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        {item.item} <ArrowRight size={10} />
                                      </button>
                                    ) : (
                                      <span>{item.item}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                                    {formatAmount(item.amount)}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono text-slate-500 font-bold">
                                    {item.percent}%
                                  </td>
                                </tr>
                              ))}
                              {(!noteData.breakdown || noteData.breakdown.length === 0) && (
                                <tr>
                                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">No breakdown details resolved.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Recent Journal Entries postings */}
                      <div className="space-y-2">
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-wider text-indigo-600">
                          Recent General Ledger Postings
                        </h4>
                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                              <tr className="border-b border-slate-100">
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Reference / Description</th>
                                <th className="px-3 py-2 text-right">Debit</th>
                                <th className="px-3 py-2 text-right">Credit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[10.5px] font-semibold text-slate-500 bg-white">
                              {noteData.journalEntries?.map((je, idx) => (
                                <tr key={je.journal_entry_id || idx} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                                    {new Date(je.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2 max-w-xs truncate" title={je.description}>
                                    {je.voucher_id ? (
                                      <button 
                                        onClick={() => { setNoteDrawerOpen(false); navigate(`/dashboard/vouchers/details/${je.voucher_id}`); }}
                                        className="text-left font-black text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer font-sans"
                                      >
                                        {je.voucher_number ? `${je.voucher_type} #${je.voucher_number}` : je.description || 'Journal Entry'} <ArrowRight size={10} />
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-1.5 font-sans">
                                        <span className="text-slate-700 font-bold">{je.description || 'Manual Journal Entry'}</span>
                                        <span className="text-[9px] bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-slate-500 font-mono select-none font-black" title="No voucher linked">Manual</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-emerald-600">
                                    {je.debit > 0 ? formatAmount(je.debit) : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-rose-600">
                                    {je.credit > 0 ? formatAmount(je.credit) : '—'}
                                  </td>
                                </tr>
                              ))}
                              {(!noteData.journalEntries || noteData.journalEntries.length === 0) && (
                                <tr>
                                  <td colSpan={4} className="px-3 py-4 text-center text-slate-400 italic">No postings found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrialBalance({ data }) {
  if (!data || !Array.isArray(data)) return <Empty />;
  const rows = data.map(acc => {
    const d = parseFloat(acc.total_debit) || 0, c = parseFloat(acc.total_credit) || 0, net = d - c;
    return { ...acc, finalDebit: net > 0 ? net : 0, finalCredit: net < 0 ? Math.abs(net) : 0 };
  }).filter(r => r.finalDebit > 0 || r.finalCredit > 0);
  const sumD = rows.reduce((s, r) => s + r.finalDebit, 0);
  const sumC = rows.reduce((s, r) => s + r.finalCredit, 0);
  const balanced = Math.abs(sumD - sumC) < 0.01;
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-6 accountellence-scrollbar">
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
  const items = Array.isArray(data) ? data : (data.items || []);
  const rev = items.filter(a => ['income', 'revenue'].includes((a.category || a.type)?.toLowerCase())).map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
  const exp = items.filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
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

function BalanceSheet({ data, companyName, asOfDate, formatAmount, openNoteDrawer }) {
  if (!data) return <Empty />;
  const items = Array.isArray(data) ? data : (data.items || []);
  const assets = items.filter(a => (a.category || a.type)?.toLowerCase() === 'asset').map(a => ({ ...a, net: parseFloat(a.total_debit || 0) - parseFloat(a.total_credit || 0) })).filter(a => Math.abs(a.net) > 0);
  const liabs = items.filter(a => (a.category || a.type)?.toLowerCase() === 'liability').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
  const equity = items.filter(a => (a.category || a.type)?.toLowerCase() === 'equity').map(a => ({ ...a, net: parseFloat(a.total_credit || 0) - parseFloat(a.total_debit || 0) })).filter(a => Math.abs(a.net) > 0);
  
  const revLines = items.filter(a => ['income','revenue'].includes((a.category || a.type)?.toLowerCase())).map(a => parseFloat(a.total_credit||0)-parseFloat(a.total_debit||0));
  const expLines = items.filter(a => (a.category || a.type)?.toLowerCase() === 'expense').map(a => parseFloat(a.total_debit||0)-parseFloat(a.total_credit||0));
  const ytd = revLines.reduce((s,n)=>s+n,0) - expLines.reduce((s,n)=>s+n,0);
  if (Math.abs(ytd) > 0.001) equity.push({ id: 'ytd', name: 'Current Year Earnings', net: ytd });
  
  const tA = assets.reduce((s,r)=>s+r.net,0);
  const tL = liabs.reduce((s,r)=>s+r.net,0);
  const tE = equity.reduce((s,r)=>s+r.net,0);
  const balanced = Math.abs(tA - (tL + tE)) < 0.01;

  // Filter Assets and Liabilities by classification (default to Current if not set or NOT_APPLICABLE)
  const currentAssets = assets.filter(a => a.current_classification !== 'NON_CURRENT');
  const nonCurrentAssets = assets.filter(a => a.current_classification === 'NON_CURRENT');
  const tCA = currentAssets.reduce((s,r)=>s+r.net,0);
  const tNCA = nonCurrentAssets.reduce((s,r)=>s+r.net,0);

  const currentLiabs = liabs.filter(a => a.current_classification !== 'NON_CURRENT');
  const nonCurrentLiabs = liabs.filter(a => a.current_classification === 'NON_CURRENT');
  const tCL = currentLiabs.reduce((s,r)=>s+r.net,0);
  const tNCL = nonCurrentLiabs.reduce((s,r)=>s+r.net,0);

  const RenderSubSection = ({ title, items, total }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-2 pl-1">{title}</div>
        <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-[#E6EBE8] bg-white shadow-xs">
          {items.map((r, idx) => (
            <div 
              key={r.id || idx} 
              className={`flex justify-between items-center py-2.5 px-3 text-slate-700 transition-all font-semibold text-[13px] hover:bg-slate-50/50 ${
                idx % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAFAF9]'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={r.is_contra ? 'ml-4 text-slate-400 font-bold' : 'text-slate-800'}>
                    {r.is_contra ? 'Less: ' : ''}{r.name}
                  </span>
                  {r.noteMeta && (
                    <button 
                      onClick={() => openNoteDrawer(r)}
                      className={`text-[9px] px-2 py-0.5 rounded font-black transition-all cursor-pointer select-none border flex items-center gap-1 ${
                        r.noteMeta.reconciliationStatus === 'VERIFIED'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          : r.noteMeta.reconciliationStatus === 'WARNING'
                          ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                          : r.noteMeta.reconciliationStatus === 'MISMATCH'
                          ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 animate-pulse font-extrabold'
                          : 'text-slate-655 bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`${r.noteMeta.label} (${r.noteMeta.reconciliationStatus})`}
                    >
                      📄 Note {r.noteMeta.num}
                    </button>
                  )}
                </div>
                {r.noteMeta && (
                  <span className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1.5 pl-0">
                    <span>{r.noteMeta.supportingRecordsCount} Items</span>
                    <span className="text-slate-200">•</span>
                    <span>Updated {new Date(r.noteMeta.lastUpdated).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
                    <span className="text-slate-200">•</span>
                    <span className={`font-bold uppercase text-[8px] tracking-wider ${
                      r.noteMeta.reconciliationStatus === 'VERIFIED'
                        ? 'text-emerald-600'
                        : r.noteMeta.reconciliationStatus === 'WARNING'
                        ? 'text-amber-505'
                        : r.noteMeta.reconciliationStatus === 'MISMATCH'
                        ? 'text-rose-500 font-black'
                        : 'text-slate-400'
                    }`}>
                      {r.noteMeta.reconciliationStatus === 'VERIFIED' ? '✓ Verified' : r.noteMeta.reconciliationStatus === 'WARNING' ? '⚠ Warning' : '⚠ Mismatch'}
                    </span>
                  </span>
                )}
              </div>
              <span className={`font-mono font-bold ${r.is_contra ? 'text-slate-500' : 'text-slate-800'}`}>
                {formatAmount(r.net, r.is_contra)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-1.5 px-3 py-1.5 rounded-lg font-bold text-[12px] bg-slate-50 text-slate-650 border border-slate-100">
          <span className="uppercase tracking-wider text-[9px] font-bold">Total {title}</span>
          <span className="font-mono">{formatAmount(total)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!balanced && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-[12px] font-bold text-rose-700 text-center uppercase tracking-wider flex items-center justify-center gap-2">
          <AlertTriangle size={14} className="text-rose-600 animate-pulse" />
          <span>Balance Sheet Imbalance Detected</span>
        </div>
      )}
      
      <div className="text-center pb-6 border-b-2 border-[#10b981]/20">
        <p className="stmt-company text-slate-800 font-black text-lg uppercase tracking-tight">{companyName}</p>
        <p className="stmt-title mt-1 font-display font-extrabold text-slate-700">Balance Sheet</p>
        <p className="text-[12px] text-slate-400 mt-1 font-semibold">As of {asOfDate}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="stmt-section-header border-l-4 pl-2 font-extrabold text-[13px] mb-3 border-emerald-500 text-emerald-800 uppercase tracking-wider">
            Assets
          </div>
          
          <div className="space-y-4 pl-2">
            <RenderSubSection 
              title="Current Assets" 
              items={currentAssets} 
              total={tCA} 
            />
            <RenderSubSection 
              title="Non-Current Assets" 
              items={nonCurrentAssets} 
              total={tNCA} 
            />
          </div>

          <div className="flex justify-between items-center mt-4 px-3 py-2.5 rounded-xl font-black text-[13.5px] border bg-[#EBFDF5] border-[#C2F3DC] text-[#064E3B]">
            <span className="uppercase tracking-wider text-[10px] font-black">Total Assets</span>
            <span className="font-mono font-black text-[15px]">{formatAmount(tA)}</span>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <div className="stmt-section-header border-l-4 pl-2 font-extrabold text-[13px] mb-3 border-cyan-500 text-cyan-800 uppercase tracking-wider">
              Liabilities
            </div>
            
            <div className="space-y-4 pl-2">
              <RenderSubSection 
                title="Current Liabilities" 
                items={currentLiabs} 
                total={tCL} 
              />
              <RenderSubSection 
                title="Non-Current Liabilities" 
                items={nonCurrentLiabs} 
                total={tNCL} 
              />
            </div>

            <div className="flex justify-between items-center mt-4 px-3 py-2.5 rounded-xl font-black text-[13.5px] border bg-cyan-50 border-cyan-100 text-cyan-900">
              <span className="uppercase tracking-wider text-[10px] font-black">Total Liabilities</span>
              <span className="font-mono font-black text-[15px]">{formatAmount(tL)}</span>
            </div>
          </div>
          
          <div>
            <div className="stmt-section-header border-l-4 pl-2 font-extrabold text-[13px] mb-3 border-emerald-500 text-emerald-800 uppercase tracking-wider">
              Equity
            </div>
            
            <div className="space-y-4 pl-2">
              <RenderSubSection 
                title="Equity Capital" 
                items={equity} 
                total={tE} 
              />
            </div>

            <div className="flex justify-between items-center mt-4 px-3 py-2.5 rounded-xl font-black text-[13.5px] border bg-[#EBFDF5] border-[#C2F3DC] text-[#064E3B]">
              <span className="uppercase tracking-wider text-[10px] font-black">Total Equity</span>
              <span className="font-mono font-black text-[15px]">{formatAmount(tE)}</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] text-white shadow-md shadow-emerald-500/10 p-4 rounded-xl flex justify-between items-center mt-6">
            <span className="font-display font-extrabold uppercase tracking-widest text-[12px] text-emerald-50">Total L & E</span>
            <span className="font-mono font-black text-[18px] text-white">{formatAmount(tL + tE)}</span>
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
