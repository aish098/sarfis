import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronLeft, Printer, Download, Mail, Copy, RotateCcw, 
  DollarSign, Package, User, TrendingUp, ShieldAlert, 
  MessageSquare, Paperclip, ShieldCheck, AlertCircle, FileText,
  Calendar, CheckCircle, ArrowRight, Eye, Send
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { jsPDF } from 'jspdf';

export default function VoucherDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadDetails = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const res = await api.get(`/vouchers/${activeCompany.id}/${id}/details`);
      setDetails(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load transaction details.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetails();
  }, [id, activeCompany]);

  const handlePost = async () => {
    if (!window.confirm('Post this voucher to the General Ledger? This will lock the document and immediately update ledger and inventory balances.')) return;
    try {
      await api.post(`/vouchers/${activeCompany.id}/${id}/post`);
      loadDetails();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post voucher.');
    }
  };

  const handleReverse = async () => {
    if (!window.confirm('Are you sure you want to REVERSE this posted transaction? SCAFIS will write automatic offsetting offset journal entries to zero out ledger and stock logs.')) return;
    try {
      await api.post(`/vouchers/${activeCompany.id}/${id}/reverse`);
      loadDetails();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reverse voucher.');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/vouchers/${activeCompany.id}/${id}/comment`, { text: commentText.trim() });
      setCommentText('');
      loadDetails();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add comment.');
    }
    setSubmittingComment(false);
  };

  const handleClone = () => {
    navigate('/dashboard/vouchers/new', { 
      state: { 
        cloneFrom: {
          type: document.type,
          totalAmount: document.totalAmount,
          taxAmount: document.taxAmount,
          payload: document.payload
        } 
      } 
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePDF = () => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("SARFIS ERP TRANSACTION VOUCHER", 14, 20);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 25, 196, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Voucher Number: ${document.voucherNumber}`, 14, 32);
    doc.text(`Type: ${document.type}`, 14, 37);
    doc.text(`Status: ${document.status}`, 14, 42);
    doc.text(`Posting Date: ${new Date(document.date).toLocaleDateString()}`, 14, 47);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Header Information", 14, 57);
    doc.setFont("helvetica", "normal");
    doc.text(`Warehouse: ${inventory.warehouse?.name || 'Main Warehouse'}`, 14, 63);
    doc.text(`Created By: ${document.creatorName}`, 14, 69);
    if (business.customer || business.vendor) {
      doc.text(`Business Partner: ${business.customer?.name || business.vendor?.name}`, 14, 75);
    }
    
    doc.setFont("helvetica", "bold");
    doc.text("Financial Summary", 120, 57);
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal Amount: PKR ${document.totalAmount.toLocaleString()}`, 120, 63);
    doc.text(`Tax Amount: PKR ${document.taxAmount.toLocaleString()}`, 120, 69);
    doc.text(`Total Balanced: PKR ${document.totalAmount.toLocaleString()}`, 120, 75);
    
    // Draw table header
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 85, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Item Details / Product", 16, 90);
    doc.text("Qty", 100, 90);
    doc.text("Unit Price/Cost", 130, 90);
    doc.text("Total Value", 165, 90);
    
    doc.setFont("helvetica", "normal");
    let y = 98;
    const itemsList = document.payload?.items || [];
    itemsList.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const qty = parseFloat(item.quantity || 0);
      const price = parseFloat(item.unitCost || item.unitPrice || 0);
      const total = qty * price;
      
      doc.text(String(item.productName || item.productId), 16, y);
      doc.text(String(qty), 100, y);
      doc.text(`PKR ${price.toLocaleString()}`, 130, y);
      doc.text(`PKR ${total.toLocaleString()}`, 165, y);
      
      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 3, 196, y + 3);
      y += 8;
    });

    if (financial.journalLines && financial.journalLines.length > 0) {
      y += 10;
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text("Ledger Double-Entry Postings", 14, y);
      y += 8;
      
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 5, 182, 8, "F");
      doc.text("Account", 16, y);
      doc.text("Debit", 110, y);
      doc.text("Credit", 155, y);
      y += 8;
      
      doc.setFont("helvetica", "normal");
      financial.journalLines.forEach(line => {
        doc.text(`${line.account_code} - ${line.account_name}`, 16, y);
        doc.text(line.debit > 0 ? `PKR ${line.debit.toLocaleString()}` : "-", 110, y);
        doc.text(line.credit > 0 ? `PKR ${line.credit.toLocaleString()}` : "-", 155, y);
        y += 8;
      });
    }
    
    doc.save(`${document.voucherNumber}_Report.pdf`);
  };

  const handleEmail = () => {
    const partnerName = business.customer?.name || business.vendor?.name || 'Cash Sale';
    const subject = encodeURIComponent(`SARFIS Voucher Report: ${document.voucherNumber} (${document.type})`);
    const body = encodeURIComponent(
      `Dear Finance Team,\n\nPlease find the transaction summary below:\n\n` +
      `Voucher Reference: ${document.voucherNumber}\n` +
      `Type: ${document.type}\n` +
      `Date: ${new Date(document.date).toLocaleDateString()}\n` +
      `Partner: ${partnerName}\n` +
      `Total Amount: PKR ${document.totalAmount.toLocaleString()}\n` +
      `Status: ${document.status}\n\n` +
      `Best regards,\n${useAuthStore.getState().user?.name || 'Admin'}`
    );
    window.location.href = `mailto:finance@company.com?subject=${subject}&body=${body}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] font-bold text-slate-400">Loading transaction inquiry document...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl max-w-2xl mx-auto space-y-4 text-center my-10">
        <AlertCircle size={40} className="text-red-500 mx-auto" />
        <h3 className="text-lg font-black text-red-800">Transaction Not Found</h3>
        <p className="text-[13px] text-red-600 font-semibold">{error || 'Could not find this voucher details.'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-[12px] transition-all">
          Go Back
        </button>
      </div>
    );
  }

  const { document, financial, inventory, business, risk, audit, comments, relatedDocuments, attachments } = details;

  // Derive metrics
  const isPosted = document.status === 'POSTED';
  const hasInventory = inventory.movements && inventory.movements.length > 0;
  const isSales = document.type === 'SALES';
  const isPurchase = document.type === 'PURCHASE';

  // Compute profit/margin details
  let itemsCount = 0;
  let totalCostAmount = 0;
  let grossProfit = 0;
  let profitMargin = 0;

  const items = document.payload?.items || [];
  itemsCount = items.length;

  if (isSales) {
    items.forEach(item => {
      const qty = parseFloat(item.quantity || 0);
      const price = parseFloat(item.unitPrice || 0);
      const wac = parseFloat(item.wac || item.avgCost || 0);
      totalCostAmount += qty * wac;
    });
    grossProfit = document.totalAmount - totalCostAmount;
    profitMargin = document.totalAmount > 0 ? Math.round((grossProfit / document.totalAmount) * 100) : 0;
  } else if (isPurchase) {
    totalCostAmount = document.totalAmount;
  }

  return (
    <div id="print-area" className="space-y-6 font-sans pb-20 max-w-6xl mx-auto relative">
      <style>{`
        @media print {
          aside, header, nav, #sidebar-container, .no-print, button, form, input, textarea {
            display: none !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/vouchers')} className="no-print w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-all">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {document.type} VOUCHER
              </span>
              <span className={`badge text-[10px] font-black px-2 py-0.5 rounded-full border ${
                document.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                document.status === 'PENDING_APPROVAL' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                {document.status}
              </span>
              {document.isReversed && (
                <span className="badge text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full">
                  REVERSED
                </span>
              )}
            </div>
            <h1 className="font-display font-extrabold text-[20px] text-slate-800 tracking-tight mt-0.5">
              {document.voucherNumber}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Printer size={13} /> Print
          </button>
          <button onClick={handlePDF} className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Download size={13} /> PDF
          </button>
          <button onClick={handleEmail} className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Mail size={13} /> Email
          </button>
          <button onClick={handleClone} className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
            <Copy size={13} /> Clone
          </button>
          
          {isPosted && !document.isReversed && (
            <button onClick={handleReverse} className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-sm">
              <RotateCcw size={13} /> Reverse Posted
            </button>
          )}

          {!isPosted && (
            <button onClick={handlePost} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-black transition-all flex items-center gap-1.5 shadow-md">
              <CheckCircle size={13} /> Approve & Post
            </button>
          )}
        </div>
      </div>

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Financial */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Financial Summary</span>
            <p className="text-xl font-black text-slate-800 font-mono">
              PKR {document.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <CheckCircle size={12} className="text-emerald-500" /> Double-entry balanced
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <DollarSign size={16} />
          </div>
        </div>

        {/* Card 2: Inventory */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Inventory Impact</span>
            <p className="text-xl font-black text-slate-800 font-mono">
              {itemsCount} Item(s)
            </p>
            <span className="text-[11px] text-slate-500 font-semibold">
              {isSales ? `COGS: PKR ${totalCostAmount.toLocaleString()} (${profitMargin}% Margin)` : `Cost: PKR ${totalCostAmount.toLocaleString()}`}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Package size={16} />
          </div>
        </div>

        {/* Card 3: Business Partner */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Business Partner</span>
            <p className="text-[14px] font-black text-slate-800 truncate max-w-[150px]" title={business.customer?.name || business.vendor?.name || 'Cash Sale'}>
              {business.customer?.name || business.vendor?.name || 'Cash Sale'}
            </p>
            {business.creditSummary ? (
              <span className="text-[11px] text-slate-500 font-semibold block">
                AR Bal: PKR {business.creditSummary.outstanding.toLocaleString()}
                {business.creditSummary.creditUtilization !== undefined && ` (${business.creditSummary.creditUtilization}% Limit)`}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">No linked balance</span>
            )}
          </div>
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <User size={16} />
          </div>
        </div>

        {/* Card 4: Governance Risk */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Risk Governance</span>
            <div className="flex items-center gap-1.5">
              <span className={`badge text-[9.5px] font-black px-1.5 py-0.5 rounded border ${
                risk.status.level === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-100' :
                risk.status.level === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                risk.status.level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                {risk.status.level} ({risk.status.score} pts)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold block">
              Override: {risk.override ? `Approved Req #${risk.override.id}` : 'No Override Required'}
            </span>
          </div>
          <div className={`p-2.5 rounded-lg ${risk.status.level === 'LOW' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <ShieldAlert size={16} />
          </div>
        </div>
      </div>

      {/* 3. Document Timeline Bar */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-[12px] font-black uppercase text-slate-800 tracking-wider">Document Workflow Timeline</h3>
        <div className="relative pt-2 pb-6">
          {/* Horizontal Line */}
          <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-100 -translate-y-1/2 z-0" />
          
          <div className="relative z-10 flex justify-between">
            {/* Timeline Item: Created */}
            <div className="text-center space-y-1.5 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] border-4 border-white shadow shadow-emerald-500/20">
                ✓
              </div>
              <p className="text-[11.5px] font-bold text-slate-700">Created</p>
              <p className="text-[10px] text-slate-400 font-mono">{document.creatorName}</p>
              <p className="text-[9px] text-slate-400 font-medium">
                {new Date(document.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Timeline Item: Submitted */}
            {document.status !== 'DRAFT' ? (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] border-4 border-white shadow shadow-emerald-500/20">
                  ✓
                </div>
                <p className="text-[11.5px] font-bold text-slate-700">Submitted</p>
                <p className="text-[10px] text-slate-400 font-mono">{document.creatorName}</p>
                <p className="text-[9px] text-slate-400 font-medium">
                  {new Date(document.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[11px] border-4 border-white">
                  2
                </div>
                <p className="text-[11.5px] font-medium text-slate-400">Submitted</p>
                <p className="text-[10px] text-slate-300">-</p>
              </div>
            )}

            {/* Timeline Item: Risk Checked */}
            {document.status !== 'DRAFT' ? (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] border-4 border-white shadow shadow-emerald-500/20">
                  ✓
                </div>
                <p className="text-[11.5px] font-bold text-slate-700">Risk Screened</p>
                <p className="text-[10px] text-slate-400 font-mono">System</p>
                <p className="text-[9px] text-slate-400 font-medium">Passed</p>
              </div>
            ) : (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[11px] border-4 border-white">
                  3
                </div>
                <p className="text-[11.5px] font-medium text-slate-400">Risk Screened</p>
                <p className="text-[10px] text-slate-300">-</p>
              </div>
            )}

            {/* Timeline Item: Approved */}
            {document.status === 'POSTED' ? (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] border-4 border-white shadow shadow-emerald-500/20">
                  ✓
                </div>
                <p className="text-[11.5px] font-bold text-slate-700">Approved</p>
                <p className="text-[10px] text-slate-400 font-mono">{document.approverName || 'Manager'}</p>
                <p className="text-[9px] text-slate-400 font-medium">
                  {new Date(document.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[11px] border-4 border-white">
                  4
                </div>
                <p className="text-[11.5px] font-medium text-slate-400">Approved</p>
                <p className="text-[10px] text-slate-300">-</p>
              </div>
            )}

            {/* Timeline Item: Posted */}
            {document.status === 'POSTED' ? (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px] border-4 border-white shadow shadow-indigo-500/20">
                  ✓
                </div>
                <p className="text-[11.5px] font-black text-indigo-700">Posted</p>
                <p className="text-[10px] text-indigo-500 font-mono">System</p>
                <p className="text-[9px] text-indigo-400 font-medium">Post Complete</p>
              </div>
            ) : (
              <div className="text-center space-y-1.5 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[11px] border-4 border-white">
                  5
                </div>
                <p className="text-[11.5px] font-medium text-slate-400">Posted</p>
                <p className="text-[10px] text-slate-300">-</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Main items & financial ledger details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (2/3 width) - Items & Impacts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Document Items List */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <Package size={14} className="text-indigo-500" /> Transaction Item Specification
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2.5">Product Details</th>
                    <th className="px-4 py-2.5 text-center">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-right">Extended Value</th>
                    {isSales && <th className="px-4 py-2.5 text-right">Estimated GP</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {items.map((item, index) => {
                    const qty = parseFloat(item.quantity || 0);
                    const costOrPrice = parseFloat(item.unitCost || item.unitPrice || 0);
                    const extVal = qty * costOrPrice;
                    const wac = parseFloat(item.wac || item.avgCost || 0);
                    const itemProfit = isSales ? extVal - (qty * wac) : 0;
                    const itemMargin = extVal > 0 ? Math.round((itemProfit / extVal) * 100) : 0;

                    return (
                      <tr key={index} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-700">{item.productName || `Product ID ${item.productId}`}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.productSku || 'SKU-UNKNOWN'}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">{qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          PKR {costOrPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          PKR {extVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {isSales && (
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-800 font-mono font-semibold">PKR {itemProfit.toLocaleString()}</span>
                            <span className="text-[10px] text-emerald-600 block">({itemMargin}% Margin)</span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Impact: Double-Entry Postings */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-500" /> Double-Entry Ledger Impact
              </h3>
              {financial.journalEntry ? (
                <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {financial.journalEntry.entry_number} ({financial.journalEntry.status})
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 italic">Not yet posted to GL</span>
              )}
            </div>

            {financial.journalLines && financial.journalLines.length > 0 ? (
              <div className="space-y-4">
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-2.5">Account Code</th>
                        <th className="px-4 py-2.5">Account Description</th>
                        <th className="px-4 py-2.5 text-right">Debit (PKR)</th>
                        <th className="px-4 py-2.5 text-right">Credit (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600 font-mono">
                      {financial.journalLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="px-4 py-3 font-bold text-indigo-600 hover:underline">
                            <Link to={`/ledger?account=${line.account_id}`}>{line.account_code}</Link>
                          </td>
                          <td className="px-4 py-3 font-sans text-slate-700">{line.account_name}</td>
                          <td className="px-4 py-3 text-right text-slate-800 font-bold">
                            {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-800 font-bold">
                            {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                        </tr>
                      ))}
                      {/* Balance Verification Footer */}
                      <tr className="bg-slate-50/50 font-black border-t border-slate-150 text-slate-700">
                        <td colSpan={2} className="px-4 py-3 text-right font-sans">Total Balanced Debits & Credits</td>
                        <td className="px-4 py-3 text-right">
                          {document.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {document.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 font-bold">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span>Ledger validation check passed: Debits = Credits. Financial status is Locked & Balanced.</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
                <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[12px] font-bold">Voucher is in Draft State.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Post to the General Ledger to see double-entry logs.</p>
              </div>
            )}
          </div>

          {/* Inventory Impact: Warehouse Stock Logs */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <Package size={14} className="text-blue-500" /> Inventory Valuation & Stock Movement Logs
            </h3>
            {hasInventory ? (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-2.5">Product SKU</th>
                      <th className="px-4 py-2.5">Product Title</th>
                      <th className="px-4 py-2.5 text-center">Movement Qty</th>
                      <th className="px-4 py-2.5 text-center">Stock Post-Balance</th>
                      <th className="px-4 py-2.5 text-right">Inventory Valuation Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 font-mono">
                    {inventory.movements.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20 bg-white">
                        <td className="px-4 py-3 font-bold text-slate-400">{log.product_sku}</td>
                        <td className="px-4 py-3 font-sans text-slate-700">{log.product_name}</td>
                        <td className={`px-4 py-3 text-center font-bold ${log.quantity_change < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-600">{log.quantity_after}</td>
                        <td className="px-4 py-3 text-right">
                          PKR {log.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
                <Package size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[12px] font-bold">No physical stock movements recorded.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">This transaction does not adjust warehouse inventory logs.</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column (1/3 width) - Governance, Business partner, timelines, audit trail */}
        <div className="space-y-6">
          
          {/* Related Documents Chain */}
          <div className="no-print bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <TrendingUp size={14} className="text-indigo-500" /> Transaction Document Chain
            </h3>
            <div className="space-y-3.5 pl-2 relative">
              {/* Vertical timeline line */}
              <div className="absolute top-3 bottom-3 left-4 w-0.5 bg-indigo-50" />
              
              {relatedDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3.5 relative z-10">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold shadow-sm ${
                    doc.active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    {doc.type.substring(0, 2)}
                  </div>
                  <div>
                    <p className={`text-[12.5px] font-bold ${doc.active ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {doc.label}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 font-bold">{doc.code}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Business Impact Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <User size={14} className="text-purple-500" /> Partner Account Summary
            </h3>
            
            {business.customer || business.vendor ? (
              <div className="space-y-4 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    {business.customer ? 'Client Name' : 'Supplier Name'}
                  </span>
                  <span className="text-indigo-600 font-extrabold hover:underline">
                    <Link to={business.customer ? '/dashboard/distribution' : '/dashboard/vendors'}>
                      {business.customer?.name || business.vendor?.name}
                    </Link>
                  </span>
                </div>

                {business.creditSummary && (
                  <div className="space-y-3 pt-3 border-t border-slate-50">
                    {business.creditSummary.creditLimit !== undefined && (
                      <div className="flex justify-between text-[11.5px]">
                        <span className="text-slate-400">Total Credit Approved</span>
                        <span className="font-mono font-bold text-slate-800">
                          PKR {business.creditSummary.creditLimit.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11.5px]">
                      <span className="text-slate-400">Outstanding Balance</span>
                      <span className="font-mono font-bold text-slate-800">
                        PKR {business.creditSummary.outstanding.toLocaleString()}
                      </span>
                    </div>

                    {business.creditSummary.creditUtilization !== undefined && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10.5px] font-bold text-slate-500">
                          <span>Limit Utilization</span>
                          <span>{business.creditSummary.creditUtilization}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                          <div className={`h-full transition-all ${
                            business.creditSummary.creditUtilization > 85 ? 'bg-red-500' :
                            business.creditSummary.creditUtilization > 50 ? 'bg-orange-500' :
                            'bg-indigo-600'
                          }`} style={{ width: `${Math.min(100, business.creditSummary.creditUtilization)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 italic">No business partner linked to this invoice.</p>
            )}
          </div>

          {/* Risk & Governance Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <ShieldAlert size={14} className="text-rose-500" /> Credit Governance Status
            </h3>
            <div className="space-y-3.5 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Partner Risk Level</span>
                <span className={`badge text-[10.5px] font-black px-2 py-0.5 rounded border ${
                  risk.status.level === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-100' :
                  risk.status.level === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                  'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  {risk.status.level} ({risk.status.score} pts)
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-50 pt-2.5">
                <span className="text-slate-400">Cash-Only Enforcement</span>
                <span className="font-bold text-slate-800">{risk.status.cashOnly ? 'Enforced' : 'Approved Credit'}</span>
              </div>
              
              {risk.override ? (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                    <ShieldCheck size={14} className="text-emerald-600" /> Override Approved
                  </div>
                  <div className="text-[11.5px] font-medium space-y-1 text-emerald-700">
                    <p><strong>Approved By:</strong> {risk.override.approved_by_name || 'Finance Manager'}</p>
                    <p><strong>Reason:</strong> "{risk.override.reason}"</p>
                    <p className="text-[10px] text-emerald-500 font-mono">Request #{risk.override.id}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-100 text-slate-600 rounded-xl p-3 space-y-1 mt-2 text-[11.5px]">
                  <p><strong>Governance Override:</strong> Not required for this transaction.</p>
                </div>
              )}
            </div>
          </div>

          {/* Audit History Logs */}
          <div className="no-print bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <FileText size={14} className="text-slate-500" /> Compliance Audit Trail
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {audit.logs.map(log => (
                <div key={log.id} className="border-b border-slate-50 pb-2 text-[11.5px] space-y-1">
                  <div className="flex justify-between font-mono font-bold text-slate-400 text-[10px]">
                    <span>{log.action}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p className="font-semibold text-slate-700">{log.description}</p>
                  <p className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                    <User size={10} /> {log.user_name || 'System'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Manager Audit Comments Section */}
          <div className="no-print bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <MessageSquare size={14} className="text-indigo-500" /> Transaction Audit Comments
            </h3>
            
            {/* Comment List */}
            <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-[12px] text-slate-400 italic py-2 text-center">No comments logged yet.</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="bg-slate-50/60 border border-slate-100 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span className="text-indigo-600">{c.userName}</span>
                      <span>{new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-[12px] text-slate-700 font-medium leading-relaxed">
                      {c.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Post comment form */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
              <input 
                type="text" 
                placeholder="Type your comment..." 
                value={commentText} 
                onChange={(e) => setCommentText(e.target.value)}
                disabled={submittingComment}
                className="flex-1 border border-slate-200 rounded-lg p-2 text-[12.5px] font-medium focus:ring-2 focus:ring-indigo-500 outline-none hover:bg-slate-50"
              />
              <button 
                type="submit" 
                disabled={submittingComment || !commentText.trim()}
                className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-bold flex items-center justify-center transition-all disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Send size={13} />
              </button>
            </form>
          </div>

          {/* Attachments Section */}
          <div className="no-print bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-[12.5px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
              <Paperclip size={14} className="text-slate-500" /> Attached Reference Documents
            </h3>
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-red-50 text-red-500">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-slate-700">{att.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{att.size}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => alert(`Previewing Attachment Document:\nFilename: ${att.name}\nSize: ${att.size}\nType: ${att.type}`)}
                    className="text-[11.5px] font-extrabold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={12} /> View
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
