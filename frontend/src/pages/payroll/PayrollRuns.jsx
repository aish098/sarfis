import React, { useState } from 'react';
import { 
  Play, RefreshCw, CheckCircle, ShieldAlert, ArrowRight, 
  Layers, Calendar, ChevronRight, FileText, DollarSign, X
} from 'lucide-react';

export default function PayrollRuns() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [runs, setRuns] = useState([
    { id: 32, period: '2026-08', status: 'DRAFT', ruleVersion: '5A.1', gross: 720000, deductions: 58000, net: 662000, voucher: '—', updatedBy: 'Rana Talal' },
    { id: 31, period: '2026-07', status: 'POSTED', ruleVersion: '5A.1', gross: 720000, deductions: 58000, net: 662000, voucher: 'JV-00431', updatedBy: 'Bisma Khan' },
    { id: 30, period: '2026-06', status: 'CLOSED', ruleVersion: '5A.0', gross: 640000, deductions: 51200, net: 588800, voucher: 'JV-00389', updatedBy: 'Bisma Khan' },
  ]);

  const [loading, setLoading] = useState(false);
  const [simWarnings, setSimWarnings] = useState([]);
  const [showSimResult, setShowSimResult] = useState(false);

  const statuses = ['ALL', 'DRAFT', 'SIMULATED', 'PENDING', 'APPROVED', 'POSTED', 'CLOSED'];

  const filteredRuns = runs.filter(r => activeTab === 'ALL' || r.status === activeTab);

  const handleSimulate = () => {
    setLoading(true);
    setTimeout(() => {
      setSimWarnings([
        { type: 'WARNING', text: 'Employee Rana Talal has no EOBI declaration linked. Defaulting to standard deduction.' },
        { type: 'CRITICAL', text: 'Zainab Ahmed does not have Meezan Bank routing active (clearing will fallback to standard clearing).' },
        { type: 'INFO', text: 'Simulation ran successfully. Gross Salary matched GL controls: PKR 720,000.' }
      ]);
      setShowSimResult(true);
      setLoading(false);
    }, 1000);
  };

  const getTimelineSteps = (status) => {
    const steps = ['Created', 'Generated', 'Approved', 'Posted', 'Paid', 'Closed'];
    const activeIndex = 
      status === 'DRAFT' ? 1 :
      status === 'SIMULATED' ? 2 :
      status === 'APPROVED' ? 3 :
      status === 'POSTED' ? 4 :
      status === 'CLOSED' ? 5 : 0;
    return { steps, activeIndex };
  };

  return (
    <div className="space-y-6 text-xs font-semibold text-slate-600">
      {/* Simulation Result Overlay Banner */}
      {showSimResult && (
        <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-3xl space-y-3.5 animate-in slide-in-from-top-5 duration-200">
          <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
            <h4 className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5">
              <RefreshCw size={14} className="text-indigo-600" /> Payroll Simulation Results & Posting Preview
            </h4>
            <button onClick={() => setShowSimResult(false)} className="text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          </div>
          <div className="space-y-2">
            {simWarnings.map((w, idx) => (
              <div key={idx} className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                w.type === 'CRITICAL' ? 'bg-rose-50 border-rose-100 text-rose-800' :
                w.type === 'WARNING' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                'bg-blue-50 border-blue-100 text-blue-800'
              }`}>
                <ShieldAlert size={14} />
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Operations Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Run Execution</h3>
          <p className="text-[11px] text-slate-400 mt-1">Simulate calculations inside database transactions or commit postings to ledger.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={handleSimulate} 
            disabled={loading}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? <RefreshCw size={12} className="animate-spin text-indigo-600" /> : <RefreshCw size={12} className="text-indigo-600" />}
            Simulate Run
          </button>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer font-black">
            <Play size={12} /> Generate Run
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit">
        {statuses.map(st => (
          <button
            key={st}
            onClick={() => setActiveTab(st)}
            className={`px-3 py-1.5 rounded-xl transition-all uppercase tracking-wider text-[10px] font-black ${
              activeTab === st ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Runs List Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Run Details</th>
                <th className="px-5 py-3.5">Calculation Rules</th>
                <th className="px-5 py-3.5 text-right">Net Disbursement</th>
                <th className="px-5 py-3.5">GL Posting</th>
                <th className="px-5 py-3.5 text-center">Run Pipeline Timeline</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
              {filteredRuns.map(run => {
                const timeline = getTimelineSteps(run.status);
                return (
                  <tr key={run.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">Period {run.period}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: RUN-00{run.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono text-[9px] font-black">
                        Engine v{run.ruleVersion}
                      </span>
                      <p className="text-[9.5px] text-slate-400 mt-1">Calculated by: {run.updatedBy}</p>
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">
                      <p className="text-slate-800">PKR {run.net.toLocaleString()}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Gross: PKR {run.gross.toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4">
                      {run.voucher !== '—' ? (
                        <span className="text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1">
                          <FileText size={12} /> {run.voucher}
                        </span>
                      ) : <span className="text-slate-400 italic">Unposted</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1 font-mono text-[9.5px]">
                        {timeline.steps.map((step, idx) => (
                          <React.Fragment key={step}>
                            <span className={`px-1.5 py-0.5 rounded-md ${
                              idx <= timeline.activeIndex ? 'bg-emerald-50 text-emerald-700 font-black border border-emerald-100' : 'bg-slate-50 text-slate-400'
                            }`}>
                              {step}
                            </span>
                            {idx < timeline.steps.length - 1 && <ChevronRight size={10} className="text-slate-300" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {run.status === 'DRAFT' && (
                          <>
                            <button className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black">
                              Submit
                            </button>
                            <button className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-3xs cursor-pointer text-[10px] font-black">
                              Post
                            </button>
                          </>
                        )}
                        {run.status === 'POSTED' && (
                          <button className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg shadow-3xs cursor-pointer text-[10px] font-black">
                            Rollback
                          </button>
                        )}
                        {run.status === 'CLOSED' && (
                          <span className="text-slate-400 italic text-[10px]">Archived</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
