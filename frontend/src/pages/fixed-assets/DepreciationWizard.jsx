import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Info,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function DepreciationWizard() {
  const { activeCompany } = useAuthStore();
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    // Default to current year-month
    return today.toISOString().slice(0, 7);
  });
  const [preview, setPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [postedInfo, setPostedInfo] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    handleLoadPreview();
  }, [activeCompany, period]);

  const handleLoadPreview = async () => {
    if (!period) return;
    setLoadingPreview(true);
    setError(null);
    setSuccess(false);
    setPostedInfo(null);
    try {
      const { data } = await api.get('/fixed-assets/depreciation/preview', {
        params: { period }
      });
      setPreview(data);
      setLoadingPreview(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch depreciation preview lines.');
      setPreview([]);
      setLoadingPreview(false);
      
      // If error indicates already posted, try to load information
      if (err.response?.data?.error?.includes('already been posted')) {
        setPostedInfo({ alreadyPosted: true });
      }
    }
  };

  const handlePostRun = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/fixed-assets/depreciation/run', { period });
      setPostedInfo(data);
      setSuccess(true);
      setPreview([]);
      setSubmitting(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post depreciation run.');
      setSubmitting(false);
    }
  };

  const totalDepreciation = preview.reduce((sum, item) => sum + parseFloat(item.depreciation_amount || 0), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/dashboard/fixed-assets" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Depreciation Wizard</h1>
          <p className="text-slate-500 text-sm font-semibold font-sans">Run monthly depreciation allocations and post entries to the ledger.</p>
        </div>
      </div>

      {/* Control Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Month Selector */}
        <div className="space-y-1 text-xs font-semibold text-slate-600">
          <label className="text-slate-500 flex items-center gap-1.5"><Calendar size={13} /> Active Accounting Period</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono font-bold"
          />
        </div>

        {/* Info Banner */}
        <div className="md:col-span-2 text-xs font-semibold text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
          💡 The wizard scans all active capitalized assets for the selected month, calculates their allocations under the Accounting Depreciation Book, and formats a balanced Journal Entry preview.
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 font-bold animate-pulse">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Success Banner */}
      {success && postedInfo && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex flex-col gap-3 font-semibold text-xs shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <h3 className="text-sm font-black text-emerald-900 uppercase">Depreciation Run Posted Successfully</h3>
          </div>
          <div className="space-y-1.5 pl-6">
            <p>{postedInfo.message}</p>
            <p>Voucher Number: <strong className="font-mono text-slate-800">{postedInfo.voucherNumber}</strong></p>
            <p>Posted Amount: <strong className="font-mono text-slate-800">PKR {postedInfo.totalAmount?.toLocaleString()}</strong></p>
          </div>
          <div className="pt-2 pl-6">
            <Link to="/dashboard/fixed-assets" className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black transition-all shadow-sm">
              Return to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Calculations Preview Table */}
      {!success && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-[12px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <TrendingDown size={14} className="text-indigo-600" /> Period Depreciation Preview Lines
            </h3>
            {preview.length > 0 && (
              <span className="font-mono text-xs font-black text-indigo-600">
                Total Allocation: PKR {totalDepreciation.toLocaleString()}
              </span>
            )}
          </div>

          {loadingPreview ? (
            <div className="p-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-slate-400 text-xs mt-4">Scanning asset ledger records...</p>
            </div>
          ) : preview.length > 0 ? (
            <div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="px-4 py-2.5">Asset Code</th>
                      <th className="px-4 py-2.5">Asset Name</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5 text-right">Opening Value</th>
                      <th className="px-4 py-2.5 text-right">Expense allocation</th>
                      <th className="px-4 py-2.5 text-right">Closing Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold font-mono">
                    {preview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-4 py-2.5 text-indigo-600 font-bold">{item.asset_code}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-700">{item.asset_name}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-500">{item.category_name}</td>
                        <td className="px-4 py-2.5 text-right">PKR {item.opening_book_value.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-rose-600 font-bold">PKR {item.depreciation_amount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600">PKR {item.closing_book_value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action bar */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="text-xs font-semibold text-slate-400">
                  Calculated for {preview.length} active depreciating assets.
                </div>
                <button
                  onClick={handlePostRun}
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Play size={13} /> {submitting ? 'Posting Journal...' : 'Confirm & Post Depreciation'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-slate-400 font-semibold text-xs space-y-2">
              <p>No active depreciating assets with carrying values found for period {period}.</p>
              {postedInfo?.alreadyPosted && (
                <p className="text-rose-600 font-bold">Depreciation for this period has already been posted and finalized.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
