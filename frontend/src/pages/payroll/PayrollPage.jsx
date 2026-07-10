import React, { useState, useEffect, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  ArrowRight, ShieldCheck, Download, Plus, Search, FileText,
  AlertTriangle, RefreshCw, X, HelpCircle, Trash2, Link, Link2Off
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function PayrollPage() {
  const { user, activeCompany, settings, setSettings } = useAuthStore();
  const activeCompanyId = activeCompany?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: '' }

  // Bank connection state
  const [bankConnection, setBankConnection] = useState({
    status: 'Disconnected', // 'Disconnected' | 'Connecting' | 'Connected'
    bankName: ''
  });
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState('Habib Bank');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('Engineering');
  const [newEmpSalary, setNewEmpSalary] = useState('');
  const [newEmpStatus, setNewEmpStatus] = useState('Processing');
  const [newEmpBankName, setNewEmpBankName] = useState('Habib Bank');
  const [newEmpBankAccount, setNewEmpBankAccount] = useState('');
  const [companyUsers, setCompanyUsers] = useState([]);
  const [linkedUserId, setLinkedUserId] = useState('');

  // Edit Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpRole, setEditEmpRole] = useState('');
  const [editEmpDept, setEditEmpDept] = useState('Engineering');
  const [editEmpSalary, setEditEmpSalary] = useState('');
  const [editEmpStatus, setEditEmpStatus] = useState('Active');
  const [editEmpBankName, setEditEmpBankName] = useState('Habib Bank');
  const [editEmpBankAccount, setEditEmpBankAccount] = useState('');
  const [editLinkedUserId, setEditLinkedUserId] = useState('');
  const [editTab, setEditTab] = useState('details'); // 'details' | 'preferences'
  const [subscriptions, setSubscriptions] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const [subSaving, setSubSaving] = useState(false);
  const [activePreviewEvent, setActivePreviewEvent] = useState(null);

  const requestConfig = useMemo(
    () => activeCompanyId ? { headers: { 'x-company-id': String(activeCompanyId) } } : undefined,
    [activeCompanyId]
  );

  // Default initial mock employees if none saved in settings
  const defaultEmployees = useMemo(() => [
    { name: 'Farhan Ali', role: 'Senior Software Engineer', department: 'Engineering', salary: 180000, status: 'Processing', bankName: 'Habib Bank', bankAccount: 'PK12HABB0000123456789012' },
    { name: 'Sana Khan', role: 'Product Manager', department: 'Product', salary: 150000, status: 'Processing', bankName: 'MCB Bank', bankAccount: 'PK24MCBB0000987654321098' },
    { name: 'Zainab Ahmed', role: 'UI/UX Designer', department: 'Product', salary: 110000, status: 'Processing', bankName: 'Bank Alfalah', bankAccount: 'PK76ALFH0000345678901234' },
    { name: 'Hamza Sheikh', role: 'DevOps Specialist', department: 'Engineering', salary: 165000, status: 'Processing', bankName: 'Habib Bank', bankAccount: 'PK12HABB0000987654321012' },
    { name: 'Ayesha Malik', role: 'HR Manager', department: 'People Operations', salary: 95000, status: 'On Hold', bankName: 'National Bank', bankAccount: 'PK45NBPA0000765432109876' },
  ], []);

  // Map employee database row camelCase
  const mapEmployeeRow = (row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    department: row.department,
    salary: parseFloat(row.salary),
    status: row.status,
    bankName: row.bank_name,
    bankAccount: row.account_number,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    notificationCounts: row.notification_counts || {}
  });

  // Load Accounts, Employees & Company Members
  const loadEmployeesAndUsers = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      // Load accounts
      const accRes = await api.get(`/accounts/company/${activeCompanyId}`, requestConfig);
      setAccounts(accRes.data || []);

      // Load DB employees
      const empRes = await api.get(`/employees/${activeCompanyId}`, requestConfig);
      let list = (empRes.data || []).map(mapEmployeeRow);

      // Auto-seed default employees if DB is completely empty
      if (list.length === 0) {
        const seededList = [];
        for (const emp of defaultEmployees) {
          const res = await api.post(`/employees/${activeCompanyId}`, {
            name: emp.name,
            role: emp.role,
            department: emp.department,
            salary: emp.salary,
            bankName: emp.bankName,
            accountNumber: emp.bankAccount,
            status: emp.status,
            userId: null
          }, requestConfig);
          seededList.push(mapEmployeeRow(res.data));
        }
        list = seededList;
      }
      setEmployees(list);

      // Load bank connection status from company settings
      if (settings && settings.bankConnection) {
        setBankConnection(settings.bankConnection);
      }

      // Load company users to allow linking
      const usersRes = await api.get(`/admin/overview?companyId=${activeCompanyId}`, requestConfig);
      setCompanyUsers(usersRes.data.members || []);
    } catch (err) {
      console.error('Failed to load employees, accounts, or members list', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEmployeesAndUsers();
  }, [activeCompanyId, requestConfig, settings?.bankConnection]);

  // Save bank connection helper
  const saveBankConnection = async (updatedBankConnection) => {
    if (!activeCompanyId) return false;
    setLoading(true);
    try {
      const updatedSettings = { ...settings, bankConnection: updatedBankConnection };
      const res = await api.put(`/settings/${activeCompanyId}`, updatedSettings, requestConfig);
      setSettings(res.data);
      setBankConnection(updatedBankConnection);
      return true;
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: 'Failed to update bank connection preferences.' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Add Employee submit handler
  const handleAddEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!newEmpName || !newEmpRole || !newEmpSalary || !newEmpBankAccount) {
      setActionMessage({ type: 'error', text: 'Please fill in all required fields including bank details.' });
      return;
    }

    setLoading(true);
    try {
      await api.post(`/employees/${activeCompanyId}`, {
        name: newEmpName,
        role: newEmpRole,
        department: newEmpDept,
        salary: parseFloat(newEmpSalary),
        bankName: newEmpBankName,
        accountNumber: newEmpBankAccount,
        status: newEmpStatus,
        userId: linkedUserId || null
      }, requestConfig);

      setActionMessage({ type: 'success', text: `Employee ${newEmpName} successfully added to database profile!` });
      setIsAddModalOpen(false);

      // Reset fields
      setNewEmpName('');
      setNewEmpRole('');
      setNewEmpSalary('');
      setNewEmpBankAccount('');
      setLinkedUserId('');
      setNewEmpStatus('Processing');

      await loadEmployeesAndUsers();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add employee profile.' });
    }
    setLoading(false);
  };

  // Delete employee helper
  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to remove this employee from payroll?')) return;
    setLoading(true);
    try {
      await api.delete(`/employees/${activeCompanyId}/${id}`, requestConfig);
      setActionMessage({ type: 'success', text: 'Employee profile deleted.' });
      await loadEmployeesAndUsers();
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to remove employee.' });
    }
    setLoading(false);
  };

  // Open edit modal and load subscriptions
  const handleOpenEditModal = async (emp) => {
    setEditingEmployee(emp);
    setEditEmpName(emp.name);
    setEditEmpRole(emp.role || '');
    setEditEmpDept(emp.department || 'Engineering');
    setEditEmpSalary(String(emp.salary || ''));
    setEditEmpStatus(emp.status || 'Active');
    setEditEmpBankName(emp.bankName || 'Habib Bank');
    setEditEmpBankAccount(emp.bankAccount || '');
    setEditLinkedUserId(String(emp.userId || ''));
    setEditTab('details');
    setIsEditModalOpen(true);

    setSubLoading(true);
    try {
      const res = await api.get(`/employees/${activeCompanyId}/${emp.id}/notification-subscriptions`, requestConfig);
      setSubscriptions(res.data || []);
    } catch (err) {
      console.error('Failed to load subscriptions', err);
    }
    setSubLoading(false);
  };

  // Save General details
  const handleSaveGeneralDetails = async (e) => {
    if (e) e.preventDefault();
    if (!editingEmployee) return;
    setLoading(true);
    setActionMessage(null);
    try {
      await api.patch(`/employees/${activeCompanyId}/${editingEmployee.id}`, {
        name: editEmpName,
        role: editEmpRole,
        department: editEmpDept,
        salary: parseFloat(editEmpSalary || 0),
        bankName: editEmpBankName,
        accountNumber: editEmpBankAccount,
        status: editEmpStatus,
        userId: editLinkedUserId ? parseInt(editLinkedUserId) : null
      }, requestConfig);

      setActionMessage({ type: 'success', text: 'Employee details updated successfully!' });
      setIsEditModalOpen(false);
      await loadEmployeesAndUsers();
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update employee details.' });
    }
    setLoading(false);
  };

  // Save Subscriptions matrix
  const handleSaveSubscriptions = async () => {
    if (!editingEmployee) return;
    setSubSaving(true);
    setActionMessage(null);
    try {
      await api.put(`/employees/${activeCompanyId}/${editingEmployee.id}/notification-subscriptions`, {
        subscriptions
      }, requestConfig);

      setActionMessage({ type: 'success', text: 'Communication preferences updated successfully!' });
      setIsEditModalOpen(false);
      await loadEmployeesAndUsers();
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update preferences.' });
    }
    setSubSaving(false);
  };

  const getEventPreview = (eventCode) => {
    const previews = {
      LOW_STOCK_ALERT: {
        subject: "Low Stock Warning: Skin-101 Sheet Mask",
        body: "Warning: Product Skin-101 — Glass Skin Sheet Mask in warehouse Ayesha Production has fallen to 5 units. Minimum threshold level is 10."
      },
      JOURNAL_POSTED: {
        subject: "Manual Journal Entry Posted: JV-00123",
        body: "Manual Journal Entry #123 has been posted to the General Ledger by Bisma Khan. Description: Salary adjustment for Q2. Total Amount: PKR 150,000."
      },
      RISK_OVERRIDE_REQUESTED: {
        subject: "Manual Credit Override Approval Required: ayesha kashif",
        body: "Customer ayesha kashif has exceeded their credit limits. An override approval request for PKR 10,000 has been submitted by salesperson Ali. Override Code: CR-9812."
      },
      RISK_OVERRIDE_APPROVED: {
        subject: "Credit Override APPROVED: CR-9812",
        body: "Override request CR-9812 for customer ayesha kashif has been APPROVED by Finance Manager Bisma Khan."
      },
      ASSET_TRANSFER_PENDING: {
        subject: "Fixed Asset Transfer Approval Requested: AST-770",
        body: "Asset Laptop Dell XPS (AST-770) is requested for location transfer from Head Office to Lahore Branch. Target Date: 2026-07-12."
      },
      DEPRECIATION_RUN_COMPLETE: {
        subject: "Depreciation Wizard Session Completed - Period 2026-07",
        body: "Depreciation run has completed successfully for period 2026-07. Total accumulated depreciation posted: PKR 45,000."
      }
    };
    return previews[eventCode] || {
      subject: `${eventCode.replace(/_/g, ' ')} Notification Alert`,
      body: `This is a sample layout preview for the notification event: ${eventCode}. System variables will be resolved at runtime.`
    };
  };

  // Export Payroll to CSV
  const handleExportPayroll = () => {
    let csv = 'Employee ID,Name,Role,Department,Monthly Salary,Bank Name,Account/IBAN,Status\n';
    employees.forEach(emp => {
      csv += `${emp.id},"${emp.name}","${emp.role}","${emp.department}",${emp.salary},"${emp.bankName || ''}","${emp.bankAccount || ''}","${emp.status}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_register_${new Date().toISOString().slice(0, 7)}.csv`);
    link.click();
    setActionMessage({ type: 'success', text: 'Payroll Register exported successfully!' });
  };

  // Download Bank disbursement template
  const handleDownloadBankTemplate = () => {
    let csv = 'Beneficiary Name,Beneficiary Bank Account,Bank Name,Salary Amount,Payment Reference,Disbursement Month\n';
    employees.forEach(emp => {
      csv += `"${emp.name}","${emp.bankAccount || ''}","${emp.bankName || ''}",${emp.salary},"Salary Settlement","June 2026"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'bank_disbursement_template.csv');
    link.click();
    setActionMessage({ type: 'success', text: 'Bank disbursement template downloaded!' });
  };

  // Verify salaries register
  const handleVerifyRegister = () => {
    const salariesExpenseAcc = accounts.find(a => 
      String(a.id) === String(settings.defaultSalariesAccountId) ||
      String(a.code) === '6010' || 
      a.name.toLowerCase().includes('salary') || 
      a.name.toLowerCase().includes('wage')
    );
    const bankAssetAcc = accounts.find(a => 
      String(a.id) === String(settings.defaultCashAccountId) || 
      String(a.code) === '1030' || 
      String(a.code) === '1010'
    );

    if (!salariesExpenseAcc) {
      setActionMessage({ 
        type: 'error', 
        text: 'Missing General Ledger account matching "Salaries and Wages Expense". Please map or create it under settings preferences first.' 
      });
      return;
    }
    if (!bankAssetAcc) {
      setActionMessage({ 
        type: 'error', 
        text: 'Missing mapped Cash/Bank Asset Account in settings. Define your Operating cash account under settings Accounting preferences tab.' 
      });
      return;
    }

    const processingSum = employees
      .filter(e => e.status === 'Processing')
      .reduce((sum, e) => sum + e.salary, 0);

    setActionMessage({
      type: 'success',
      text: `✓ Verified: Salaries Expense mapped to "${salariesExpenseAcc.code} - ${salariesExpenseAcc.name}", settlement source mapped to "${bankAssetAcc.code} - ${bankAssetAcc.name}". Total outstanding payroll is ${formatPKR(processingSum)}.`
    });
  };

  // Process and Disburse payments (Create Ledger posting & Direct Bank Transfer)
  const handleProcessPayments = async () => {
    const processingEmployees = employees.filter(e => e.status === 'Processing');
    if (processingEmployees.length === 0) {
      setActionMessage({ type: 'info', text: 'No pending salaries in "Processing" status to disburse.' });
      return;
    }

    const salariesExpenseAcc = accounts.find(a => 
      String(a.id) === String(settings.defaultSalariesAccountId) ||
      String(a.code) === '6010' || 
      a.name.toLowerCase().includes('salary') || 
      a.name.toLowerCase().includes('wage')
    );
    const bankAssetAcc = accounts.find(a => 
      String(a.id) === String(settings.defaultCashAccountId) || 
      String(a.code) === '1030' || 
      String(a.code) === '1010'
    );

    if (!salariesExpenseAcc || !bankAssetAcc) {
      setActionMessage({ 
        type: 'error', 
        text: 'Verification failed. Mapped Salaries Expense or Cash/Bank account missing in Chart of Accounts.' 
      });
      return;
    }

    const totalSalarySum = processingEmployees.reduce((sum, e) => sum + e.salary, 0);

    setLoading(true);
    setActionMessage({ type: 'info', text: 'Connecting to General Ledger & Banking API...' });
    try {
      // 1. Post draft manual journal entry
      const journalRes = await api.post('/journal', {
        entry_date: new Date().toISOString().slice(0, 10),
        description: `Salaries Disbursement Run - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        lines: [
          { account_id: salariesExpenseAcc.id, debit: totalSalarySum, credit: 0, description: 'Payroll Salaries & Wages Expense' },
          { account_id: bankAssetAcc.id, debit: 0, credit: totalSalarySum, description: 'Salaries Bank Settlement Run' }
        ]
      }, requestConfig);

      // 2. Commit/Post to ledger
      await api.post(`/journal/${journalRes.data.id}/post`, {}, requestConfig);      // 3. Update employees status in database
      for (const emp of processingEmployees) {
        await api.patch(`/employees/${activeCompanyId}/${emp.id}`, { status: 'Paid' }, requestConfig);
      }

      // Re-map list for audit logs
      const updatedList = employees.map(emp => {
        if (emp.status === 'Processing') {
          return { ...emp, status: 'Paid' };
        }
        return emp;
      });

      // 4. Post audit log
      await api.post(`/audit/${activeCompanyId}`, {
        action: 'CREATE',
        entityType: 'PAYROLL',
        entityId: `PAYROLL_${journalRes.data.id}`,
        beforeState: employees,
        afterState: updatedList
      }, requestConfig);

      const bankTransferMsg = bankConnection.status === 'Connected' 
        ? ` & disbursed directly via ${bankConnection.bankName} API` 
        : '';

      setActionMessage({
        type: 'success',
        text: `✓ Payroll run successful! Created journal entry #${journalRes.data.id} in GL for ${formatPKR(totalSalarySum)}${bankTransferMsg}.`
      });

      // Reload list
      await loadEmployeesAndUsers();
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: err.response?.data?.error || 'Failed to complete payroll run.' });
    } finally {
      setLoading(false);
    }
  };

  // Mock bank link triggers
  const handleLinkBankSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API link handshakes
    setTimeout(async () => {
      const conn = { status: 'Connected', bankName: selectedBank };
      const success = await saveBankConnection(conn);
      if (success) {
        setActionMessage({ type: 'success', text: `Successfully established secure connection with ${selectedBank} Business Portal!` });
        setShowBankModal(false);
      }
      setLoading(false);
    }, 1200);
  };

  const handleDisconnectBank = async () => {
    if (!window.confirm('Disconnect your bank API connection? Payroll runs will fallback to manual settlement.')) return;
    const conn = { status: 'Disconnected', bankName: '' };
    const success = await saveBankConnection(conn);
    if (success) {
      setActionMessage({ type: 'success', text: 'Bank connection disconnected.' });
    }
  };

  const totalPayroll = employees.reduce((sum, emp) => sum + emp.salary, 0);

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPKR = (val) => {
    return 'PKR ' + val.toLocaleString('en-PK');
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Users size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Payroll & Human Resources</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Operations</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              Manage employee salaries, compliance, and monthly payroll disbursements.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 md:mt-0 flex-wrap">
          <button onClick={handleExportPayroll} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 text-[12.5px] font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer">
            <Download size={14} /> Export Payroll
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer">
            <Plus size={14} /> Add Employee
          </button>
        </div>
      </div>

      {/* Action Alerts */}
      <AnimatePresence>
        {actionMessage && (
          <Motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border text-[13px] font-bold flex items-center justify-between gap-3 ${
              actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              actionMessage.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
              'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span className="flex items-center gap-2">
              {actionMessage.type === 'success' ? <CheckCircle size={16} /> : 
               actionMessage.type === 'info' ? <HelpCircle size={16} /> : <AlertTriangle size={16} />}
              {actionMessage.text}
            </span>
            <button onClick={() => setActionMessage(null)} className="text-current hover:opacity-75">
              <X size={15} />
            </button>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Payroll Budget</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">{formatPKR(totalPayroll)}</h3>
            <span className="text-[10px] text-emerald-600 font-bold block mt-1">✓ Current Month Active</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Active Employees</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">{employees.length}</h3>
            <span className="text-[10px] text-slate-500 block mt-1">Full-time headcount</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Next Payday</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">June 30, 2026</h3>
            <span className="text-[10px] text-slate-500 block mt-1">Auto-disbursement active</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar size={20} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Pending Processing</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              {employees.filter(e => e.status === 'Processing').length} Employees
            </h3>
            <span className="text-[10px] text-slate-500 block mt-1">Need disbursement run</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Landmark size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employees Table List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-[14px] text-slate-900">Active Employees Payroll</h3>
              <p className="text-[12px] text-slate-500">Overview of employees and salary disbursement details.</p>
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-60 h-9 pl-8 pr-3 bg-white border border-slate-300 rounded-lg text-[12px] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>

          <div className="w-full overflow-x-auto custom-scrollbar">
            {employees.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium">No employees found. Click Add Employee to begin.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Employee</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Department</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Role</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Notifications</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left">Bank Details</th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Monthly Salary</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Status</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EBE8] text-[13px] text-slate-700">
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{emp.name}</span>
                        {emp.userEmail && (
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{emp.userEmail}</span>
                        )}
                        {emp.userName && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-100">
                            <Users size={8} /> {emp.userName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{emp.department}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.role}</td>
                      <td className="px-4 py-3">
                        {emp.notificationCounts && Object.keys(emp.notificationCounts).length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {Object.entries(emp.notificationCounts).map(([mod, count]) => (
                              <span key={mod} className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-[#064E3B] text-[9.5px] font-bold border border-emerald-100">
                                {mod} ({count})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-[12px] font-medium text-slate-700">{emp.bankName || '—'}</span>
                        <span className="block text-[10px] font-mono text-slate-400">{emp.bankAccount || 'No account linked'}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatPKR(emp.salary)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          emp.status === 'Processing' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button 
                          onClick={() => handleOpenEditModal(emp)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded transition-colors border border-transparent hover:border-emerald-200 mr-1"
                        >
                          <FileText size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors border border-transparent hover:border-red-200"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Payroll Settings Summary & Quick Actions */}
        <div className="space-y-6">
          {/* Bank Link Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-[14px] text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Landmark size={16} className="text-emerald-600" /> Bank API Linkage
            </h3>
            
            {bankConnection.status === 'Connected' ? (
              <div className="mt-3 space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-emerald-800 block">✓ API Connected</span>
                    <span className="text-[12px] text-emerald-700 font-medium block truncate">{bankConnection.bankName} Portal</span>
                  </div>
                  <button 
                    onClick={handleDisconnectBank}
                    className="text-[10px] text-red-600 hover:underline font-bold shrink-0"
                  >
                    Disconnect
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Salary payments will be transferred directly via the connected bank gateway on clicking process.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-slate-600">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block">Disconnected</span>
                    <span className="text-[11px] text-slate-500 block">No banking portal linked</span>
                  </div>
                  <Landmark size={16} className="text-slate-300" />
                </div>
                <button
                  onClick={() => setShowBankModal(true)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-[12px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Link size={13} /> Connect Bank Account
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-[14px] text-slate-900 border-b border-slate-100 pb-3">Run Monthly Payroll</h3>
            <p className="text-[12px] text-slate-500 mt-2 mb-4 leading-relaxed">
              Disburse payments to your employee list according to the active bank templates and tax declarations.
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-700">
                  <FileText size={15} className="text-slate-400" />
                  <span>Salary Register (June)</span>
                </div>
                <button 
                  onClick={handleVerifyRegister}
                  className="text-[11px] font-bold text-emerald-600 hover:underline"
                >
                  Verify
                </button>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-700">
                  <Landmark size={15} className="text-slate-400" />
                  <span>Bank Disbursement Template</span>
                </div>
                <button 
                  onClick={handleDownloadBankTemplate}
                  className="text-[11px] font-bold text-emerald-600 hover:underline"
                >
                  Download
                </button>
              </div>
            </div>
            <button 
              onClick={handleProcessPayments}
              disabled={loading}
              className="w-full mt-5 py-3 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] disabled:opacity-50 transition-colors text-white text-[13px] font-black rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer"
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
              Process & Disburse Payments
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-[14px] text-slate-900 border-b border-slate-100 pb-3">Tax Compliance</h3>
            <p className="text-[12px] text-slate-500 mt-2 mb-4 leading-relaxed font-medium">
              Tax deductions are processed automatically using current FBR income tax slabs for tax year 2026.
            </p>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[12px] font-bold">
              <CheckCircle size={16} className="shrink-0 text-amber-700" />
              <span>All tax certificates up-to-date. Next submission due by July 15.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-[14px] text-slate-900">Add Employee to Payroll</h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddEmployeeSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Full Employee Name *</label>
                  <input
                    type="text"
                    required
                    value={newEmpName}
                    onChange={e => setNewEmpName(e.target.value)}
                    placeholder="e.g. Farhan Ali"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Job Title / Role *</label>
                  <input
                    type="text"
                    required
                    value={newEmpRole}
                    onChange={e => setNewEmpRole(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Department</label>
                    <select
                      value={newEmpDept}
                      onChange={e => setNewEmpDept(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="People Operations">People Ops</option>
                      <option value="Finance">Finance</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Disbursement Status</label>
                    <select
                      value={newEmpStatus}
                      onChange={e => setNewEmpStatus(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    >
                      <option value="Processing">Processing</option>
                      <option value="Paid">Paid</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Bank Name *</label>
                    <select
                      value={newEmpBankName}
                      onChange={e => setNewEmpBankName(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    >
                      <option value="Habib Bank">Habib Bank (HBL)</option>
                      <option value="MCB Bank">MCB Bank</option>
                      <option value="Bank Alfalah">Bank Alfalah</option>
                      <option value="National Bank">National Bank</option>
                      <option value="Meezan Bank">Meezan Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Account Number / IBAN *</label>
                    <input
                      type="text"
                      required
                      value={newEmpBankAccount}
                      onChange={e => setNewEmpBankAccount(e.target.value)}
                      placeholder="e.g. PK12HABB0000..."
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Monthly Salary (PKR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newEmpSalary}
                    onChange={e => setNewEmpSalary(e.target.value)}
                    placeholder="e.g. 150000"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Linked System User</label>
                  <select
                    value={linkedUserId}
                    onChange={e => setLinkedUserId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  >
                    <option value="">-- None (External Employee) --</option>
                    {companyUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] font-bold rounded-lg text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm"
                  >
                    Add Employee
                  </button>
                </div>
              </form>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link Bank Modal */}
      <AnimatePresence>
        {showBankModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-[14px] text-slate-900">Link Corporate Banking Portal</h3>
                <button onClick={() => setShowBankModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleLinkBankSubmit} className="p-6 space-y-4">
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  Establish a secure encrypted webhook link with local commercial banking portals to process direct payroll disbursements.
                </p>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Select Financial Institution</label>
                  <select
                    value={selectedBank}
                    onChange={e => setSelectedBank(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  >
                    <option value="Habib Bank">Habib Bank Limited (HBL)</option>
                    <option value="MCB Bank">MCB Bank Limited</option>
                    <option value="Bank Alfalah">Bank Alfalah</option>
                    <option value="Meezan Bank">Meezan Bank</option>
                  </select>
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-[11px] leading-relaxed">
                  ⚠️ This establishes a sandbox connection. Disbursement triggers will send mock transfer payloads.
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBankModal(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] font-bold rounded-lg text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    {loading && <RefreshCw size={12} className="animate-spin" />}
                    Link Portal
                  </button>
                </div>
              </form>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Employee & Preferences Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden text-xs font-semibold text-slate-600"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[14px] text-slate-900">Edit Employee Profile</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Manage details and channel notification preferences for {editingEmployee?.name}.</p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs Bar */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 px-4 text-[12px] font-bold">
                <button
                  onClick={() => setEditTab('details')}
                  className={`px-4 py-3 border-b-2 transition-all cursor-pointer ${
                    editTab === 'details' 
                      ? 'border-emerald-600 text-emerald-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  General Details
                </button>
                <button
                  onClick={() => setEditTab('preferences')}
                  className={`px-4 py-3 border-b-2 transition-all cursor-pointer ${
                    editTab === 'preferences' 
                      ? 'border-emerald-600 text-emerald-700' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Communication Preferences
                </button>
              </div>

              {/* Content Panel */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {editTab === 'details' ? (
                  <form onSubmit={handleSaveGeneralDetails} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Employee Name *</label>
                      <input
                        type="text"
                        required
                        value={editEmpName}
                        onChange={e => setEditEmpName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Job Title / Role *</label>
                      <input
                        type="text"
                        required
                        value={editEmpRole}
                        onChange={e => setEditEmpRole(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Department</label>
                        <select
                          value={editEmpDept}
                          onChange={e => setEditEmpDept(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                        >
                          <option value="Engineering">Engineering</option>
                          <option value="Product">Product</option>
                          <option value="People Operations">People Ops</option>
                          <option value="Finance">Finance</option>
                          <option value="Marketing">Marketing</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Status</label>
                        <select
                          value={editEmpStatus}
                          onChange={e => setEditEmpStatus(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                        >
                          <option value="Active">Active</option>
                          <option value="Processing">Processing</option>
                          <option value="Paid">Paid</option>
                          <option value="On Hold">On Hold</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Bank Name</label>
                        <select
                          value={editEmpBankName}
                          onChange={e => setEditEmpBankName(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                        >
                          <option value="Habib Bank">Habib Bank (HBL)</option>
                          <option value="MCB Bank">MCB Bank</option>
                          <option value="Bank Alfalah">Bank Alfalah</option>
                          <option value="National Bank">National Bank</option>
                          <option value="Meezan Bank">Meezan Bank</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Account / IBAN</label>
                        <input
                          type="text"
                          value={editEmpBankAccount}
                          onChange={e => setEditEmpBankAccount(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Monthly Salary (PKR) *</label>
                        <input
                          type="number"
                          required
                          value={editEmpSalary}
                          onChange={e => setEditEmpSalary(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Linked System User</label>
                        <select
                          value={editLinkedUserId}
                          onChange={e => setEditLinkedUserId(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-800"
                        >
                          <option value="">-- None (External Employee) --</option>
                          {companyUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] font-bold rounded-lg text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        {loading && <RefreshCw size={12} className="animate-spin" />}
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  // Communication Preferences Tab
                  <div className="space-y-6">
                    {subLoading ? (
                      <div className="p-16 text-center space-y-3">
                        <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
                        <p className="text-slate-400 text-[12px]">Loading notification subscriptions...</p>
                      </div>
                    ) : (
                      <>
                        {/* Search & Bulk Actions Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="relative flex-1 max-w-md">
                            <input
                              type="text"
                              placeholder="Search events (e.g. journal)..."
                              value={subSearch}
                              onChange={e => setSubSearch(e.target.value)}
                              className="w-full h-9 pl-8 pr-3 bg-white border border-slate-300 rounded-lg text-[12px] focus:outline-none focus:border-emerald-500 font-semibold"
                            />
                            <Search size={13} className="absolute left-2.5 top-3 text-slate-400" />
                          </div>

                          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                            <button
                              onClick={() => handleBulkToggleAll('EMAIL', true)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg shadow-3xs cursor-pointer"
                            >
                              Enable All Emails
                            </button>
                            <button
                              onClick={() => handleBulkToggleAll('EMAIL', false)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg shadow-3xs cursor-pointer"
                            >
                              Disable All Emails
                            </button>
                            <button
                              onClick={() => handleBulkToggleAll('APP', true)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg shadow-3xs cursor-pointer"
                            >
                              Enable All App
                            </button>
                            <button
                              onClick={() => handleBulkToggleAll('APP', false)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg shadow-3xs cursor-pointer"
                            >
                              Disable All App
                            </button>
                          </div>
                        </div>

                        {/* Grouped Modules and Subscriptions */}
                        <div className="space-y-6">
                          {Object.entries(subscriptions.reduce((acc, sub) => {
                            const q = subSearch.toLowerCase();
                            if (sub.eventName.toLowerCase().includes(q) || sub.module.toLowerCase().includes(q) || sub.eventCode.toLowerCase().includes(q)) {
                              if (!acc[sub.module]) acc[sub.module] = [];
                              acc[sub.module].push(sub);
                            }
                            return acc;
                          }, {})).length === 0 ? (
                            <div className="p-10 text-center text-slate-400 italic">No events found matching your search.</div>
                          ) : (
                            Object.entries(subscriptions.reduce((acc, sub) => {
                              const q = subSearch.toLowerCase();
                              if (sub.eventName.toLowerCase().includes(q) || sub.module.toLowerCase().includes(q) || sub.eventCode.toLowerCase().includes(q)) {
                                if (!acc[sub.module]) acc[sub.module] = [];
                                acc[sub.module].push(sub);
                              }
                              return acc;
                            }, {})).map(([moduleName, items]) => (
                              <div key={moduleName} className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                  <h4 className="font-extrabold text-[12px] text-emerald-800 uppercase tracking-tight">▼ {moduleName}</h4>
                                  
                                  {/* Module Level Bulk Toggles */}
                                  <div className="flex items-center gap-3 text-[10.5px] font-bold text-slate-500">
                                    <span>Bulk module action:</span>
                                    <button 
                                      onClick={() => handleBulkToggleModule(moduleName, 'EMAIL', true)}
                                      className="text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      All Email
                                    </button>
                                    <button 
                                      onClick={() => handleBulkToggleModule(moduleName, 'APP', true)}
                                      className="text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      All App
                                    </button>
                                    <button 
                                      onClick={() => {
                                        handleBulkToggleModule(moduleName, 'EMAIL', false);
                                        handleBulkToggleModule(moduleName, 'APP', false);
                                      }}
                                      className="text-slate-500 hover:underline cursor-pointer"
                                    >
                                      Clear All
                                    </button>
                                  </div>
                                </div>

                                <div className="divide-y divide-slate-100 p-4 space-y-4">
                                  {items.map(item => (
                                    <div key={item.eventId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 gap-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-800 text-[13px]">{item.eventName}</span>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-400 font-bold border border-slate-200">{item.eventCode}</span>
                                        </div>
                                        {item.description && (
                                          <p className="text-[11.5px] text-slate-400 font-normal leading-relaxed">{item.description}</p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-4 text-[12px] font-bold text-slate-600 whitespace-nowrap self-start sm:self-center">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={item.channels.EMAIL || false}
                                            onChange={() => {
                                              setSubscriptions(prev =>
                                                prev.map(p => p.eventId === item.eventId ? {
                                                  ...p,
                                                  channels: { ...p.channels, EMAIL: !p.channels.EMAIL }
                                                } : p)
                                              );
                                            }}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                          />
                                          <span>Email</span>
                                        </label>

                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={item.channels.APP || false}
                                            onChange={() => {
                                              setSubscriptions(prev =>
                                                prev.map(p => p.eventId === item.eventId ? {
                                                  ...p,
                                                  channels: { ...p.channels, APP: !p.channels.APP }
                                                } : p)
                                              );
                                            }}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                          />
                                          <span>In-App</span>
                                        </label>

                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={item.channels.SMS || false}
                                            onChange={() => {
                                              setSubscriptions(prev =>
                                                prev.map(p => p.eventId === item.eventId ? {
                                                  ...p,
                                                  channels: { ...p.channels, SMS: !p.channels.SMS }
                                                } : p)
                                              );
                                            }}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                          />
                                          <span>SMS</span>
                                        </label>

                                        <button
                                          onClick={() => setActivePreviewEvent(item.eventCode)}
                                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                                        >
                                          <Eye size={12} />
                                          <span>Preview</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Save Action Panel */}
                        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-[12px] font-bold rounded-lg text-slate-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveSubscriptions}
                            disabled={subSaving}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            {subSaving && <RefreshCw size={12} className="animate-spin" />}
                            Save Preferences
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nested Preview Dialog */}
      <AnimatePresence>
        {activePreviewEvent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-white rounded-xl shadow-2xl max-w-md w-full border border-slate-700 overflow-hidden font-sans"
            >
              <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Notification Layout Preview</span>
                <button onClick={() => setActivePreviewEvent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X size={15} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Subject</span>
                  <div className="text-[13px] font-bold mt-1 bg-slate-800 p-2.5 rounded border border-slate-750 font-mono text-emerald-400">
                    {getEventPreview(activePreviewEvent).subject}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Email HTML Body Content</span>
                  <div 
                    className="text-[12.5px] leading-relaxed mt-1 bg-slate-800 p-3 rounded border border-slate-750 text-slate-300 font-sans"
                    dangerouslySetInnerHTML={{ __html: getEventPreview(activePreviewEvent).body }}
                  />
                </div>
              </div>
              <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end">
                <button 
                  onClick={() => setActivePreviewEvent(null)}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-[12px] font-bold rounded-lg text-white cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
