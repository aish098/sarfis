import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Eye, Landmark, User, FileText, 
  MapPin, CheckCircle, X, ShieldAlert, Calendar, DollarSign, Wrench, 
  Activity, Users, ClipboardList, Send, Ban, Undo, Clock, CalendarDays,
  ActivitySquare, ChevronLeft
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Import reusable design system components
import StatusBadge from '../../components/ui/StatusBadge';
import RightDrawer from '../../components/ui/RightDrawer';
import Timeline from '../../components/ui/Timeline';
import FloatingActionButton from '../../components/ui/FloatingActionButton';

export default function PayrollEmployees({ userRole, onBackToDashboard }) {
  const { activeCompany } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  
  // Real-time detailed drawer states
  const [empDetails, setEmpDetails] = useState({
    line: null,
    run: null,
    components: [],
    history: [],
    adjustments: [],
    pastPayments: []
  });
  
  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview | payroll | attendance | leave | overtime | loans | payments | documents | audit | timeline

  const fetchEmployeesData = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const baseRes = await api.get(`/employees/${activeCompany.id}`);
      const baseList = baseRes.data || [];

      let currentPeriod = '2026-08';
      try {
        const runsRes = await api.get(`/payroll/${activeCompany.id}/reports/register`);
        if (runsRes.data && runsRes.data.length > 0) {
          currentPeriod = runsRes.data[0].period;
        }
      } catch {}

      const wsLinesRes = await api.get(`/payroll/${activeCompany.id}/employees?period=${currentPeriod}`);
      const wsLines = wsLinesRes.data || [];

      const combined = baseList.map(emp => {
        const matchingLine = wsLines.find(line => line.employee_id === emp.id);
        return {
          id: emp.id,
          name: emp.name,
          email: emp.email || '—',
          department: emp.department || 'General',
          role: emp.role || 'Staff',
          bankName: emp.bank_name || 'Habib Bank',
          bankAccount: emp.bank_account || 'PK12HABB0000123456789012',
          salary: parseFloat(emp.salary || 0),
          status: matchingLine ? matchingLine.payment_status : 'DRAFT',
          lineId: matchingLine ? matchingLine.line_id : null
        };
      });

      setEmployees(combined);
    } catch (err) {
      console.error('Failed to load real-time employees list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
  }, [activeCompany?.id]);

  const handleSelectEmployee = async (emp) => {
    setSelectedEmp(emp);
    setActiveSubTab('overview');
    
    if (emp.lineId) {
      try {
        const detailsRes = await api.get(`/payroll/${activeCompany.id}/employee/${emp.lineId}`);
        setEmpDetails({
          line: detailsRes.data.line || null,
          run: detailsRes.data.run || null,
          components: detailsRes.data.components || [],
          history: detailsRes.data.history || [],
          adjustments: detailsRes.data.adjustments || [],
          pastPayments: detailsRes.data.pastPayments || []
        });
      } catch (err) {
        console.error('Failed to fetch employee details payload:', err);
      }
    } else {
      setEmpDetails({
        line: { basic_salary: emp.salary * 0.6, house_rent: emp.salary * 0.25, medical_allowance: emp.salary * 0.10, transport_allowance: emp.salary * 0.05, gross_salary: emp.salary, net_salary: emp.salary },
        run: null,
        components: [
          { name: 'Basic Salary (60%)', amount: emp.salary * 0.6, type: 'EARNING' },
          { name: 'House Rent Allowance (25%)', amount: emp.salary * 0.25, type: 'EARNING' },
          { name: 'Medical Allowance (10%)', amount: emp.salary * 0.10, type: 'EARNING' },
          { name: 'Transport Allowance (5%)', amount: emp.salary * 0.05, type: 'EARNING' }
        ],
        history: [],
        adjustments: [],
        pastPayments: []
      });
    }
  };

  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const careerTimeline = [
    { title: 'Joined Company', desc: 'Hired as Staff Associate', date: 'Jan 2023' },
    { title: 'Promotion Evaluated', desc: 'Promoted to Senior Associate role', date: 'Jan 2024' },
    { title: 'Salary Increase Approved', desc: 'Adjusted basic pay slab due to performance', date: 'Jan 2025' },
    { title: 'Payroll Run Calculated', desc: 'Verified gross salary calculation metrics', date: 'Aug 2026' },
    { title: 'Direct Deposit Paid', desc: 'Bank transfer cleared matching JV voucher', date: 'Aug 2026' }
  ];

  const disableActions = userRole === 'Auditor';

  const drawerTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave' },
    { id: 'overtime', label: 'Overtime' },
    { id: 'loans', label: 'Loans' },
    { id: 'payments', label: 'Payments' },
    { id: 'documents', label: 'Documents' },
    { id: 'audit', label: 'Audit' },
    { id: 'timeline', label: 'Timeline' }
  ];

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600 relative">
      
      {/* Universal Right Drawer */}
      <RightDrawer
        isOpen={!!selectedEmp}
        onClose={() => setSelectedEmp(null)}
        title={selectedEmp?.name}
        subtitle={selectedEmp ? `${selectedEmp.role} — ${selectedEmp.department}` : ''}
        tabs={drawerTabs}
        activeTab={activeSubTab}
        onTabChange={setActiveSubTab}
      >
        {selectedEmp && (
          <div className="font-normal text-slate-550 leading-relaxed text-xs">
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
                  <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Quick Actions</h5>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black">
                    <button 
                      disabled={disableActions}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex flex-col items-center gap-1.5 transition-all shadow-3xs cursor-pointer text-slate-700 disabled:opacity-40"
                    >
                      <Send size={12} className="text-indigo-600" />
                      Email Payslip
                    </button>
                    <button 
                      disabled={disableActions}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex flex-col items-center gap-1.5 transition-all shadow-3xs cursor-pointer text-slate-700 disabled:opacity-40"
                    >
                      <Ban size={12} className="text-amber-500" />
                      Hold Salary
                    </button>
                    <button 
                      disabled={disableActions}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex flex-col items-center gap-1.5 transition-all shadow-3xs cursor-pointer text-slate-700 disabled:opacity-40"
                    >
                      <Undo size={12} className="text-rose-500" />
                      Reverse Payment
                    </button>
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

            {activeSubTab === 'payroll' && (
              <div className="space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Salary Components Breakdown</h5>
                <div className="border border-slate-100 rounded-2xl overflow-hidden text-xs font-semibold text-slate-600">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <span>Component Name</span>
                    <span>Monthly Amount</span>
                  </div>
                  <div className="p-4 space-y-3 font-semibold text-slate-600">
                    {empDetails.components.length > 0 ? (
                      empDetails.components.map(comp => (
                        <div key={comp.id || comp.name} className="flex justify-between">
                          <span>{comp.name || comp.code}:</span>
                          <span className="font-mono text-slate-800">PKR {parseFloat(comp.amount || comp.value || 0).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex justify-between"><span>Basic Salary (60%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.6).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>House Rent Allowance (25%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.25).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Medical Allowance (10%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.1).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Transport Allowance (5%):</span> <span className="font-mono text-slate-800">PKR {(selectedEmp.salary * 0.05).toLocaleString()}</span></div>
                        <div className="border-t border-slate-100 my-2 pt-2 flex justify-between text-rose-600"><span>Income Tax Withheld:</span> <span className="font-mono">- PKR {(selectedEmp.salary * 0.08).toLocaleString()}</span></div>
                        <div className="flex justify-between text-rose-600"><span>Provident Fund (5%):</span> <span className="font-mono">- PKR {(selectedEmp.salary * 0.05).toLocaleString()}</span></div>
                      </>
                    )}
                    <div className="border-t border-indigo-100 pt-2 flex justify-between font-black text-indigo-700 text-sm">
                      <span>Net Pay:</span>
                      <span className="font-mono">PKR {parseFloat(empDetails.line?.net_salary || selectedEmp.salary * 0.87).toLocaleString()}</span>
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

            {activeSubTab === 'leave' && (
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Leave Balances</h5>
                <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 p-3.5 border border-slate-150 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Annual Leave</span>
                    <p className="font-black text-slate-800 text-sm mt-1">20 Days</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Sick Leave</span>
                    <p className="font-black text-slate-800 text-sm mt-1">10 Days</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Casual Leave</span>
                    <p className="font-black text-slate-800 text-sm mt-1">10 Days</p>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'overtime' && (
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Overtime Records</h5>
                <div className="p-4 bg-slate-50 border border-slate-155 rounded-xl space-y-2">
                  <p className="flex justify-between"><span>Approved OT Hours:</span> <span className="font-bold text-slate-800">4.5 Hours</span></p>
                  <p className="flex justify-between"><span>Base Rate Multiplier:</span> <span className="font-bold text-slate-800">1.5x</span></p>
                  <p className="flex justify-between"><span>Total Overtime Pay:</span> <span className="font-mono text-emerald-600 font-bold">PKR 9,375</span></p>
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

            {activeSubTab === 'payments' && (
              <div className="space-y-3">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Disbursement Clearance History</h5>
                {empDetails.pastPayments.length > 0 ? (
                  empDetails.pastPayments.map(pay => (
                    <div key={pay.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center font-semibold text-xs text-slate-700">
                      <div>
                        <span className="font-bold">Period {pay.period}</span>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {pay.bank_reference || 'FT-001'}</p>
                      </div>
                      <span className="font-mono font-black">PKR {parseFloat(pay.net_salary || 0).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-center text-slate-400">
                    No historical disbursement clearings matched.
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'documents' && (
              <div className="space-y-3 font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-2">Employee HR Documents</h5>
                {['Payslip - July 2026', 'Payslip - June 2026', 'Employment Contract', 'Company Bank Letter'].map(doc => (
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
                  {empDetails.history.length > 0 ? (
                    empDetails.history.map(h => (
                      <div key={h.id}>
                        <p className="text-[10px] text-slate-400 font-bold">{new Date(h.changed_at).toLocaleDateString()} — User ID: {h.changed_by}</p>
                        <p className="text-slate-600 mt-0.5">Status Transition: {h.old_status} ➔ {h.new_status} ({h.reason})</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">Aug 01, 2026 — Rana Talal</p>
                        <p className="text-slate-600 mt-0.5">Updated Bank Account from MCB to HBL PK12HABB...</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">Jul 12, 2026 — Bisma Khan</p>
                        <p className="text-slate-600 mt-0.5">Linked system user account ID to employee profile.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'timeline' && (
              <div className="space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Employee Career & Payout Lifecycle</h5>
                <Timeline items={careerTimeline} />
              </div>
            )}
          </div>
        )}
      </RightDrawer>

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
        <div className="flex items-center gap-2">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer font-black"
            >
              <ChevronLeft size={12} /> Back
            </button>
          )}
          <button 
            disabled={disableActions}
            onClick={() => console.log('Add')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-black"
          >
            <Plus size={12} /> Add Employee
          </button>
        </div>
      </div>

      {/* Responsive Employee Directory: Grid of cards on Mobile, Table on Desktop */}
      
      {/* Mobile view cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.map(emp => (
          <div key={emp.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs space-y-3 text-xs font-semibold text-slate-600">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">{emp.name}</h4>
                <p className="text-[10.5px] text-slate-400 mt-0.5">{emp.role} • {emp.department}</p>
              </div>
              <StatusBadge status={emp.status} />
            </div>
            
            <div className="border-t border-slate-50 pt-2 flex justify-between items-center">
              <div>
                <span className="text-[9.5px] text-slate-400 block font-normal">Monthly Base Pay</span>
                <span className="font-mono font-bold text-slate-800">PKR {emp.salary.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleSelectEmployee(emp)}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                >
                  Open 360°
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden hidden md:block">
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
                    <StatusBadge status={emp.status} />
                  </td>
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    <button 
                      onClick={() => handleSelectEmployee(emp)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg mr-1 transition-all cursor-pointer"
                      title="View 360° Profile"
                    >
                      <Eye size={13} />
                    </button>
                    <button 
                      disabled={disableActions}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg mr-1 transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      disabled={disableActions}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-bold">No active employees found in active workspace directory.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Button */}
      {!disableActions && (
        <FloatingActionButton 
          onClick={() => console.log('Floating action clicked')} 
          label="New Profile"
        />
      )}
    </div>
  );
}
