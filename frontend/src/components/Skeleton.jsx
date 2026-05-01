import React from 'react';

const Skeleton = ({ className = '', variant = 'rect', ...props }) => {
 const baseClasses = ' bg-slate-200 rounded';
 const variantClasses = {
 rect: '',
 circle: 'rounded-full',
 text: 'h-4 w-full mb-2',
 };

 return (
 <div 
 className={`${baseClasses} ${variantClasses[variant]} ${className}`} 
 {...props} 
 />
 );
};

export const SkeletonCard = () => (
 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-32">
 <Skeleton className="w-24 h-4 mb-4" />
 <Skeleton className="w-32 h-8 mb-4" />
 <Skeleton className="w-20 h-4" />
 </div>
);

export const SkeletonChart = ({ height = 'h-80' }) => (
 <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${height}`}>
 <Skeleton className="w-48 h-5 mb-6" />
 <Skeleton className="w-full h-[calc(100%-44px)]" />
 </div>
);

export const SkeletonList = ({ items = 5 }) => (
 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
 <Skeleton className="w-40 h-5 mb-6" />
 {[...Array(items)].map((_, i) => (
 <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
 <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
 <div className="flex-1">
 <Skeleton className="w-1/3 h-4 mb-2" />
 <Skeleton className="w-1/4 h-3" />
 </div>
 <Skeleton className="w-16 h-5" />
 </div>
 ))}
 </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
 <>
 {[...Array(rows)].map((_, i) => (
 <tr key={i} className="border-b border-slate-100 last:border-0">
 {[...Array(cols)].map((_, j) => (
 <td key={j} className="px-8 py-5">
 <Skeleton className={`h-4 ${j === 1 ? 'w-3/4' : 'w-1/2'}`} />
 </td>
 ))}
 </tr>
 ))}
 </>
);

export const SkeletonReport = () => (
 <div className="max-w-4xl mx-auto space-y-8 ">
 <div className="text-center space-y-4 border-b pb-8 border-slate-100">
 <div className="flex justify-center"><Skeleton className="w-48 h-8 rounded-lg" /></div>
 <div className="flex justify-center"><Skeleton className="w-32 h-6 rounded-lg" /></div>
 <div className="flex justify-center"><Skeleton className="w-64 h-4 rounded-lg" /></div>
 </div>
 <div className="space-y-6">
 <div className="grid grid-cols-2 gap-8">
 <div className="space-y-4">
 <Skeleton className="w-1/2 h-6 rounded-lg mb-6" />
 {[...Array(6)].map((_, i) => (
 <div key={i} className="flex justify-between items-center py-2">
 <Skeleton className="w-1/3 h-4 rounded" />
 <Skeleton className="w-1/4 h-4 rounded" />
 </div>
 ))}
 </div>
 <div className="space-y-4">
 <Skeleton className="w-1/2 h-6 rounded-lg mb-6" />
 {[...Array(6)].map((_, i) => (
 <div key={i} className="flex justify-between items-center py-2">
 <Skeleton className="w-1/3 h-4 rounded" />
 <Skeleton className="w-1/4 h-4 rounded" />
 </div>
 ))}
 </div>
 </div>
 <div className="h-20 bg-slate-50 rounded-2xl flex items-center justify-between px-8">
 <Skeleton className="w-1/4 h-6 rounded-lg" />
 <Skeleton className="w-1/5 h-8 rounded-lg" />
 </div>
 </div>
 </div>
);

export default Skeleton;
