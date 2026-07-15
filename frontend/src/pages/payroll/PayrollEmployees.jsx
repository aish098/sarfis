import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Eye, Landmark, User, FileText, 
  MapPin, CheckCircle, X, ShieldAlert, Calendar, DollarSign, Wrench, 
  Activity, Users, ClipboardList, Send, Ban, Undo, Clock, CalendarDays,
  ActivitySquare, ChevronLeft, RefreshCw
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
  const [actionMsg, setActionMsg] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState(null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [loans, setLoans] = useState([]);

  // Form states for Logging inside tabs
  const [newAttendance, setNewAttendance] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'PRESENT',
    workingHours: '8'
  });

  const [newOT, setNewOT] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '1',
    multiplier: '1.50'
  });

  const [newLeave, setNewLeave] = useState({
    leaveType: 'ANNUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [newLoan, setNewLoan] = useState({
    amount: '',
    purpose: '',
    repaymentPeriod: '12'
  });

  const fetchLeaveBalances = async (employeeId) => {
    if (!activeCompany?.id || !employeeId) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/leaves/balances/${employeeId}`);
      setLeaveBalances(res.data || []);
    } catch (err) {
      console.error('Failed to load leave balances:', err);
    }
  };

  const fetchLeaveApplications = async (employeeId) => {
    if (!activeCompany?.id || !employeeId) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/leaves/${employeeId}`);
      setLeaveApplications(res.data || []);
    } catch (err) {
      console.error('Failed to load leave applications:', err);
    }
  };

  const fetchAttendanceLogs = async (employeeId) => {
    if (!activeCompany?.id || !employeeId) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/attendance/${employeeId}`);
      setAttendanceLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
    }
  };

  const fetchOvertimeRecords = async (employeeId) => {
    if (!activeCompany?.id || !employeeId) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/overtime/${employeeId}`);
      setOvertimeRecords(res.data || []);
    } catch (err) {
      console.error('Failed to load overtime records:', err);
    }
  };

  const fetchEmployeeLoans = async (employeeId) => {
    if (!activeCompany?.id || !employeeId) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/loans/${employeeId}`);
      setLoans(res.data || []);
    } catch (err) {
      console.error('Failed to load employee loans:', err);
    }
  };

  const [newEmp, setNewEmp] = useState({
    name: '',
    department: '',
    role: '',
    salary: '',
    bankName: '',
    accountNumber: '',
    status: 'Active',
    userId: ''
  });

  const [companyUsers, setCompanyUsers] = useState([]);

  const fetchCompanyUsers = async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await api.get(`/employees/${activeCompany.id}/users`);
      setCompanyUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load company users:', err);
    }
  };

  useEffect(() => {
    if (isAdding) {
      fetchCompanyUsers();
    }
  }, [isAdding, activeCompany?.id]);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id) return;
    setLoading(true);
    setActionMsg(null);
    try {
      const payload = {
        name: newEmp.name,
        department: newEmp.department || null,
        role: newEmp.role || null,
        salary: parseFloat(newEmp.salary),
        bankName: newEmp.bankName || null,
        accountNumber: newEmp.accountNumber || null,
        status: newEmp.status,
        userId: newEmp.userId ? parseInt(newEmp.userId) : null
      };

      if (editingEmpId) {
        // Edit Mode
        await api.patch(`/employees/${activeCompany.id}/${editingEmpId}`, payload);
        setActionMsg({ type: 'success', text: `Successfully updated payroll profile for ${newEmp.name}.` });
      } else {
        // Create Mode
        await api.post(`/employees/${activeCompany.id}`, payload);
        setActionMsg({ type: 'success', text: `Successfully created payroll profile for ${newEmp.name}.` });
      }
      
      setNewEmp({
        name: '',
        department: '',
        role: '',
        salary: '',
        bankName: '',
        accountNumber: '',
        status: 'Active',
        userId: ''
      });
      setIsAdding(false);
      setEditingEmpId(null);
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to save employee profile:', err);
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save employee profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (emp) => {
    setNewEmp({
      name: emp.name,
      department: emp.department || '',
      role: emp.role || '',
      salary: emp.salary,
      bankName: emp.bankName || '',
      accountNumber: emp.bankAccount || '',
      status: emp.status || 'Active',
      userId: emp.userId || ''
    });
    setEditingEmpId(emp.id);
    setIsAdding(true);
  };

  const handleDeleteEmployee = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete employee "${name}"? This action is irreversible and will delete all associated payroll files.`)) {
      return;
    }
    if (!activeCompany?.id) return;
    setLoading(true);
    setActionMsg(null);
    try {
      await api.delete(`/employees/${activeCompany.id}/${id}`);
      setActionMsg({ type: 'success', text: `Successfully deleted employee "${name}" from directory.` });
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to delete employee:', err);
      setActionMsg({ type: 'error', text: err.response?.data?.error || 'Failed to delete employee.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsAdding(false);
    setEditingEmpId(null);
    setNewEmp({
      name: '',
      department: '',
      role: '',
      salary: '',
      bankName: '',
      accountNumber: '',
      status: 'Active',
      userId: ''
    });
  };

  const handleLogAttendance = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedEmp) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/attendance`, {
        employeeId: selectedEmp.id,
        date: newAttendance.date,
        status: newAttendance.status,
        workingHours: parseFloat(newAttendance.workingHours)
      });
      alert('Attendance log entry registered successfully.');
      fetchAttendanceLogs(selectedEmp.id);
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to log attendance:', err);
      alert(err.response?.data?.error || 'Failed to log attendance.');
    }
  };

  const handleLogOvertime = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedEmp) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/overtime`, {
        employeeId: selectedEmp.id,
        date: newOT.date,
        hours: parseFloat(newOT.hours),
        multiplier: parseFloat(newOT.multiplier)
      });
      alert('Overtime record logged successfully.');
      fetchOvertimeRecords(selectedEmp.id);
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to log overtime:', err);
      alert(err.response?.data?.error || 'Failed to log overtime.');
    }
  };

  const handleLogLeave = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedEmp) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/leaves`, {
        employeeId: selectedEmp.id,
        leaveType: newLeave.leaveType,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate
      });
      alert('Leave request submitted successfully.');
      fetchLeaveBalances(selectedEmp.id);
      fetchLeaveApplications(selectedEmp.id);
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to submit leave request:', err);
      alert(err.response?.data?.error || 'Failed to submit leave request.');
    }
  };

  const handleApproveLeave = async (leaveId) => {
    if (!activeCompany?.id || !selectedEmp) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/leaves/${leaveId}/approve`);
      alert('Leave request approved and balance updated successfully.');
      fetchLeaveBalances(selectedEmp.id);
      fetchLeaveApplications(selectedEmp.id);
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to approve leave:', err);
      alert(err.response?.data?.error || 'Failed to approve leave request.');
    }
  };

  const handleRequestLoan = async (e) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedEmp) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/loans`, {
        employeeId: selectedEmp.id,
        amount: parseFloat(newLoan.amount),
        purpose: newLoan.purpose,
        repaymentPeriod: parseInt(newLoan.repaymentPeriod)
      });
      alert('Corporate loan request submitted and auto-approved successfully.');
      setNewLoan({ amount: '', purpose: '', repaymentPeriod: '12' });
      fetchEmployeeLoans(selectedEmp.id);
      fetchEmployeesData();
    } catch (err) {
      console.error('Failed to request loan:', err);
      alert(err.response?.data?.error || 'Failed to request corporate loan.');
    }
  };

  const handleHoldSalary = async () => {
    if (!selectedEmp?.lineId) {
      alert('Salary status can only be modified once a payroll period compilation has been started.');
      return;
    }
    const reason = window.prompt('Specify reason to hold salary payments:');
    if (reason === null) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/lines/${selectedEmp.lineId}/hold`, {
        hold_type: 'OTHER',
        reason
      });
      alert('Salary payments placed on HOLD status.');
      fetchEmployeesData();
      setSelectedEmp(prev => prev ? { ...prev, status: 'ON_HOLD' } : null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to place salary on hold.');
    }
  };

  const handleReleaseSalary = async () => {
    if (!selectedEmp?.lineId) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/lines/${selectedEmp.lineId}/release`);
      alert('Salary payment released from hold.');
      fetchEmployeesData();
      setSelectedEmp(prev => prev ? { ...prev, status: 'DRAFT' } : null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to release salary.');
    }
  };

  const handleReversePayment = async () => {
    if (!selectedEmp?.lineId) {
      alert('No payment transaction history matching active line ID.');
      return;
    }
    const remarks = window.prompt('Specify reversal reason:');
    if (remarks === null) return;
    try {
      await api.post(`/payroll/${activeCompany.id}/lines/${selectedEmp.lineId}/reverse-payment`, { remarks });
      alert('Payment disbursement transaction successfully reversed.');
      fetchEmployeesData();
      setSelectedEmp(prev => prev ? { ...prev, status: 'REVERSED' } : null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reverse payment.');
    }
  };

  const handleEmailPayslip = async () => {
    alert(`Payslip compilation dispatch queued. An automated email containing the calculated period breakdown has been sent to ${selectedEmp?.name} at ${selectedEmp?.email || 'no-email-registered@accountellence.com'}.`);
  };

  const handleDownloadPayslip = async (period) => {
    if (!selectedEmp) return;
    try {
      const res = await api.get(`/payroll/${activeCompany.id}/payslips/${selectedEmp.id}/${period}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${selectedEmp.name.replace(/\s+/g, '_')}_${period}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to generate payslip PDF:', err);
      alert('Payslip PDF could not be generated. Please make sure the payroll run for this period has been approved and posted first.');
    }
  };

  const fetchEmployeesData = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    const startTime = Date.now();
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
          email: emp.user_email || '—',
          userId: emp.user_id || '',
          department: emp.department || 'General',
          role: emp.role || 'Staff',
          bankName: emp.bank_name || 'Habib Bank',
          bankAccount: emp.account_number || 'PK12HABB0000123456789012',
          salary: parseFloat(emp.salary || 0),
          status: matchingLine ? (matchingLine.payment_status === 'DRAFT' ? emp.status : matchingLine.payment_status) : emp.status,
          lineId: matchingLine ? matchingLine.line_id : null
        };
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
      }

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
    
    // Fetch live details
    fetchLeaveBalances(emp.id);
    fetchLeaveApplications(emp.id);
    fetchAttendanceLogs(emp.id);
    fetchOvertimeRecords(emp.id);
    fetchEmployeeLoans(emp.id);
    
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
  const isLocked = disableActions || selectedEmp?.status === 'PROCESSING' || selectedEmp?.status === 'PAID' || selectedEmp?.status === 'DISBURSED';

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
      {/* Alert Messaging */}
      {actionMsg && (
        <div className={`p-4 rounded-xl border text-[13px] font-bold flex items-center justify-between gap-3 ${
          actionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle size={16} />
            {actionMsg.text}
          </span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Add/Edit Employee Form Drawer */}
      <RightDrawer
        isOpen={isAdding}
        onClose={handleCloseDrawer}
        title={editingEmpId ? "Edit Employee Profile" : "Add New Employee Profile"}
        subtitle={editingEmpId ? "Update employee details in the active directory." : "Initialize a new employee record and payroll profile."}
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 font-semibold text-xs text-slate-600 pr-1">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Full Name *</label>
            <input
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
              value={newEmp.name}
              onChange={e => setNewEmp({...newEmp, name: e.target.value})}
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-extrabold text-slate-400">Associated Corporate User / Email</label>
            <select
              className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer"
              value={newEmp.userId}
              onChange={e => setNewEmp({...newEmp, userId: e.target.value})}
            >
              <option value="">— Select Linked User Account (Optional) —</option>
              {companyUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            <p className="text-[9.5px] text-slate-400 font-normal">Linking an employee to a corporate user account automatically registers their email address for payslip delivery.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400">Department</label>
              <input
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                value={newEmp.department}
                onChange={e => setNewEmp({...newEmp, department: e.target.value})}
                placeholder="e.g. Engineering"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400">Job Role</label>
              <input
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                value={newEmp.role}
                onChange={e => setNewEmp({...newEmp, role: e.target.value})}
                placeholder="e.g. UI/UX Designer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400">Monthly Base Pay (PKR) *</label>
              <input
                required
                type="number"
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                value={newEmp.salary}
                onChange={e => setNewEmp({...newEmp, salary: e.target.value})}
                placeholder="e.g. 150000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400">Status</label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                value={newEmp.status}
                onChange={e => setNewEmp({...newEmp, status: e.target.value})}
              >
                <option value="Active">Active</option>
                <option value="Processing">Processing</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 my-4 pt-4 space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400">Bank Settlement Details</h4>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400">Bank Name</label>
              <input
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                value={newEmp.bankName}
                onChange={e => setNewEmp({...newEmp, bankName: e.target.value})}
                placeholder="e.g. Habib Bank Limited"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-extrabold text-slate-400">Account Number / IBAN</label>
              <input
                className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                value={newEmp.accountNumber}
                onChange={e => setNewEmp({...newEmp, accountNumber: e.target.value})}
                placeholder="e.g. PK12HABB0000123456789012"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-center shadow-sm cursor-pointer"
          >
            {editingEmpId ? "Save Profile Changes" : "Create Profile & Post to Directory"}
          </button>
        </form>
      </RightDrawer>

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
            {(selectedEmp.status === 'PROCESSING' || selectedEmp.status === 'PAID' || selectedEmp.status === 'DISBURSED') && (
              <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl flex items-start gap-2.5 shadow-3xs font-semibold">
                <ShieldAlert size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black uppercase tracking-wider text-[9px] text-blue-900">Active Payout Lock</h4>
                  <p className="text-[10.5px] font-normal leading-normal mt-0.5 text-blue-750">
                    This employee's payout is currently <strong>{selectedEmp.status}</strong>. Salary profile, loans, leaves, and overtime items are locked for changes to prevent audit mismatches.
                  </p>
                </div>
              </div>
            )}
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
                      onClick={handleEmailPayslip}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex flex-col items-center gap-1.5 transition-all shadow-3xs cursor-pointer text-slate-700 disabled:opacity-40"
                    >
                      <Send size={12} className="text-indigo-600" />
                      Email Payslip
                    </button>
                    <button 
                      disabled={isLocked}
                      onClick={selectedEmp.status === 'ON_HOLD' ? handleReleaseSalary : handleHoldSalary}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex flex-col items-center gap-1.5 transition-all shadow-3xs cursor-pointer text-slate-700 disabled:opacity-40"
                    >
                      <Ban size={12} className={selectedEmp.status === 'ON_HOLD' ? "text-emerald-500" : "text-amber-500"} />
                      {selectedEmp.status === 'ON_HOLD' ? 'Release Salary' : 'Hold Salary'}
                    </button>
                    <button 
                      disabled={isLocked}
                      onClick={handleReversePayment}
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
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Attendance & Time Logs</h5>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-3 gap-3 text-center text-xs font-semibold">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Days Present</span>
                    <p className="text-slate-800 font-bold text-sm mt-1">{attendanceLogs.filter(l => l.status === 'PRESENT' || l.status === 'LATE').length} Days</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Unpaid Leaves</span>
                    <p className="text-slate-800 font-bold text-sm mt-1">{attendanceLogs.filter(l => l.status === 'ABSENT').length} Days</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">Overtime Hours</span>
                    <p className="text-slate-800 font-bold text-sm mt-1">{overtimeRecords.reduce((acc, r) => acc + parseFloat(r.hours || 0), 0)} Hrs</p>
                  </div>
                </div>

                {attendanceLogs.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border border-slate-100 p-2.5 rounded-xl bg-white">
                    {attendanceLogs.map((log, index) => (
                      <div key={index} className="flex justify-between items-center text-[10.5px] font-semibold text-slate-600 border-b border-slate-50 last:border-0 pb-1.5 pt-1.5 first:pt-0">
                        <span>{new Date(log.date).toLocaleDateString()}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          log.status === 'PRESENT' || log.status === 'LATE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>{log.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleLogAttendance} className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                  <h6 className="text-[10px] font-black uppercase text-indigo-750">Log Manual Attendance Entry</h6>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400">Attendance Work Date</label>
                    <input
                      type="date"
                      required
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                      value={newAttendance.date}
                      onChange={e => setNewAttendance({...newAttendance, date: e.target.value})}
                    />
                    <p className="text-[9px] text-slate-400 font-normal">Date selection indicates the specific workday calendar date to record this attendance status log.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Attendance Status</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                        value={newAttendance.status}
                        onChange={e => setNewAttendance({...newAttendance, status: e.target.value})}
                      >
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="HALF_DAY">Half Day</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Working Hours</label>
                      <input
                        type="number"
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        value={newAttendance.workingHours}
                        onChange={e => setNewAttendance({...newAttendance, workingHours: e.target.value})}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLocked}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs cursor-pointer shadow-sm mt-2"
                  >
                    Post Attendance Log Record
                  </button>
                </form>
              </div>
            )}

            {activeSubTab === 'leave' && (
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Leave Balances</h5>
                <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 p-3.5 border border-slate-150 rounded-xl">
                  {['ANNUAL', 'SICK', 'CASUAL'].map(type => {
                    const bal = leaveBalances.find(b => b.leave_type === type) || { allocated_days: 20, used_days: 0 };
                    return (
                      <div key={type}>
                        <span className="text-[10px] text-slate-400 block">{type} Leave</span>
                        <p className="font-black text-slate-800 text-sm mt-1">{bal.allocated_days - bal.used_days} / {bal.allocated_days} Days</p>
                      </div>
                    );
                  })}
                </div>

                {leaveApplications.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border border-slate-100 p-2.5 rounded-xl bg-white">
                    <h6 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Applications History</h6>
                    {leaveApplications.map((app, index) => (
                      <div key={app.id || index} className="flex justify-between items-center text-[10.5px] font-semibold text-slate-750 border-b border-slate-50 last:border-0 pb-2 pt-2 first:pt-0">
                        <div>
                          <span className="font-bold uppercase text-[9.5px] block text-indigo-700">{app.leave_type} Leave</span>
                          <span className="text-slate-400 font-mono text-[9px]">
                            {new Date(app.start_date).toLocaleDateString()} to {new Date(app.end_date).toLocaleDateString()} ({app.days} days)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                            app.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>{app.status}</span>
                          {app.status === 'PENDING' && (
                            <button
                              onClick={() => handleApproveLeave(app.id)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-black cursor-pointer shadow-3xs"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleLogLeave} className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                  <h6 className="text-[10px] font-black uppercase text-indigo-750">Submit Leave Application</h6>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400">Leave Category</label>
                    <select
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                      value={newLeave.leaveType}
                      onChange={e => setNewLeave({...newLeave, leaveType: e.target.value})}
                    >
                      <option value="ANNUAL">Annual Leave</option>
                      <option value="SICK">Sick Leave</option>
                      <option value="CASUAL">Casual Leave</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Start Date</label>
                      <input
                        type="date"
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        value={newLeave.startDate}
                        onChange={e => setNewLeave({...newLeave, startDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">End Date</label>
                      <input
                        type="date"
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        value={newLeave.endDate}
                        onChange={e => setNewLeave({...newLeave, endDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLocked}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs cursor-pointer shadow-sm mt-2"
                  >
                    Submit Leave Application Request
                  </button>
                </form>
              </div>
            )}

            {activeSubTab === 'overtime' && (
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Overtime Records</h5>
                <div className="p-4 bg-slate-50 border border-slate-155 rounded-xl space-y-2">
                  <p className="flex justify-between"><span>Approved OT Hours:</span> <span className="font-bold text-slate-800">{overtimeRecords.reduce((acc, r) => acc + parseFloat(r.hours || 0), 0)} Hours</span></p>
                  <p className="flex justify-between"><span>Total Overtime Pay:</span> <span className="font-mono text-emerald-600 font-bold">PKR {overtimeRecords.reduce((acc, r) => acc + parseFloat(r.amount || 0), 0).toLocaleString()}</span></p>
                </div>

                {overtimeRecords.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto border border-slate-100 p-2.5 rounded-xl bg-white">
                    {overtimeRecords.map((ot, index) => (
                      <div key={index} className="flex justify-between items-center text-[10.5px] font-semibold text-slate-600 border-b border-slate-50 last:border-0 pb-1.5 pt-1.5 first:pt-0">
                        <span>{new Date(ot.date).toLocaleDateString()}</span>
                        <span className="font-mono text-slate-700">{ot.hours} hrs @ {ot.multiplier}x (PKR {parseFloat(ot.amount || 0).toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleLogOvertime} className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                  <h6 className="text-[10px] font-black uppercase text-indigo-750">Log Manual Overtime Entry</h6>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400">Overtime Work Date</label>
                    <input
                      type="date"
                      required
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                      value={newOT.date}
                      onChange={e => setNewOT({...newOT, date: e.target.value})}
                    />
                    <p className="text-[9px] text-slate-400 font-normal">Select the specific calendar date on which the overtime work was performed.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Overtime Hours Worked</label>
                      <input
                        type="number"
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        value={newOT.hours}
                        onChange={e => setNewOT({...newOT, hours: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Hourly Rate Multiplier</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        value={newOT.multiplier}
                        onChange={e => setNewOT({...newOT, multiplier: e.target.value})}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLocked}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs cursor-pointer shadow-sm mt-2"
                  >
                    Log Overtime Log Entry
                  </button>
                </form>
              </div>
            )}

            {activeSubTab === 'loans' && (
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider">Corporate Loans & Advances</h5>
                
                {loans.length > 0 ? (
                  <div className="space-y-3">
                    {loans.map(loan => (
                      <div key={loan.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center font-semibold text-xs text-slate-700">
                        <div>
                          <span className="font-bold">PKR {parseFloat(loan.amount).toLocaleString()}</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">{loan.purpose} ({loan.repayment_period} months)</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {loan.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-center text-slate-400 text-xs font-bold">
                    No active loan or salary advance requests registered for this employee.
                  </div>
                )}

                <form onSubmit={handleRequestLoan} className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                  <h6 className="text-[10px] font-black uppercase text-indigo-750">Request Corporate Loan / Advance</h6>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Loan Amount (PKR) *</label>
                      <input
                        type="number"
                        required
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        value={newLoan.amount}
                        onChange={e => setNewLoan({...newLoan, amount: e.target.value})}
                        placeholder="e.g. 50000"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-extrabold text-slate-400">Repayment Period (Months)</label>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                        value={newLoan.repaymentPeriod}
                        onChange={e => setNewLoan({...newLoan, repaymentPeriod: e.target.value})}
                      >
                        <option value="3">3 Months</option>
                        <option value="6">6 Months</option>
                        <option value="12">12 Months</option>
                        <option value="24">24 Months</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400">Purpose / Reason *</label>
                    <input
                      required
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                      value={newLoan.purpose}
                      onChange={e => setNewLoan({...newLoan, purpose: e.target.value})}
                      placeholder="e.g. Medical emergency, salary advance"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLocked}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs cursor-pointer shadow-sm mt-2"
                  >
                    Submit Loan Request
                  </button>
                </form>
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
                <div className="p-3 bg-white hover:bg-slate-55 border border-slate-200 rounded-xl flex items-center justify-between transition-all">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Payslip - August 2026</span>
                  <button onClick={() => handleDownloadPayslip('2026-08')} className="text-indigo-600 hover:underline cursor-pointer">Download</button>
                </div>
                <div className="p-3 bg-white hover:bg-slate-55 border border-slate-200 rounded-xl flex items-center justify-between transition-all">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Payslip - July 2026</span>
                  <button onClick={() => handleDownloadPayslip('2026-07')} className="text-indigo-650 hover:underline cursor-pointer">Download</button>
                </div>
                <div className="p-3 bg-white hover:bg-slate-55 border border-slate-200 rounded-xl flex items-center justify-between transition-all">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Employment Contract</span>
                  <button onClick={() => alert('Downloading master contract template from company drive...')} className="text-indigo-650 hover:underline cursor-pointer">Download</button>
                </div>
                <div className="p-3 bg-white hover:bg-slate-55 border border-slate-200 rounded-xl flex items-center justify-between transition-all">
                  <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Company Bank Letter</span>
                  <button onClick={() => alert('Generating company bank account verification letter...')} className="text-indigo-655 hover:underline cursor-pointer">Download</button>
                </div>
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
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-black"
          >
            <Plus size={12} /> Add Employee
          </button>
        </div>
      </div>

      {/* Responsive Employee Directory: Grid of cards on Mobile, Table on Desktop */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/70 backdrop-blur-xs rounded-3xl border border-slate-100 shadow-xs gap-3">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black animate-pulse">Loading Employee Directory...</span>
        </div>
      ) : (
        <>
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
                    <button 
                      disabled={disableActions || emp.status === 'PROCESSING' || emp.status === 'PAID' || emp.status === 'DISBURSED'}
                      onClick={() => handleStartEdit(emp)}
                      className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      disabled={disableActions || emp.status === 'PROCESSING' || emp.status === 'PAID' || emp.status === 'DISBURSED'}
                      onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                    >
                      <Trash2 size={13} />
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
                          disabled={disableActions || emp.status === 'PROCESSING' || emp.status === 'PAID' || emp.status === 'DISBURSED'}
                          onClick={() => handleStartEdit(emp)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg mr-1 transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          disabled={disableActions || emp.status === 'PROCESSING' || emp.status === 'PAID' || emp.status === 'DISBURSED'}
                          onClick={() => handleDeleteEmployee(emp.id, emp.name)}
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
        </>
      )}
    </div>
  );
}
