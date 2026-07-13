import { Link2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG = {
  PURCHASE_ORDER: { label: 'Purchase Order', colorClass: 'text-indigo-600 bg-indigo-50' },
  VOUCHER: { label: 'ERP Voucher', colorClass: 'text-emerald-600 bg-emerald-50' },
  DELIVERY: { label: 'Delivery Order', colorClass: 'text-amber-600 bg-amber-50' }
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

export default function RelatedDocuments({ documents = [] }) {
  const navigate = useNavigate();

  const activeDocs = documents.filter(doc => doc && doc.id);

  if (activeDocs.length === 0) return null;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded bg-[#EBFDF5] text-emerald-600">
          <Link2 size={16} />
        </div>
        <h3 className="text-[12px] font-black uppercase text-slate-800 tracking-wider">Related Documents</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {activeDocs.map((doc, idx) => {
          const typeInfo = TYPE_CONFIG[doc.type] || { label: doc.type || 'Document', colorClass: 'text-slate-600 bg-slate-50' };
          const statusClass = STATUS_STYLE_MAP[doc.status] || 'bg-slate-50 text-slate-600 border-slate-200';
          
          return (
            <div 
              key={idx} 
              className="p-3.5 rounded-xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all flex flex-col justify-between gap-3 group relative overflow-hidden"
            >
              <div>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${typeInfo.colorClass}`}>
                  {typeInfo.label}
                </span>
                
                <h4 className="font-mono font-bold text-[14px] text-slate-800 mt-2">
                  {doc.number}
                </h4>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <span className={`badge text-[9.5px] font-black px-2 py-0.5 rounded-full border ${statusClass}`}>
                  {doc.status}
                </span>
                
                <button
                  onClick={() => navigate(doc.link)}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 border-none bg-transparent cursor-pointer transition-transform group-hover:translate-x-0.5"
                >
                  Open <ArrowRight size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
