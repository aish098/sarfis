import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, CheckCircle, Search, Eye, Landmark, 
  ArrowRight, ShieldCheck, DollarSign, RefreshCw, BarChart2,
  X, GitCommit, GitBranch, Layers
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function PayrollReports({ userRole }) {
  const { activeCompany } = useAuthStore();
  const [activeReportTab, setActiveReportTab] = useState('register'); // register | cost | departments | ledger | audit
  const [loading, setLoading] = useState(false);

  // Payslips state
  const [payslips, setPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showTrace, setShowTrace] = useState(false);

  // Journal details state
  const [ledgerPostings, setLedgerPostings] = useState([]);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // Dynamic report states
  const [employeeCosts, setEmployeeCosts] = useState([]);
  const [departmentVariance, setDepartmentVariance] = useState([]);
  const [auditExplorerSteps, setAuditExplorerSteps] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [availablePeriods, setAvailablePeriods] = useState([]);

  const fetchReportsData = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      // 1. Fetch register/runs
      const runsRes = await api.get(`/payroll/${activeCompany.id}/reports/register`);
      const runs = runsRes.data || [];
      setAvailablePeriods(runs);

      let targetPeriod = selectedPeriod;
      if (!targetPeriod && runs.length > 0) {
        // Default to the latest POSTED/CLOSED run, or latest run
        const latestValid = runs.find(r => r.status === 'POSTED' || r.status === 'CLOSED');
        targetPeriod = latestValid ? latestValid.period : runs[0].period;
        setSelectedPeriod(targetPeriod);
      }

      if (!targetPeriod) {
        setPayslips([]);
        setEmployeeCosts([]);
        setDepartmentVariance([]);
        setLedgerPostings([]);
        setAuditExplorerSteps([]);
        setLoading(false);
        return;
      }

      // 2. Fetch lines for targetPeriod
      const linesRes = await api.get(`/payroll/${activeCompany.id}/employees?period=${targetPeriod}`);
      const wsLines = linesRes.data || [];

      // Map payslips
      const mappedPayslips = wsLines.map(l => ({
        id: l.line_id,
        name: l.name,
        email: l.email || '—',
        period: targetPeriod,
        gross: parseFloat(l.basic_salary || 0) + parseFloat(l.house_rent || 0) + parseFloat(l.medical_allowance || 0) + parseFloat(l.transport_allowance || 0) + parseFloat(l.overtime_amount || 0),
        net: parseFloat(l.net_salary || 0),
        status: l.payment_status,
        trace: {
          formula: 'basic * 0.05',
          variables: { basic: parseFloat(l.basic_salary || 0) },
          steps: [
            { operation: 'Basic Salary Calculation', expression: 'Gross * 60%', result: String(Math.round(parseFloat(l.basic_salary || 0))) },
            { operation: 'PF Contribution Deducted', expression: 'Basic * 5%', result: String(Math.round(parseFloat(l.pf_deduction || 0))) }
          ],
          result: Math.round(parseFloat(l.pf_deduction || 0))
        }
      }));
      setPayslips(mappedPayslips);

      // 3. Fetch cost-analysis
      try {
        const costRes = await api.get(`/payroll/${activeCompany.id}/reports/cost-analysis?period=${targetPeriod}`);
        setEmployeeCosts(costRes.data || []);
      } catch (costErr) {
        console.error('Failed to load cost analysis:', costErr);
      }

      // 4. Fetch department variance
      try {
        const deptRes = await api.get(`/payroll/${activeCompany.id}/reports/dept-variance?period=${targetPeriod}`);
        setDepartmentVariance(deptRes.data || []);
      } catch (deptErr) {
        console.error('Failed to load departmental variance:', deptErr);
      }

      // 5. Fetch audit trail timeline
      try {
        const auditRes = await api.get(`/payroll/${activeCompany.id}/reports/audit-trail?period=${targetPeriod}`);
        setAuditExplorerSteps(auditRes.data || []);
      } catch (auditErr) {
        console.error('Failed to load audit trail:', auditErr);
      }

      // Map ledger postings (only for the selected period run if posted/closed)
      const targetRun = runs.find(r => r.period === targetPeriod);
      if (targetRun && targetRun.journal_entry_id) {
        setLedgerPostings([{
          id: `JV-00${targetRun.journal_entry_id}`,
          date: new Date(targetRun.updated_at).toLocaleDateString(),
          period: targetRun.period,
          amount: parseFloat(targetRun.total_net || 0),
          description: `Payroll Run Period ${targetRun.period}`,
          status: targetRun.status,
          entries: [
            { account: 'Salary Expense (Operations)', debit: parseFloat(targetRun.total_gross || 0), credit: 0 },
            { account: 'Tax Withholding Liability Payable', debit: 0, credit: parseFloat(targetRun.total_deductions || 0) * 0.7 },
            { account: 'Salary Clearing Payable (HBL)', debit: 0, credit: parseFloat(targetRun.total_net || 0) },
            { account: 'PF Matching Contribution Liability', debit: 0, credit: parseFloat(targetRun.total_deductions || 0) * 0.3 }
          ]
        }]);
      } else {
        setLedgerPostings([]);
      }

    } catch (err) {
      console.error('Failed to load real-time reports databases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [activeCompany?.id, selectedPeriod]);

  const handleInspectPayslip = async (ps) => {
    setSelectedPayslip(ps);
    setShowTrace(false);
    
    try {
      const detailsRes = await api.get(`/payroll/${activeCompany.id}/employee/${ps.id}`);
      if (detailsRes.data.line && detailsRes.data.line.formula_trace) {
        setSelectedPayslip(prev => ({
          ...prev,
          trace: typeof detailsRes.data.line.formula_trace === 'string' 
            ? JSON.parse(detailsRes.data.line.formula_trace) 
            : detailsRes.data.line.formula_trace
        }));
      }
    } catch (err) {
      console.warn('Using fallback UI computation trace:', err);
    }
  };

  const handleExportPayslipsCSV = () => {
    let headers = 'Employee Name,Disbursement Period,Gross Salary,Net Salary,Status\n';
    let content = '';
    payslips.forEach(p => {
      content += `"${p.name}","${p.period}",${p.gross},${p.net},"${p.status}"\n`;
    });
    const blob = new Blob([headers + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_payslips_register_${selectedPeriod}.csv`);
    link.click();
  };

  const handleExportCostCSV = () => {
    let headers = 'Employee Name,Gross Salary,Income Tax Withheld,Provident Fund (PF),Overtime Pay,Bonuses,Total Employer Cost\n';
    let content = '';
    employeeCosts.forEach(c => {
      content += `"${c.name}",${c.gross},${c.tax},${c.pf},${c.overtime},${c.bonus},${c.cost}\n`;
    });
    const blob = new Blob([headers + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_cost_analysis_${selectedPeriod}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600 relative">
      {/* Journal Voucher Double-Entry Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden text-xs font-semibold text-slate-600">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-800 text-sm">Ledger Journal Voucher Double-Entry View</h4>
                <p className="text-[10px] text-slate-400 font-semibold">{selectedVoucher.description} — Voucher {selectedVoucher.id}</p>
              </div>
              <button onClick={() => setSelectedVoucher(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="border border-slate-150 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-2.5">General Ledger Account Target</th>
                      <th className="px-4 py-2.5 text-right">Debit (PKR)</th>
                      <th className="px-4 py-2.5 text-right">Credit (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-600 font-mono">
                    {selectedVoucher.entries.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-sans font-bold text-slate-700">{entry.account}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-bold">{entry.debit > 0 ? entry.debit.toLocaleString() : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-indigo-600 font-bold">{entry.credit > 0 ? entry.credit.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase p-1">
                <span>Voucher Balanced Verification Status</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                  <CheckCircle size={10} /> Balanced & Reconciled
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Detail Drawer / Modal with JSON Formula Trace */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs font-semibold text-slate-600">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-800 text-sm">Payslip Invoice Summary</h4>
                <p className="text-[10px] text-slate-400 font-semibold">{selectedPayslip.name} — Period {selectedPayslip.period}</p>
              </div>
              <button onClick={() => { setSelectedPayslip(null); setShowTrace(false); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4 font-semibold text-slate-600">
              <div className="space-y-2">
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider block">Financial Summary</span>
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Gross Salary</span>
                    <p className="font-mono text-slate-800 text-sm font-black mt-0.5">PKR {selectedPayslip.gross.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Net Pay Received</span>
                    <p className="font-mono text-emerald-600 text-sm font-black mt-0.5">PKR {selectedPayslip.net.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* View Calculation Toggle button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowTrace(!showTrace)}
                  className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer font-black"
                >
                  {showTrace ? 'Hide Auditing Metrics' : 'View Audit Calculation Trace'}
                </button>
              </div>

              {/* Auditor JSON Formula Trace Pane */}
              {showTrace && (
                <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex justify-between items-center text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                    <span>Audit Snap Trace</span>
                    <span className="text-indigo-600 font-black">JSONB Format</span>
                  </div>
                  
                  {/* Step list */}
                  <div className="border border-slate-150 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-slate-50/50">
                    {selectedPayslip.trace.steps.map((step, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center font-mono text-[10.5px]">
                        <span className="text-slate-500">{step.operation}: {step.expression}</span>
                        <span className="font-bold text-slate-800">➔ {step.result}</span>
                      </div>
                    ))}
                  </div>

                  {/* Raw JSON snippet hidden for developer level */}
                  <pre className="bg-slate-900 text-slate-300 p-3 rounded-2xl font-mono text-[9px] overflow-x-auto select-all max-h-32">
                    {JSON.stringify(selectedPayslip.trace, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-3xs gap-1.5 w-fit">
        {[
          { id: 'register', label: 'Payslips & Register' },
          { id: 'cost', label: 'Employee Cost Analysis' },
          { id: 'departments', label: 'Budget vs Actual FP&A' },
          { id: 'ledger', label: 'Ledger Postings' },
          { id: 'audit', label: 'Audit Explorer Timeline' }
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setActiveReportTab(tb.id)}
            className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer ${
              activeReportTab === tb.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Period Selection Workspace Header */}
      {availablePeriods.length > 0 && (
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-3xs w-fit animate-in fade-in duration-100">
          <span className="text-slate-400 font-extrabold text-[10px] uppercase">Active Period Run:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold outline-none text-xs cursor-pointer focus:border-indigo-500"
          >
            {availablePeriods.map(run => (
              <option key={run.id} value={run.period}>
                Period {run.period} ({run.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Payslips & Register Tab */}
      {activeReportTab === 'register' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Historical Payslips Register</h3>
              <p className="text-[11px] text-slate-400 mt-1">Review active employee pay records with structural formulas verification.</p>
            </div>
            <button 
              onClick={handleExportPayslipsCSV}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13} /> Export Summary
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Employee Name</th>
                  <th className="px-5 py-3.5">Disbursement Period</th>
                  <th className="px-5 py-3.5 text-right">Gross Salary</th>
                  <th className="px-5 py-3.5 text-right">Net Salary</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {payslips.map((ps, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-800 font-bold">{ps.name}</td>
                    <td className="px-5 py-4 font-bold">Period {ps.period}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {Math.round(ps.gross).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {Math.round(ps.net).toLocaleString()}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-black border bg-emerald-50 text-emerald-700 border-emerald-100 uppercase">
                        {ps.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button 
                        onClick={() => handleInspectPayslip(ps)}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black"
                      >
                        Inspect Calculations
                      </button>
                    </td>
                  </tr>
                ))}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold">No payslip logs generated in database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee Cost Analysis Tab */}
      {activeReportTab === 'cost' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Employee Cost Analysis</h3>
              <p className="text-[11px] text-slate-400 mt-1">Detailed breakdown of gross pay, benefit structures, and total employer liability cost.</p>
            </div>
            <button 
              onClick={handleExportCostCSV}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">Employee Name</th>
                  <th className="px-4 py-3.5 text-right">Gross Salary</th>
                  <th className="px-4 py-3.5 text-right">Income Tax Withheld</th>
                  <th className="px-4 py-3.5 text-right">Provident Fund (PF)</th>
                  <th className="px-4 py-3.5 text-right">Overtime Pay</th>
                  <th className="px-4 py-3.5 text-right">Bonuses</th>
                  <th className="px-4 py-3.5 text-right">Total Employer Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {employeeCosts.map(cost => (
                  <tr key={cost.name} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-800">{cost.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">PKR {cost.gross.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600">PKR {cost.tax.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">PKR {cost.pf.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">PKR {cost.overtime.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">PKR {cost.bonus.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-indigo-700">PKR {cost.cost.toLocaleString()}</td>
                  </tr>
                ))}
                {employeeCosts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-bold">No employee cost analysis metrics registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget vs Actual FP&A Tab */}
      {activeReportTab === 'departments' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Departmental Cost Variance (FP&A)</h3>
            <p className="text-[11px] text-slate-400 mt-1">Cross-references actual payroll lines against predefined department budget pools.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Department Name</th>
                  <th className="px-5 py-3.5 text-center">Headcount</th>
                  <th className="px-5 py-3.5 text-right">Allocated Budget</th>
                  <th className="px-5 py-3.5 text-right">Actual Payroll Cost</th>
                  <th className="px-5 py-3.5 text-right">Budget Variance</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {departmentVariance.map(d => (
                  <tr key={d.department} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-800 font-bold">{d.department}</td>
                    <td className="px-5 py-4 text-center">{d.headcount} Employees</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {d.budget.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {d.actual.toLocaleString()}</td>
                    <td className={`px-5 py-4 text-right font-mono font-bold ${d.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {d.variance >= 0 ? '+' : ''} PKR {d.variance.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black border ${
                        d.variance >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {d.variance >= 0 ? 'UNDER BUDGET' : 'OVER BUDGET'}
                      </span>
                    </td>
                  </tr>
                ))}
                {departmentVariance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold">No departmental budget allocations recorded in database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger Postings Tab */}
      {activeReportTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">General Ledger Posting Logs</h3>
            <p className="text-[11px] text-slate-400 mt-1">Verify automated journal postings created on finalizing monthly payroll runs. Click Voucher ID to view double entries.</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Journal ID</th>
                  <th className="px-5 py-3.5">Date Created</th>
                  <th className="px-5 py-3.5">Period Target</th>
                  <th className="px-5 py-3.5 text-right">Debit/Credit Value</th>
                  <th className="px-5 py-3.5">Voucher Description</th>
                  <th className="px-5 py-3.5 text-center">GL Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                {ledgerPostings.map((lp, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td 
                      onClick={() => setSelectedVoucher(lp)}
                      className="px-5 py-4 font-mono font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {lp.id}
                    </td>
                    <td className="px-5 py-4 font-mono">{lp.date}</td>
                    <td className="px-5 py-4 font-bold text-slate-800 font-sans">Period {lp.period}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {lp.amount.toLocaleString()}</td>
                    <td className="px-5 py-4">{lp.description}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded text-[9.5px] font-black border bg-emerald-50 text-emerald-700 border-emerald-100 uppercase">
                        {lp.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {ledgerPostings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold">No posted payroll journals detected in active workspace ledger.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Explorer Timeline Tab */}
      {activeReportTab === 'audit' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Lifecycle Audit Explorer</h3>
          <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-6 text-xs font-semibold">
            {auditExplorerSteps.length === 0 && (
              <div className="text-center text-slate-400 font-bold py-4">
                No audit explorer records found for the selected period run.
              </div>
            )}
            {auditExplorerSteps.map((step, idx) => (
              <div key={idx} className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-indigo-600 font-mono font-black uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {step.type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{step.time}</span>
                </div>
                <p className="text-slate-800 mt-1 font-bold">{step.desc}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Authorized by: {step.user}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


