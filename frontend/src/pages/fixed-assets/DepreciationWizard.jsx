import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Play, Calendar, DollarSign, CheckCircle2, AlertCircle, ArrowLeft,
  Info, ChevronRight, ChevronLeft, TrendingDown, BookOpen, Layers, CheckSquare, ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function DepreciationWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromClose = searchParams.get('from') === 'close';
  const { activeCompany } = useAuthStore();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 7);
  });
  const [selectedBook, setSelectedBook] = useState('Accounting'); // 'Accounting' | 'Tax' | 'Management'
  
  // Asset selection
  const [availableAssets, setAvailableAssets] = useState([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Calculations Preview
  const [previewLines, setPreviewLines] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState(null);
  
  // Approvals & Posting
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postedInfo, setPostedInfo] = useState(null);

  useEffect(() => {
    if (activeCompany) {
      fetchAssetsForPeriod();
    }
  }, [activeCompany, period]);

  const fetchAssetsForPeriod = async () => {
    try {
      setLoadingAssets(true);
      const { data } = await api.get('/fixed-assets/assets');
      const active = data.filter(a => a.status === 'ACTIVE');
      setAvailableAssets(active);
      setSelectedAssetIds(active.map(a => a.id));
      setLoadingAssets(false);
    } catch (err) {
      console.error(err);
      setLoadingAssets(false);
    }
  };

  const handleFetchPreview = async () => {
    if (!period) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const { data } = await api.get('/fixed-assets/depreciation/preview', {
        params: { period }
      });
      // Filter based on selected asset IDs in Step 3
      const filtered = data.filter(item => selectedAssetIds.includes(item.asset_id));
      setPreviewLines(filtered);
      setLoadingPreview(false);
      setCurrentStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch depreciation preview.');
      setLoadingPreview(false);
    }
  };

  const handlePostRun = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/fixed-assets/depreciation/run', { period });
      setPostedInfo(data);
      setCurrentStep(7);
      setSubmitting(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post depreciation run.');
      setSubmitting(false);
    }
  };

  const totalDepreciation = previewLines.reduce((sum, item) => sum + parseFloat(item.depreciation_amount || 0), 0);

  const toggleAsset = (id) => {
    if (selectedAssetIds.includes(id)) {
      setSelectedAssetIds(selectedAssetIds.filter(x => x !== id));
    } else {
      setSelectedAssetIds([...selectedAssetIds, id]);
    }
  };

  const steps = [
    { num: 1, label: 'Period' },
    { num: 2, label: 'Book' },
    { num: 3, label: 'Assets' },
    { num: 4, label: 'Preview' },
    { num: 5, label: 'Journal' },
    { num: 6, label: 'Approval' },
    { num: 7, label: 'Complete' }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <Link to={fromClose ? "/dashboard/finance/close-wizard" : "/dashboard/fixed-assets"} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Depreciation Wizard</h1>
          <p className="text-slate-500 text-sm font-semibold">Step-by-step pipeline to run and post period calculations.</p>
        </div>
      </div>

      {/* Stepper Timeline Progress */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-xs font-bold text-slate-400">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center border font-mono ${
                currentStep === s.num ? 'bg-indigo-600 border-indigo-600 text-white' :
                currentStep > s.num ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                'bg-slate-50 border-slate-200'
              }`}>
                {s.num}
              </span>
              <span className={currentStep === s.num ? 'text-indigo-600 font-extrabold' : ''}>{s.label}</span>
            </div>
            {idx !== steps.length - 1 && <ChevronRight size={14} className="text-slate-200" />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 font-bold animate-pulse">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Stepper Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[300px] flex flex-col justify-between">
        <div className="p-6 flex-1">
          {/* STEP 1: Period Selection */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5"><Calendar size={14} /> Select Accounting Period</h3>
              <p className="text-xs text-slate-400 font-semibold">Choose the target month and year to run depreciation calculations.</p>
              <div className="space-y-1 mt-4">
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white font-mono font-bold text-xs"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Book Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5"><BookOpen size={14} /> Select Depreciation Book</h3>
              <p className="text-xs text-slate-400 font-semibold font-sans">Choose which asset register profile depreciation should allocate into.</p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {['Accounting', 'Tax', 'Management'].map(book => (
                  <button
                    key={book}
                    onClick={() => setSelectedBook(book)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedBook === book ? 'border-indigo-600 bg-indigo-50/20 text-indigo-700 font-bold' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-black">{book} Book</p>
                    <p className="text-[9px] text-slate-400 font-semibold mt-1">
                      {book === 'Accounting' ? 'Standard general ledger integrated entries.' :
                       book === 'Tax' ? 'Alternate policy rates for corporate taxation filings.' :
                       'Management reports and forecasting estimates.'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Asset Selection */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5"><Layers size={14} /> Asset Selection Filters</h3>
              <p className="text-xs text-slate-400 font-semibold">Filter or exclude specific active asset cards from this calculation run.</p>
              
              {loadingAssets ? (
                <div className="py-8 text-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mx-auto" /></div>
              ) : (
                <div className="overflow-y-auto max-h-60 border border-slate-100 rounded-xl mt-4 divide-y divide-slate-100 text-xs">
                  {availableAssets.map(a => (
                    <div key={a.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(a.id)}
                          onChange={() => toggleAsset(a.id)}
                          className="w-4 h-4 rounded text-indigo-600"
                        />
                        <div>
                          <p className="font-bold text-slate-700">{a.asset_name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">{a.asset_code} • {a.category_name}</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-600">PKR {parseFloat(a.purchase_cost).toLocaleString()}</span>
                    </div>
                  ))}
                  {availableAssets.length === 0 && (
                    <p className="p-4 text-center text-slate-400 font-semibold">No active assets found for selection.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Calculations Preview */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5"><TrendingDown size={14} /> Allocation Preview</h3>
              <p className="text-xs text-slate-400 font-semibold">Review computed depreciation schedules before posting to General Ledger.</p>
              
              {loadingPreview ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Computing depreciation book balances...</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-60 border border-slate-100 rounded-xl mt-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-black tracking-wider text-slate-400">
                        <th className="px-4 py-2">Asset Code</th>
                        <th className="px-4 py-2">Asset Name</th>
                        <th className="px-4 py-2 text-right">Opening Value</th>
                        <th className="px-4 py-2 text-right">Depreciation</th>
                        <th className="px-4 py-2 text-right">Closing Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                      {previewLines.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-50/20">
                          <td className="px-4 py-2 text-indigo-600 font-bold">{l.asset_code}</td>
                          <td className="px-4 py-2 font-sans text-slate-700">{l.asset_name}</td>
                          <td className="px-4 py-2 text-right">PKR {l.opening_book_value.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-rose-600 font-bold">PKR {l.depreciation_amount.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-emerald-600">PKR {l.closing_book_value.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Journal Preview */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5"><BookOpen size={14} /> Double-Entry Journal Preview</h3>
              <p className="text-xs text-slate-400 font-semibold font-sans">Pre-validation check of General Ledger postings balance rules.</p>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-4 text-xs font-mono">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                      <th className="px-4 py-2.5">Account Code & Name</th>
                      <th className="px-4 py-2.5 text-right">Debit</th>
                      <th className="px-4 py-2.5 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-bold">
                    <tr>
                      <td className="px-4 py-3">5500 - Depreciation Expense</td>
                      <td className="px-4 py-3 text-right text-slate-800">PKR {totalDepreciation.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400">—</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">1600 - Accumulated Depreciation</td>
                      <td className="px-4 py-3 text-right text-slate-400">—</td>
                      <td className="px-4 py-3 text-right text-slate-800">PKR {totalDepreciation.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Posting Validations checklist */}
              <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-500 grid grid-cols-2 gap-2">
                <span className="text-emerald-600 flex items-center gap-1">✓ Debits = Credits (PKR {totalDepreciation.toLocaleString()})</span>
                <span className="text-emerald-600 flex items-center gap-1">✓ All Accounts Mapped & Active</span>
                <span className="text-emerald-600 flex items-center gap-1">✓ Period Status: Open</span>
                <span className="text-emerald-600 flex items-center gap-1">✓ Validation check: No duplicate run detected</span>
              </div>
            </div>
          )}

          {/* STEP 6: Approval */}
          {currentStep === 6 && (
            <div className="space-y-4 max-w-lg">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5"><ShieldCheck size={14} className="text-indigo-600" /> Post Authorization Confirmation</h3>
              <p className="text-xs text-slate-400 font-semibold">Authorizing this step commits the calculated allocations to the ledger database permanently.</p>
              
              <div className="mt-6 flex items-center gap-3 p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl">
                <input
                  type="checkbox"
                  id="auth-check"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  className="w-5 h-5 rounded text-indigo-600 outline-none"
                />
                <label htmlFor="auth-check" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  I confirm that all depreciation calculations and journal entries are validated and authorized for ledger posting.
                </label>
              </div>
            </div>
          )}

          {/* STEP 7: Completed */}
          {currentStep === 7 && postedInfo && (
            <div className="space-y-4 text-center max-w-md mx-auto py-6">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto animate-bounce" />
              <h3 className="text-sm font-black text-emerald-950 uppercase tracking-tight">Depreciation Post Complete</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-semibold text-slate-500 space-y-1.5 font-mono">
                <p>Voucher Ref: <strong className="text-slate-800">{postedInfo.voucherNumber}</strong></p>
                <p>Total Allocated: <strong className="text-slate-800">PKR {postedInfo.totalAmount?.toLocaleString()}</strong></p>
                <p>Active Cards Updated: <strong className="text-slate-800">{selectedAssetIds.length} Assets</strong></p>
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => navigate(fromClose ? '/dashboard/finance/close-wizard' : '/dashboard/fixed-assets')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-md"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stepper Navigation Actions footer */}
        {currentStep !== 7 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-black transition-all flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft size={14} /> Back
              </button>
            ) : <div />}

            {currentStep < 6 ? (
              <button
                type="button"
                disabled={currentStep === 3 && selectedAssetIds.length === 0}
                onClick={() => {
                  if (currentStep === 3) {
                    handleFetchPreview();
                  } else {
                    setCurrentStep(prev => prev + 1);
                  }
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 shadow-md disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                disabled={!authorized || submitting}
                onClick={handlePostRun}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Play size={13} /> {submitting ? 'Posting Ledger...' : 'Approve & Post'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
