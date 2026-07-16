import { Link2, ArrowRight, User, Calendar, ArrowRightCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  OPENING_BALANCE: { label: 'Opening Balances', colorClass: 'text-indigo-650 bg-indigo-50 border-indigo-100' },
  PURCHASE_REQUISITION: { label: 'Purchase Requisition', colorClass: 'text-blue-650 bg-blue-50 border-blue-100' },
  PURCHASE_ORDER: { label: 'Purchase Order', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  GOODS_RECEIPT: { label: 'Goods Receipt', colorClass: 'text-amber-650 bg-amber-50 border-amber-100' },
  VOUCHER: { label: 'ERP Voucher', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  DELIVERY: { label: 'Delivery Order', colorClass: 'text-amber-600 bg-amber-50 border-amber-100' },
  SALES_ORDER: { label: 'Sales Order', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  PAYMENT_RECEIPT: { label: 'Payment Receipt', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  PAYMENT: { label: 'Supplier Payment', colorClass: 'text-emerald-650 bg-emerald-50 border-emerald-100' }
};

const STATUS_STYLE_MAP = {
  // Post/Success
  POSTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  
  // Pending Approval/In Progress
  PENDING_APPROVAL: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  DISPATCHED: 'bg-orange-50 text-orange-700 border-orange-100',
  CONFIRMED: 'bg-amber-50 text-amber-700 border-amber-100',
  PENDING: 'bg-blue-50 text-blue-700 border-blue-100',
  
  // Rejection/Warnings
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-100',
  
  // Draft/Archives
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  CONVERTED: 'bg-slate-50 text-slate-600 border-slate-200',
  CONVERTED_TO_PO: 'bg-slate-50 text-slate-600 border-slate-200'
};

const STATUS_INDICATORS = {
  POSTED: '🟢',
  APPROVED: '🟢',
  DELIVERED: '🟢',
  PENDING_APPROVAL: '🔵',
  DISPATCHED: '🟦',
  CONFIRMED: '🟡',
  PENDING: '🟡',
  REJECTED: '🔴',
  CANCELLED: '🔴',
  DRAFT: '⚪',
  CONVERTED: '⚪',
  CONVERTED_TO_PO: '⚪'
};

export default function RelatedDocuments({ documents = [], currentType }) {
  const navigate = useNavigate();

  const activeDocs = documents.filter(doc => doc && doc.id);

  // We always show the timeline journey, even if only the current document type is here.
  // To build the journey, let's see which flow we are in.
  const isOpeningBalanceFlow = currentType === 'OPENING_BALANCE' || activeDocs.some(doc => doc.type === 'OPENING_BALANCE');
  const isSalesFlow = !isOpeningBalanceFlow && (currentType === 'SALES_ORDER' || activeDocs.some(doc => doc.type === 'SALES_ORDER') || (!activeDocs.some(doc => doc.type === 'PURCHASE_REQUISITION' || doc.type === 'PURCHASE_ORDER' || doc.type === 'GOODS_RECEIPT') && (currentType === 'DELIVERY' || currentType === 'VOUCHER')));
  const isProcurement = !isSalesFlow && !isOpeningBalanceFlow;

  const hasOpening = currentType === 'OPENING_BALANCE' || activeDocs.some(d => d.type === 'OPENING_BALANCE');
  const hasReq = currentType === 'PURCHASE_REQUISITION' || activeDocs.some(d => d.type === 'PURCHASE_REQUISITION');
  const hasPo = currentType === 'PURCHASE_ORDER' || activeDocs.some(d => d.type === 'PURCHASE_ORDER');
  const hasGrn = currentType === 'GOODS_RECEIPT' || activeDocs.some(d => d.type === 'GOODS_RECEIPT');
  const hasVoucher = currentType === 'VOUCHER' || activeDocs.some(d => d.type === 'VOUCHER');
  const hasDelivery = currentType === 'DELIVERY' || activeDocs.some(d => d.type === 'DELIVERY');
  const hasSo = currentType === 'SALES_ORDER' || activeDocs.some(d => d.type === 'SALES_ORDER');
  
  // Is it fully completed/posted?
  const isPoPosted = hasVoucher && (currentType === 'VOUCHER' || activeDocs.some(d => d.type === 'VOUCHER' && d.status === 'POSTED'));
  const isDelivered = hasDelivery && (currentType === 'DELIVERY' || activeDocs.some(d => d.type === 'DELIVERY' && d.status === 'DELIVERED'));
  const isPaid = activeDocs.some(d => d.type === 'PAYMENT');

  const journeySteps = isOpeningBalanceFlow
    ? [
        { type: 'OPENING_BALANCE', label: 'Opening Balances', active: hasOpening, current: currentType === 'OPENING_BALANCE' },
        { type: 'VOUCHER', label: 'Journal Entry', active: hasVoucher, current: currentType === 'VOUCHER' },
        { type: 'LEDGER', label: 'General Ledger', active: hasVoucher, current: false },
        { type: 'REPORT', label: 'Trial Balance', active: hasVoucher, current: false }
      ]
    : isProcurement 
      ? [
          { type: 'PURCHASE_REQUISITION', label: 'Requisition', active: hasReq, current: currentType === 'PURCHASE_REQUISITION' },
          { type: 'PURCHASE_ORDER', label: 'Purchase Order', active: hasPo, current: currentType === 'PURCHASE_ORDER' },
          { type: 'GOODS_RECEIPT', label: 'Goods Receipt', active: hasGrn, current: currentType === 'GOODS_RECEIPT' },
          { type: 'VOUCHER', label: 'Purchase Voucher', active: hasVoucher, current: currentType === 'VOUCHER' },
          { type: 'PAYMENT', label: 'Payment', active: isPaid, current: false }
        ]
      : [
          { type: 'SALES_ORDER', label: 'Sales Order', active: hasSo, current: currentType === 'SALES_ORDER' },
          { type: 'DELIVERY', label: 'Delivery', active: hasDelivery, current: currentType === 'DELIVERY' },
          { type: 'VOUCHER', label: 'Sales Voucher', active: hasVoucher, current: currentType === 'VOUCHER' },
          { type: 'PAYMENT_RECEIPT', label: 'Payment Receipt', active: isPaid, current: false }
        ];

  const formatDocDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${day} at ${time}`;
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#EBFDF5] text-emerald-600">
            <Link2 size={15} />
          </div>
          <h3 className="text-[12px] font-black uppercase text-slate-800 tracking-wider">Document Journey & Relationships</h3>
        </div>
        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border">
          {isOpeningBalanceFlow ? 'Opening Balance Migration' : isProcurement ? 'Procurement Flow' : 'Sales Flow'}
        </span>
      </div>

      {/* Visual Journey Bar showing Completed, Current, and Pending states */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-2 overflow-x-auto select-none no-print">
        {journeySteps.map((step, idx) => {
          let badgeStyle = 'bg-white text-slate-400 border-slate-200';
          let textStyle = 'text-slate-400 font-semibold';
          let statusText = 'Pending';
          
          if (step.current) {
            badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-sm shadow-blue-600/20 ring-4 ring-blue-50';
            textStyle = 'text-blue-700 font-extrabold';
            statusText = 'Current';
          } else if (step.active) {
            badgeStyle = 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20';
            textStyle = 'text-slate-800 font-bold';
            statusText = 'Completed';
          }

          return (
            <div key={idx} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-2">
                  <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10.5px] font-black border ${badgeStyle}`}>
                    {step.current ? '🔵' : step.active ? '✓' : idx + 1}
                  </span>
                  <div>
                    <span className={`text-[11.5px] block leading-none ${textStyle}`}>
                      {step.label}
                    </span>
                    <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                      {statusText}
                    </span>
                  </div>
                </div>
              </div>
              {idx < journeySteps.length - 1 && (
                <ArrowRightCircle size={14} className={step.active && !step.current ? 'text-emerald-500 ml-1' : 'text-slate-300 ml-1'} />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Detailed Document Cards */}
      {activeDocs.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5">
          {activeDocs.map((doc, idx) => {
            const typeInfo = TYPE_CONFIG[doc.type] || { label: doc.type || 'Document', colorClass: 'text-slate-600 bg-slate-50 border-slate-200' };
            const statusClass = STATUS_STYLE_MAP[doc.status] || 'bg-slate-50 text-slate-600 border-slate-200';
            const indicator = STATUS_INDICATORS[doc.status] || '⚪';
            
            return (
              <div 
                key={idx} 
                className="p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/5 hover:shadow-md hover:shadow-slate-100/50 transition-all flex flex-col justify-between gap-3 group relative overflow-hidden bg-white shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeInfo.colorClass}`}>
                      {typeInfo.label}
                    </span>
                    {doc.created_at && (
                      <span className="text-[9.5px] font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDocDate(doc.created_at)}
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-mono font-black text-[14.5px] text-slate-850 tracking-tight mt-1">
                    {doc.number}
                  </h4>

                  {doc.creator_name && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold mt-1">
                      <User size={10.5} className="text-slate-400" />
                      <span>By {doc.creator_name}</span>
                    </div>
                  )}
                </div>
                
                <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" role="img" aria-label="status">
                      {indicator}
                    </span>
                    <span className={`text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusClass}`}>
                      {doc.status ? doc.status.replace(/_/g, ' ') : ''}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => navigate(doc.link)}
                    className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-1 border-none bg-transparent cursor-pointer transition-transform group-hover:translate-x-0.5"
                  >
                    Open <ArrowRight size={12} className="stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
