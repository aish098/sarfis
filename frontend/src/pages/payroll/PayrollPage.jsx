import React, { useState, useEffect, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { 
  Users, DollarSign, Calendar, Landmark, CheckCircle, 
  ArrowRight, ShieldCheck, Download, Plus, Search, FileText,
  AlertTriangle, RefreshCw, X, HelpCircle, Eye, Info, Play, RotateCcw, Ban
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function PayrollPage() {
  const { user, activeCompany } = useAuthStore();
  const activeCompanyId = activeCompany?.id;

  const [period, setPeriod] = useState('2026-08');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [details, setDetails] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Modals state
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdType, setHoldType] = useState('DOCUMENT');
  const [holdReason, setHoldReason] = useState('');
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjType, setAdjType] = useState('BONUS');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const [activeTab, setActiveTab] = useState('breakdown');

  const requestConfig = useMemo(
    () => activeCompanyId ? { headers: { 'x-company-id': String(activeCompanyId) } } : undefined,
    [activeCompanyId]
  );

  // Fetch employees list
  const loadEmployees = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const res = await api.get(`/payroll/${activeCompanyId}/employees?period=${period}`, requestConfig);
      setEmployees(res.data || []);
      if (res.data && res.data.length > 0) {
        // Auto-select first employee if none selected
        const firstLine = res.data[0];
        loadEmployeeDetails(firstLine.line_id);
      } else {
        setSelectedEmployee(null);
        setDetails(null);
      }
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.error || 'Failed to load employee payroll items.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed employee record
  const loadEmployeeDetails = async (lineId) => {
    setDetailsLoading(true);
    try {
      const res = await api.get(`/payroll/${activeCompanyId}/employee/${lineId}`, requestConfig);
      setDetails(res.data);
      const matched = employees.find(e => e.line_id === lineId);
      if (matched) {
        setSelectedEmployee(matched);
      } else {
        setSelectedEmployee(res.data.line);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load workspace details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [activeCompanyId, period]);

  const showToast = (type, text) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || emp.payment_status === statusFilter;
      const matchesDept = deptFilter === 'ALL' || emp.department === deptFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [employees, searchTerm, statusFilter, deptFilter]);

  // Departments list for filter
  const departments = useMemo(() => {
    const list = new Set(employees.map(e => e.department).filter(Boolean));
    return ['ALL', ...Array.from(list)];
  }, [employees]);

  // Hold salary payout
  const handleHold = async () => {
    if (!holdReason.trim()) return showToast('error', 'Hold reason is required.');
    try {
      await api.post(`/payroll/${activeCompanyId}/lines/${selectedEmployee.line_id}/hold`, {
        hold_type: holdType,
        reason: holdReason
      }, requestConfig);
      showToast('success', 'Salary successfully placed on HOLD.');
      setShowHoldModal(false);
      setHoldReason('');
      // Reload current employee and list
      await loadEmployees();
      if (selectedEmployee) loadEmployeeDetails(selectedEmployee.line_id);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to place salary on hold.');
    }
  };

  // Release hold
  const handleRelease = async () => {
    try {
      await api.post(`/payroll/${activeCompanyId}/lines/${selectedEmployee.line_id}/release`, {}, requestConfig);
      showToast('success', 'Salary hold successfully released.');
      await loadEmployees();
      if (selectedEmployee) loadEmployeeDetails(selectedEmployee.line_id);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to release salary hold.');
    }
  };

  // Disburse Single Salary
  const handlePay = async () => {
    try {
      const res = await api.post(`/payroll/${activeCompanyId}/lines/${selectedEmployee.line_id}/pay`, {
        payment_method: 'BANK',
        remarks: 'Salary payment executed via HBL Transfer API'
      }, requestConfig);
      showToast('success', 'Salary payment executed and posted to GL successfully.');
      await loadEmployees();
      if (selectedEmployee) loadEmployeeDetails(selectedEmployee.line_id);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Payment execution failed.');
    }
  };

  // Reverse Payment
  const handleReverse = async (paymentId) => {
    try {
      await api.post(`/payroll/${activeCompanyId}/lines/${paymentId}/reverse-payment`, {
        remarks: 'Reversing duplicate bank processing'
      }, requestConfig);
      showToast('success', 'Salary payment successfully reversed in GL.');
      await loadEmployees();
      if (selectedEmployee) loadEmployeeDetails(selectedEmployee.line_id);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Reversal execution failed.');
    }
  };

  // Add adjustment
  const handleAdjustment = async () => {
    if (!adjAmount || isNaN(parseFloat(adjAmount))) return showToast('error', 'Valid adjustment amount is required.');
    if (!adjReason.trim()) return showToast('error', 'Adjustment reason is required.');
    try {
      await api.post(`/payroll/${activeCompanyId}/lines/${selectedEmployee.line_id}/adjust`, {
        type: adjType,
        amount: parseFloat(adjAmount),
        reason: adjReason
      }, requestConfig);
      showToast('success', 'Adjustment applied successfully.');
      setShowAdjustModal(false);
      setAdjAmount('');
      setAdjReason('');
      await loadEmployees();
      if (selectedEmployee) loadEmployeeDetails(selectedEmployee.line_id);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to apply adjustment.');
    }
  };

  // Render Status Badge
  const renderStatus = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">PAID</span>;
      case 'ON_HOLD':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-rose-950 text-rose-400 border border-rose-800">ON HOLD</span>;
      case 'PENDING':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-amber-950 text-amber-400 border border-amber-800">PENDING</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-zinc-800 text-zinc-400">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionMessage && (
          <Motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2 ${
              actionMessage.type === 'success' 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                : 'bg-rose-950 text-rose-300 border-rose-800'
            }`}
          >
            <Info size={16} />
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Employee Payroll Workspace
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Monitor computations, apply adjustments, manage holds, and process individual payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-zinc-500" />
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-700"
          >
            <option value="2026-07">July 2026</option>
            <option value="2026-08">August 2026</option>
            <option value="2026-09">September 2026</option>
          </select>

          <button 
            onClick={loadEmployees}
            className="p-2 hover:bg-zinc-900 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4">
          <span className="text-xs text-zinc-500 font-medium block">TOTAL EMPLOYEES</span>
          <span className="text-2xl font-semibold mt-1 block">{employees.length}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4">
          <span className="text-xs text-zinc-500 font-medium block">PAID SALARIES</span>
          <span className="text-2xl font-semibold mt-1 text-emerald-400 block">
            {employees.filter(e => e.payment_status === 'PAID').length}
          </span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4">
          <span className="text-xs text-zinc-500 font-medium block">PENDING SALARIES</span>
          <span className="text-2xl font-semibold mt-1 text-amber-400 block">
            {employees.filter(e => e.payment_status === 'PENDING').length}
          </span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4">
          <span className="text-xs text-zinc-500 font-medium block">HELD SALARIES</span>
          <span className="text-2xl font-semibold mt-1 text-rose-400 block">
            {employees.filter(e => e.payment_status === 'ON_HOLD').length}
          </span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4">
          <span className="text-xs text-zinc-500 font-medium block">TOTAL NET PAYABLE</span>
          <span className="text-lg font-semibold mt-2 text-zinc-300 block">
            PKR {employees.reduce((acc, curr) => acc + parseFloat(curr.net_salary || 0), 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Workspace Double-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Search & Employee List (5 columns) */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col h-[700px]">
          {/* List Toolbar */}
          <div className="p-4 border-b border-zinc-850 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
              <input 
                type="text"
                placeholder="Search employee or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex gap-2">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="ON_HOLD">On Hold</option>
              </select>

              <select 
                value={deptFilter} 
                onChange={(e) => setDeptFilter(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-none"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d === 'ALL' ? 'All Depts' : d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List View */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-850">
            {loading ? (
              <div className="flex justify-center items-center h-48 text-zinc-500 gap-2">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">Loading employees...</span>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-20 text-zinc-500 text-sm">
                No payroll entries match search filters.
              </div>
            ) : (
              filteredEmployees.map(emp => (
                <div 
                  key={emp.line_id}
                  onClick={() => loadEmployeeDetails(emp.line_id)}
                  className={`p-4 cursor-pointer transition-colors flex justify-between items-center ${
                    selectedEmployee?.line_id === emp.line_id 
                      ? 'bg-zinc-850/60 border-l-4 border-amber-500' 
                      : 'hover:bg-zinc-850/20'
                  }`}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">{emp.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{emp.role} • {emp.department}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-zinc-300 block">PKR {parseFloat(emp.net_salary).toLocaleString()}</span>
                    <span className="mt-1 inline-block">{renderStatus(emp.payment_status)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Detailed Workspace view (7 columns) */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 min-h-[700px] flex flex-col">
          {detailsLoading ? (
            <div className="flex-1 flex justify-center items-center text-zinc-500 gap-2">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Loading workspace details...</span>
            </div>
          ) : !details ? (
            <div className="flex-1 flex flex-col justify-center items-center text-zinc-500 text-center py-20">
              <Users size={48} className="text-zinc-700 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-400">No Employee Selected</h3>
              <p className="text-sm text-zinc-500 mt-1">Select an employee from the left panel to begin.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Header section */}
              <div className="flex justify-between items-start border-b border-zinc-800 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-zinc-200">{details.employee.name}</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {details.employee.role || 'N/A'} • {details.employee.department || 'N/A'}
                  </p>
                </div>
                <div>
                  {renderStatus(details.line.payment_status)}
                </div>
              </div>

              {/* Toolbar Actions */}
              <div className="flex flex-wrap gap-2 mb-6 bg-zinc-950 p-2.5 rounded-lg border border-zinc-850">
                {details.line.payment_status === 'PENDING' && (
                  <>
                    <button 
                      onClick={handlePay}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-zinc-100 font-semibold rounded text-xs transition-colors flex items-center gap-1"
                    >
                      <Play size={12} /> Pay Single
                    </button>

                    <button 
                      onClick={() => setShowHoldModal(true)}
                      className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-zinc-100 font-semibold rounded text-xs transition-colors flex items-center gap-1"
                    >
                      <Ban size={12} /> Place Hold
                    </button>
                  </>
                )}

                {details.line.payment_status === 'ON_HOLD' && (
                  <button 
                    onClick={handleRelease}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-zinc-100 font-semibold rounded text-xs transition-colors flex items-center gap-1"
                  >
                    <CheckCircle size={12} /> Release Hold
                  </button>
                )}

                {details.line.payment_status === 'PENDING' && details.run.status === 'DRAFT' && (
                  <button 
                    onClick={() => setShowAdjustModal(true)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded text-xs border border-zinc-700 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Adjustment
                  </button>
                )}

                <span className="flex-1" />

                <a 
                  href={`/api/payroll/${activeCompanyId}/payslips/${details.employee.id}/${period}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs border border-zinc-700 transition-colors flex items-center gap-1"
                >
                  <Download size={12} /> Payslip PDF
                </a>
              </div>

              {/* Tabs list */}
              <div className="flex border-b border-zinc-800 mb-6 gap-6">
                <button 
                  onClick={() => setActiveTab('breakdown')}
                  className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === 'breakdown' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Breakdown
                </button>
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === 'overview' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Overview
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === 'history' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Payments
                </button>
                <button 
                  onClick={() => setActiveTab('audit')}
                  className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === 'audit' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Audit timeline
                </button>
              </div>

              {/* Tabs Content */}
              <div className="flex-1">
                {activeTab === 'breakdown' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allowances Column */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2 mb-3">Gross Earnings</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Basic Salary</span>
                          <span className="font-semibold text-zinc-300">PKR {parseFloat(details.line.basic_salary).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">House Rent</span>
                          <span className="font-semibold text-zinc-300">PKR {parseFloat(details.line.house_rent).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Medical Allowance</span>
                          <span className="font-semibold text-zinc-300">PKR {parseFloat(details.line.medical_allowance).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Transport Allowance</span>
                          <span className="font-semibold text-zinc-300">PKR {parseFloat(details.line.transport_allowance).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Overtime Amount</span>
                          <span className="font-semibold text-emerald-400">PKR {parseFloat(details.line.overtime_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions Column */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2 mb-3">Deductions</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Income Tax</span>
                          <span className="font-semibold text-rose-400">PKR {parseFloat(details.line.tax_deduction).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Provident Fund</span>
                          <span className="font-semibold text-rose-400">PKR {parseFloat(details.line.pf_deduction).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">EOBI contribution</span>
                          <span className="font-semibold text-rose-400">PKR {parseFloat(details.line.eobi_deduction).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Social Security</span>
                          <span className="font-semibold text-rose-400">PKR {parseFloat(details.line.social_security_deduction).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Summary row */}
                    <div className="md:col-span-2 bg-zinc-950 p-4 rounded-xl border border-zinc-850 flex justify-between items-center mt-6">
                      <div>
                        <span className="text-xs text-zinc-500 uppercase font-semibold">Net Payout</span>
                        <span className="text-sm text-zinc-400 mt-0.5 block">Net calculations computed by dynamic engine</span>
                      </div>
                      <span className="text-2xl font-bold text-zinc-100">PKR {parseFloat(details.line.net_salary).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2 mb-3">Bank Details</h4>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-zinc-500 block">BANK NAME</span>
                          <span className="text-zinc-300 font-medium">{details.employee.bank_name || 'Habib Bank'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-500 block">IBAN / ACCOUNT NUMBER</span>
                          <span className="text-zinc-300 font-mono">{details.employee.account_number || 'PK12HABB0000123456789012'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2 mb-3">Workspace Context</h4>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-zinc-500 block">PAY PERIOD</span>
                          <span className="text-zinc-300 font-medium">{period}</span>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-500 block">MIGRATED FROM LEGACY</span>
                          <span className="text-zinc-300 font-medium">{details.employee.salary_structure_id ? 'Yes (Salary structure template)' : 'No (Legacy formula)'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-850 text-xs text-zinc-500 uppercase">
                          <th className="py-2">Period</th>
                          <th className="py-2">Gross Payout</th>
                          <th className="py-2">Net Salary</th>
                          <th className="py-2">Reference</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850 text-zinc-300">
                        {details.pastPayments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                              No payment attempts logged for this employee.
                            </td>
                          </tr>
                        ) : (
                          details.pastPayments.map(p => (
                            <tr key={p.id}>
                              <td className="py-2.5 font-medium">{p.period}</td>
                              <td className="py-2.5">PKR {parseFloat(p.gross_salary).toLocaleString()}</td>
                              <td className="py-2.5">PKR {parseFloat(p.net_salary).toLocaleString()}</td>
                              <td className="py-2.5 font-mono text-xs">{p.payment_reference}</td>
                              <td className="py-2.5">
                                {p.is_reversal ? (
                                  <span className="px-1.5 py-0.5 text-2xs font-semibold bg-rose-950 text-rose-400 rounded">REVERSED</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 text-2xs font-semibold bg-emerald-950 text-emerald-400 rounded">PAID</span>
                                )}
                              </td>
                              <td className="py-2.5">
                                {!p.is_reversal && (
                                  <button 
                                    onClick={() => handleReverse(p.id)}
                                    className="text-xs text-rose-500 hover:text-rose-400 font-semibold flex items-center gap-0.5"
                                  >
                                    <RotateCcw size={10} /> Reverse
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="relative border-l border-zinc-800 pl-4 space-y-6 py-2">
                    {details.history.length === 0 ? (
                      <div className="text-xs text-zinc-500">No status transitions recorded.</div>
                    ) : (
                      details.history.map(h => (
                        <div key={h.id} className="relative">
                          <span className="absolute -left-[21px] top-1 bg-amber-500 w-2.5 h-2.5 rounded-full border border-zinc-900" />
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="text-xs text-zinc-400 font-semibold">
                                Transitioned: {h.old_status} &rarr; {h.new_status}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5">{h.reason}</p>
                            </div>
                            <span className="text-2xs text-zinc-600 whitespace-nowrap">{new Date(h.changed_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Place Hold Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-4">
              <h3 className="font-bold text-zinc-200">Place Salary Payout on HOLD</h3>
              <button onClick={() => setShowHoldModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">Hold Classification</label>
                <select 
                  value={holdType} 
                  onChange={(e) => setHoldType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300"
                >
                  <option value="DOCUMENT">Missing Documents</option>
                  <option value="BANK">Bank Account Error</option>
                  <option value="HR">HR Verification Pending</option>
                  <option value="DISCIPLINARY">Disciplinary Inquiry</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">Detailed Hold Reason</label>
                <textarea 
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Explain exactly why this salary payment is being held..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleHold}
                  className="px-4 py-2 bg-rose-700 text-zinc-100 text-xs font-semibold rounded-lg hover:bg-rose-600"
                >
                  Apply Hold
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-4">
              <h3 className="font-bold text-zinc-200">Apply Salary Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">Adjustment Type</label>
                <select 
                  value={adjType} 
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300"
                >
                  <option value="BONUS">Achievement Bonus</option>
                  <option value="DEDUCTION">Late Penalty</option>
                  <option value="LOAN_RECOVERY">Loan Recovery</option>
                  <option value="ADVANCE_RECOVERY">Advance Recovery</option>
                  <option value="LEAVE_ENCASHMENT">Leave Encashment</option>
                  <option value="ARREARS">Salary Arrears</option>
                  <option value="MANUAL_ADJUSTMENT">Manual adjustment correction</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">Adjustment Amount (PKR)</label>
                <input 
                  type="number"
                  placeholder="e.g. 5000"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">Reason / Justification</label>
                <textarea 
                  rows={2}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Justification for adjustment..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdjustment}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-100 text-xs font-semibold rounded-lg"
                >
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
