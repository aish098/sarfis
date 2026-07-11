import React, { useState } from 'react';
import { 
  FileText, Download, CheckCircle, Search, Eye, Landmark, 
  ArrowRight, ShieldCheck, DollarSign, RefreshCw, BarChart2
} from 'lucide-react';

export default function PayrollReports() {
  const [activeReportTab, setActiveReportTab] = useState('register'); // register | departments | tax | ledger | audit
  
  // Payslip detail state
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showTrace, setShowTrace] = useState(false);

  const payslips = [
    { id: 25, name: 'Farhan Ali', email: 'farhan@gmail.com', period: '2026-08', gross: 180000, net: 156600, status: 'PAID', trace: {
      formula: 'basic * 0.05',
      variables: { basic: 108000, gross: 180000 },
      steps: [
        { operation: 'Multiply', expression: '108000 * 0.05', result: '5400' },
        { operation: 'Subtract Deductions', expression: '180000 - 18000 (Tax) - 5400 (PF)', result: '156600' }
      ],
      result: 5400
    }},
    { id: 26, name: 'Sana Khan', email: 'sana@gmail.com', period: '2026-08', gross: 150000, net: 130500, status: 'PAID', trace: {
      formula: 'basic * 0.05',
      variables: { basic: 90000, gross: 150000 },
      steps: [
        { operation: 'Multiply', expression: '90000 * 0.05', result: '4500' },
        { operation: 'Subtract Deductions', expression: '150000 - 15000 (Tax) - 4500 (PF)', result: '130500' }
      ],
      result: 4500
    }}
  ];

  const departmentVariance = [
    { department: 'Engineering', headcount: 8, budget: 1500000, actual: 1420000, variance: 80000 },
    { department: 'Product', headcount: 4, budget: 600000, actual: 640000, variance: -40000 },
    { department: 'Finance', headcount: 2, budget: 400000, actual: 350000, variance: 50000 },
    { department: 'People Operations', headcount: 2, budget: 200000, actual: 190000, variance: 10000 },
  ];

  const ledgerPostings = [
    { id: 'JV-00431', date: '2026-07-28', period: '2026-07', amount: 32550000, description: 'Disbursement Run HBL', status: 'POSTED' },
    { id: 'JV-00389', date: '2026-06-29', period: '2026-06', amount: 29800000, description: 'Disbursement Run MCB', status: 'POSTED' },
  ];

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600 relative">
      {/* Payslip Detail Drawer / Modal with JSON Formula Trace */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs font-semibold text-slate-600">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-800 text-sm">Payslip Invoice Summary</h4>
                <p className="text-[10px] text-slate-400 font-semibold">{selectedPayslip.name} — Period {selectedPayslip.period}</p>
              </div>
              <button onClick={() => { setSelectedPayslip(null); setShowTrace(false); }} className="text-slate-400 hover:text-slate-600">
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
          { id: 'departments', label: 'Budget vs Actual FP&A' },
          { id: 'tax', label: 'Tax & Compliance' },
          { id: 'ledger', label: 'Ledger Postings' }
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setActiveReportTab(tb.id)}
            className={`px-4 py-2 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black ${
              activeReportTab === tb.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Payslips & Register Tab */}
      {activeReportTab === 'register' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Historical Payslips Register</h3>
              <p className="text-[11px] text-slate-400 mt-1">Review active employee pay records with structural formulas verification.</p>
            </div>
            <button className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer">
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
                {payslips.map(ps => (
                  <tr key={ps.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 text-slate-800 font-bold">{ps.name}</td>
                    <td className="px-5 py-4 font-bold">Period {ps.period}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {ps.gross.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {ps.net.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-black border bg-emerald-50 text-emerald-700 border-emerald-100 uppercase">
                        {ps.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button 
                        onClick={() => setSelectedPayslip(ps)}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black"
                      >
                        Inspect Calculations
                      </button>
                    </td>
                  </tr>
                ))}
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax & Compliance Tab */}
      {activeReportTab === 'tax' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4 text-xs font-semibold text-slate-600">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Statutory Tax & Compliance Logs</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
            Tax Year 2026 returns generated according to Federal Board of Revenue (FBR) guidelines.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider block">Income Tax Returns</span>
                <p className="text-slate-800 font-bold mt-1">FBR Form 149 Compiled</p>
              </div>
              <button className="text-indigo-600 hover:underline cursor-pointer self-start text-[10px] font-black mt-3">Download PDF</button>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider block">EOBI Contributions</span>
                <p className="text-slate-800 font-bold mt-1">Pension Fund Register</p>
              </div>
              <button className="text-indigo-600 hover:underline cursor-pointer self-start text-[10px] font-black mt-3">Download PDF</button>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider block">Social Security Contribution</span>
                <p className="text-slate-800 font-bold mt-1">PESSI Form R-5 Register</p>
              </div>
              <button className="text-indigo-600 hover:underline cursor-pointer self-start text-[10px] font-black mt-3">Download PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Postings Tab */}
      {activeReportTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">General Ledger Posting Logs</h3>
            <p className="text-[11px] text-slate-400 mt-1">Verify automated journal postings created on finalizing monthly payroll runs.</p>
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
                {ledgerPostings.map(lp => (
                  <tr key={lp.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-600 hover:underline cursor-pointer">{lp.id}</td>
                    <td className="px-5 py-4 font-mono">{lp.date}</td>
                    <td className="px-5 py-4 font-bold text-slate-800">Period {lp.period}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">PKR {lp.amount.toLocaleString()}</td>
                    <td className="px-5 py-4">{lp.description}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded text-[9.5px] font-black border bg-emerald-50 text-emerald-700 border-emerald-100 uppercase">
                        {lp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple internal modal X icon
function X({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );
}
