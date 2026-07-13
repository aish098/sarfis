import { Link2, ArrowRight, Calendar, ArrowRightCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  PURCHASE_ORDER: { label: 'Purchase Order', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  VOUCHER: { label: 'ERP Voucher', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  DELIVERY: { label: 'Delivery Order', colorClass: 'text-amber-600 bg-amber-50 border-amber-100' }
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
  CONVERTED: 'bg-slate-50 text-slate-600 border-slate-200'
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
  CONVERTED: '⚪'
};

export default function RelatedDocuments({ documents = [] }) {
  const navigate = useNavigate();

  const activeDocs = documents.filter(doc => doc && doc.id);

  if (activeDocs.length === 0) return null;

  // Determine flow type (Procurement or Sales)
  const isProcurement = activeDocs.some(doc => doc.type === 'PURCHASE_ORDER');
  
  // Custom journey flow layout
  const journeySteps = isProcurement 
    ? [
        { label: 'Purchase Order', active: activeDocs.some(d => d.type === 'PURCHASE_ORDER') },
        { label: 'Purchase Voucher', active: activeDocs.some(d => d.type === 'VOUCHER') },
        { label: 'Inventory Restocked', active: activeDocs.some(d => d.type === 'VOUCHER' && d.status === 'POSTED') }
      ]
    : [
        { label: 'Sales Voucher', active: activeDocs.some(d => d.type === 'VOUCHER') },
        { label: 'Delivery Order', active: activeDocs.some(d => d.type === 'DELIVERY') },
        { label: 'Order Fulfilled', active: activeDocs.some(d => d.type === 'DELIVERY' && d.status === 'DELIVERED') }
      ];

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
          {isProcurement ? 'Procurement Flow' : 'Sales Flow'}
        </span>
      </div>

      {/* Visual Journey Bar */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-2 overflow-x-auto select-none no-print">
        {journeySteps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border ${
                step.active 
                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20' 
                  : 'bg-white text-slate-400 border-slate-200'
              }`}>
                {idx + 1}
              </span>
              <span className={`text-[11px] font-bold ${step.active ? 'text-slate-850 font-extrabold' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
            {idx < journeySteps.length - 1 && (
              <ArrowRightCircle size={13} className={step.active ? 'text-emerald-500' : 'text-slate-350'} />
            )}
          </div>
        ))}
      </div>
      
      {/* Detailed Document Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {activeDocs.map((doc, idx) => {
          const typeInfo = TYPE_CONFIG[doc.type] || { label: doc.type || 'Document', colorClass: 'text-slate-600 bg-slate-50 border-slate-200' };
          const statusClass = STATUS_STYLE_MAP[doc.status] || 'bg-slate-50 text-slate-600 border-slate-200';
          const indicator = STATUS_INDICATORS[doc.status] || '⚪';
          
          return (
            <div 
              key={idx} 
              className="p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/5 hover:shadow-md hover:shadow-slate-100/50 transition-all flex flex-col justify-between gap-4 group relative overflow-hidden bg-white"
            >
              <div className="space-y-2">
                <span className={`text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeInfo.colorClass}`}>
                  {typeInfo.label}
                </span>
                
                <h4 className="font-mono font-black text-[14.5px] text-slate-850 tracking-tight mt-1">
                  {doc.number}
                </h4>
              </div>
              
              <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]" role="img" aria-label="status">
                    {indicator}
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusClass}`}>
                    {doc.status}
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
    </div>
  );
}
