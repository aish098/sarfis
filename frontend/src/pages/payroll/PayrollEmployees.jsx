import React, { useState } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Eye, Landmark, User, FileText, 
  MapPin, CheckCircle, X, ShieldAlert, Calendar, DollarSign, Wrench, 
  Activity, Users, ClipboardList
} from 'lucide-react';

export default function PayrollEmployees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([
    { id: 31, name: 'Farhan Ali', email: 'farhan@gmail.com', department: 'Engineering', role: 'Senior Software Engineer', bankName: 'Habib Bank', bankAccount: 'PK12HABB0000123456789012', salary: 180000, status: 'Paid', notificationsCount: 2 },
    { id: 32, name: 'Sana Khan', email: 'sana@gmail.com', department: 'Product', role: 'Product Manager', bankName: 'MCB Bank', bankAccount: 'PK24MCBB0000987654321098', salary: 150000, status: 'Paid', notificationsCount: 1 },
    { id: 33, name: 'Zainab Ahmed', email: 'zainab@gmail.com', department: 'Product', role: 'UI/UX Designer', bankName: 'Bank Alfalah', bankAccount: 'PK76ALFH0000345678901234', salary: 110000, status: 'Paid', notificationsCount: 0 },
    { id: 34, name: 'Hamza Sheikh', email: 'hamza@gmail.com', department: 'Engineering', role: 'DevOps Specialist', bankName: 'Habib Bank', bankAccount: 'PK12HABB0000987654321012', salary: 165000, status: 'Paid', notificationsCount: 3 },
    { id: 35, name: 'Ayesha Malik', email: 'ayesha@gmail.com', department: 'People Operations', role: 'HR Manager', bankName: 'National Bank', bankAccount: 'PK45NBPA0000765432109876', salary: 95000, status: 'On Hold', notificationsCount: 0 },
    { id: 36, name: 'Rizwan Ali', email: 'rizwan@gmail.com', department: 'Finance', role: 'Accountant', bankName: 'MCB Bank', bankAccount: 'pk12mcb11111111111111', salary: 200000, status: 'Processing', notificationsCount: 1 },
  ]);

  const [selectedEmp, setSelectedEmp] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview | salary | attendance | loans | adjustments | documents | audit

  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600 relative">
      {/* 360 Degree Employee Detail Profile Drawer */}
      {selectedEmp && (
        <div className="fixed inset-y-0 right-0 w-[550px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold uppercase">
                {selectedEmp.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-sm">{selectedEmp.name}</h4>
                <p className="text-[10px] text-slate-400 font-semibold">{selectedEmp.role} — {selectedEmp.department}</p>
              </div>
            </div>
            <button onClick={() => setSelectedEmp(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
              <X size={16} />
            </button>
          </div>

          {/* Sub Tab Navigation */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 px-4 text-[10px] font-black uppercase tracking-wider overflow-x-auto custom-scrollbar">
            {['overview', 'salary', 'attendance', 'loans', 'adjustments', 'documents', 'audit'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-3 py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeSubTab === tab 
                    ? 'border-indigo-600 text-indigo-700' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar font-normal text-slate-500 leading-relaxed">
            {activeSubTab === 'overview' && (
              <div className="space-y-4 text-xs font-semibold">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Payroll Status</span>
                    <p className="text-slate-800 font-bold mt-1 text-sm">{selectedEmp.status}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Base Salary</span>
                    <p className="text-slate-800 font-mono font-black mt-1 text-sm">PKR {selectedEmp.salary.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Disbursement Details</h5>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 font-semibold text-slate-600">
                    <p className="flex justify-between"><span>Bank:</span> <span className="text-slate-800 font-bold">{selectedEmp.bankName}</span></p>
                    <p className="flex justify-between"><span>Account Number/IBAN:</span> <span className="text-slate-800 font-mono font-bold">{selectedEmp.bankAccount}</span></p>
                    <p className="flex justify-between"><span>Linked User Email:</span> <span className="text-indigo-600 font-mono font-bold">{selectedEmp.email}</span></p>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'salary' && (
              <div className="space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Salary Components Breakdown</h5>
                <div className="border border-slate-100 rounded-2xl overflow-hidden text-xs font-semibold text-slate-600">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <span>Component Name</span>
                    <span>Monthly Amount</span>
                  </div>
                  <div className="p-4 space-y-3 font-semibold text-slate-600">
                    <div className="flex justify-between"><span>Basic Salary (60%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.6).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>House Rent Allowance (25%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.25).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Medical Allowance (10%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.1).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Transport Allowance (5%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.05).toLocaleString()}</span></div>
                    <div className="border-t border-slate-100 my-2 pt-2 flex justify-between text-rose-600"><span>Income Tax Withheld:</span> <span className="font-mono">- PKR {(selectedEmp.salary * 0.08).toLocaleString()}</span></div>
                    <div className="flex justify-between text-rose-600"><span>Provident Fund (5%):</span> <span className="font-mono">- PKR {(selectedEmp.salary * 0.05).toLocaleString()}</span></div>
                    <div className="border-t border-indigo-100 pt-2 flex justify-between font-black text-indigo-700 text-sm">
                      <span>Estimated Net Pay:</span>
                      <span className="font-mono">PKR {(selectedEmp.salary * 0.87).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'attendance' && (
              <div className="space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Attendance & Time Logs</h5>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-3 gap-3 text-center text-xs font-semibold">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Days Present</span>
                    <p className="text-slate-800 font-bold text-sm mt-1">22 / 22</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Unpaid Leaves</span>
                    <p className="text-slate-800 font-bold text-sm mt-1">0 Days</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Overtime Hours</span>
                    <p className="text-slate-800 font-bold text-sm mt-1">4.5 Hrs</p>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'loans' && (
              <div className="space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Corporate Loans & Advances</h5>
                <div className="p-8 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center text-slate-400 text-xs font-bold">
                  No active loan or salary advance requests registered for this employee.
                </div>
              </div>
            )}

            {activeSubTab === 'adjustments' && (
              <div className="space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Salary Adjustments</h5>
                <div className="p-8 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center text-slate-400 text-xs font-bold">
                  No payroll adjustments logged for the current active period.
                </div>
              </div>
            )}

            {activeSubTab === 'documents' && (
              <div className="space-y-3 font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-2">Employee HR Documents</h5>
                {['Payslip - July 2026', 'Payslip - June 2026', 'Employment Contract', 'Company Bank Letter', 'Tax Year 2026 Certificate'].map(doc => (
                  <div key={doc} className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between transition-all">
                    <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> {doc}</span>
                    <button className="text-indigo-600 hover:underline cursor-pointer">Download</button>
                  </div>
                ))}
              </div>
            )}

            {activeSubTab === 'audit' && (
              <div className="space-y-3 font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-2">Compliance Change Logs</h5>
                <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-4 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">Aug 01, 2026 — Rana Talal</p>
                    <p className="text-slate-600 mt-0.5">Updated Bank Account from MCB to HBL PK12HABB...</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">Jul 12, 2026 — Bisma Khan</p>
                    <p className="text-slate-600 mt-0.5">Linked system user account ID #31 to employee profile.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Employee Directory Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
            placeholder="Search employees by name, role or department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-black">
          <Plus size={12} /> Add Employee
        </button>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Job Role</th>
                <th className="px-5 py-3.5">Bank Information</th>
                <th className="px-5 py-3.5 text-right">Monthly Base Pay</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{emp.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{emp.department}</td>
                  <td className="px-5 py-4 text-slate-500">{emp.role}</td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-700">{emp.bankName}</p>
                    <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">{emp.bankAccount}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">
                    PKR {emp.salary.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black border ${
                      emp.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      emp.status === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    <button 
                      onClick={() => setSelectedEmp(emp)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg mr-1 transition-all"
                      title="View 360° Profile"
                    >
                      <Eye size={13} />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg mr-1 transition-all">
                      <Edit2 size={13} />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
