import React, { useState } from 'react';
import { FileText, Download, Eye, Search, FolderOpen, Calendar } from 'lucide-react';

export default function EmployeeDocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const documents = [
    { id: 1, name: 'Employment Contract & Job Offer', type: 'PDF', category: 'Legal', size: '2.4 MB', date: '2026-01-15' },
    { id: 2, name: 'CNIC & Identity Verification Copy', type: 'PDF', category: 'Identity', size: '1.1 MB', date: '2026-01-15' },
    { id: 3, name: 'Academic Degree & Certifications', type: 'PDF', category: 'Education', size: '4.8 MB', date: '2026-01-16' },
    { id: 4, name: 'Annual Performance Appraisal Form 2025', type: 'PDF', category: 'Reviews', size: '780 KB', date: '2026-06-30' },
    { id: 5, name: 'Employee Code of Conduct Handbook', type: 'PDF', category: 'Policy', size: '3.2 MB', date: '2026-01-15' },
    { id: 6, name: 'Salary Certificate - Fiscal Year 2025-26', type: 'PDF', category: 'Finance', size: '420 KB', date: '2026-07-05' }
  ];

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-5 lg:p-7 space-y-6 pb-16 min-h-full" style={{ background: '#faf9f8' }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[20px] font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FolderOpen size={22} className="text-emerald-500" /> Employee HR Documents
          </h2>
          <p className="text-[12px] text-slate-500 font-semibold mt-1">Access all your official employment files, agreements, and policies.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search documents..."
            className="w-full h-10 pl-9 pr-4 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-emerald-500 transition-all text-slate-800"
          />
          <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
        </div>
      </div>

      {/* Folders/Categories list (visual decoration) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Employment Contracts', count: 1, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Compliance & Identity', count: 1, color: 'bg-blue-50 text-blue-600' },
          { label: 'Finance & Payslips', count: 1, color: 'bg-purple-50 text-purple-600' },
          { label: 'Company Policies', count: 1, color: 'bg-amber-50 text-amber-600' }
        ].map((folder, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${folder.color}`}>
              <FolderOpen size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800 truncate">{folder.label}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{folder.count} Document</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-[13px] font-black text-slate-900">All Available Documents</h3>
        </div>

        <div className="overflow-x-auto">
          {filteredDocs.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-semibold italic">No documents found matching search criteria.</div>
          ) : (
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[9px] tracking-wider border-b border-slate-200">
                  <th className="px-5 py-3">Document Name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">File Size</th>
                  <th className="px-5 py-3">Date Uploaded</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-600 font-black text-[10px]">
                          {doc.type}
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 block">{doc.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block font-normal">Official HR File</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200/50">
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-slate-500">{doc.size}</td>
                    <td className="px-5 py-4 text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(doc.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 transition cursor-pointer"
                          title="Preview Document"
                          onClick={() => alert(`Opening preview for: ${doc.name}`)}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 rounded text-emerald-600 transition cursor-pointer"
                          title="Download Document"
                          onClick={() => alert(`Downloading: ${doc.name}`)}
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}