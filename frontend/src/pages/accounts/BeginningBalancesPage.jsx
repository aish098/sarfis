import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, FileText, Download, Sliders, ChevronRight, ChevronLeft,
  CheckCircle2, AlertCircle, Save, Send, Database, RefreshCw, Eye, Search, AlertTriangle, Trash2, Printer
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePeriodStore, { MONTHS } from '../../store/periodStore';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';
import RelatedDocuments from '../../components/RelatedDocuments';
import * as XLSX from 'xlsx';

const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } }
};

export default function BeginningBalancesPage() {
  const { activeCompany } = useAuthStore();
  const { year: activeStoreYear } = usePeriodStore();
  
  // Steps: 1 = Select FY, 2 = Import & Adjust, 3 = Trial Balance Preview, 4 = Validation & Post
  const [step, setStep] = useState(1);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({}); // { [accountId]: { debit, credit } }
  
  const [status, setStatus] = useState('NOT_STARTED'); // 'NOT_STARTED', 'DRAFT', 'POSTED'
  const [draftId, setDraftId] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [importMeta, setImportMeta] = useState(null);
  const [auditMeta, setAuditMeta] = useState(null);
  
  // Missing Accounts Management
  const [missingAccounts, setMissingAccounts] = useState([]); // { code, name, debit, credit, status: 'Missing'|'Mapped'|'Ignored'|'Created', mappedId }
  const [activeMappingIndex, setActiveMappingIndex] = useState(null); // Index of missing account currently being mapped
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({ code: '', name: '', category: 'Asset', normal_balance: 'Debit' });
  const [mappingSelectId, setMappingSelectId] = useState('');

  // Clear Confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedFy = useMemo(() => {
    return fiscalYears.find(f => String(f.id) === String(selectedFyId));
  }, [fiscalYears, selectedFyId]);

  // Load COA & Fiscal Years
  const loadInitialData = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError('');
    try {
      const [fyRes, coaRes] = await Promise.all([
        api.get('/opening-balances/fiscal-years'),
        api.get(`/accounts/company/${activeCompany.id}`)
      ]);
      
      setFiscalYears(fyRes.data);
      // Filter COA for postable accounts only
      const postableAccounts = coaRes.data.filter(a => a.is_postable !== false && a.is_postable !== 0);
      setAccounts(postableAccounts);

      if (fyRes.data.length > 0) {
        const matchingFy = fyRes.data.find(f => String(f.year_name) === String(activeStoreYear)) || fyRes.data[0];
        setSelectedFyId(matchingFy.id);
      }
    } catch (err) {
      console.error('Failed to load migration metadata:', err);
      setError('Could not load company setup context. Verify accounting periods exist.');
    }
    setLoading(false);
  }, [activeCompany, activeStoreYear]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load opening balances for selected year
  const loadBalances = useCallback(async () => {
    if (!selectedFyId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.get(`/opening-balances?fiscal_year_id=${selectedFyId}`);
      
      const newBalances = {};
      accounts.forEach(a => {
        newBalances[a.id] = { debit: 0, credit: 0 };
      });

      if (res.data && res.data.status !== 'NOT_STARTED') {
        setStatus(res.data.status);
        setDraftId(res.data.id);
        res.data.lines.forEach(l => {
          newBalances[l.accountId] = { debit: l.debit || 0, credit: l.credit || 0 };
        });
        
        // Retrieve auditor meta from settings
        const metaKey = `ob_migration_meta_${selectedFyId}`;
        const settingsRes = await api.get('/settings');
        if (settingsRes.data && settingsRes.data[metaKey]) {
          const m = settingsRes.data[metaKey];
          setImportMeta({
            file_name: m.import_file_name,
            rows_imported: m.rows_imported,
            rows_matched: m.rows_matched,
            rows_ignored: m.rows_ignored
          });
          setAuditMeta({
            posted_by: m.posted_by,
            posted_name: m.posted_name,
            posted_at: m.posted_at
          });
        }
      } else {
        setStatus('NOT_STARTED');
        setDraftId(null);
        setImportMeta(null);
        setAuditMeta(null);
      }
      setBalances(newBalances);
      setMissingAccounts([]);
    } catch (err) {
      console.error('Failed to load opening balances:', err);
      setError('Failed to fetch existing draft details.');
    }
    setLoading(false);
  }, [selectedFyId, accounts]);

  useEffect(() => {
    if (selectedFyId && accounts.length > 0) {
      loadBalances();
    }
  }, [selectedFyId, accounts, loadBalances]);

  // Sum calculations
  const { totalDebits, totalCredits, diff, activeLinesCount } = useMemo(() => {
    let debits = 0;
    let credits = 0;
    let count = 0;
    Object.values(balances).forEach(b => {
      const d = parseFloat(b.debit) || 0;
      const c = parseFloat(b.credit) || 0;
      debits += d;
      credits += c;
      if (d > 0 || c > 0) count++;
    });
    return {
      totalDebits: debits,
      totalCredits: credits,
      diff: Math.abs(debits - credits),
      activeLinesCount: count
    };
  }, [balances]);

  // Handle single cell manual input changes
  const handleInputChange = (accountId, field, value) => {
    if (status === 'POSTED') return;
    const cleanVal = Math.max(0, parseFloat(value) || 0);
    
    setBalances(prev => ({
      ...prev,
      [accountId]: {
        debit: field === 'debit' ? cleanVal : 0, 
        credit: field === 'credit' ? cleanVal : 0 
      }
    }));
  };

  // Download Excel Template with full layout categories and normal balances
  const handleDownloadTemplate = () => {
    const headers = [['Account Code', 'Account Name', 'Category', 'Normal Balance', 'Debit', 'Credit']];
    const data = accounts.map(a => [a.code, a.name, a.category, a.normal_balance, 0, 0]);
    const ws = XLSX.utils.aoa_to_sheet(headers.concat(data));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Opening Balances');
    XLSX.writeFile(wb, `opening_balances_template_${selectedFy?.year_name || 'FY'}.xlsx`);
  };

  // Handle Excel / CSV upload with Missing Accounts Detection
  const handleFileUpload = (e) => {
    if (status === 'POSTED') return;
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const wsName = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          throw new Error('Template must contain at least headers and one data row.');
        }

        // Header mapping
        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const codeIdx = headers.indexOf('account code');
        const nameIdx = headers.indexOf('account name');
        const debIdx = headers.indexOf('debit');
        const credIdx = headers.indexOf('credit');

        if (codeIdx === -1 || debIdx === -1 || credIdx === -1) {
          throw new Error('Missing columns. Template must contain: "Account Code", "Debit", and "Credit"');
        }

        let matched = 0;
        let skipped = 0;
        let combined = 0;
        
        const fileBalances = {};
        const missingRows = [];

        accounts.forEach(a => {
          fileBalances[a.id] = { debit: 0, credit: 0 };
        });

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawCode = String(row[codeIdx] || '').trim();
          const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
          const debit = Math.max(0, parseFloat(row[debIdx]) || 0);
          const credit = Math.max(0, parseFloat(row[credIdx]) || 0);

          if (!rawCode && !rawName) continue;

          // Find account match
          let acc = accounts.find(a => String(a.code).trim() === rawCode);
          if (!acc && rawName) {
            acc = accounts.find(a => a.name.toLowerCase().trim() === rawName.toLowerCase().trim());
          }

          if (acc) {
            if (fileBalances[acc.id].debit > 0 || fileBalances[acc.id].credit > 0) {
              combined++;
            }
            const dVal = debit > 0 ? debit : 0;
            const cVal = debit > 0 ? 0 : (credit > 0 ? credit : 0);

            fileBalances[acc.id] = {
              debit: fileBalances[acc.id].debit + dVal,
              credit: fileBalances[acc.id].credit + cVal
            };
            matched++;
          } else {
            // Unmatched / Missing Account
            missingRows.push({
              code: rawCode,
              name: rawName || 'Unresolved Account',
              debit,
              credit,
              status: 'Missing' // 'Missing', 'Mapped', 'Ignored'
            });
            skipped++;
          }
        }

        setBalances(prev => ({ ...prev, ...fileBalances }));
        setMissingAccounts(missingRows);
        setImportMeta({
          file_name: file.name,
          rows_imported: rows.length - 1,
          rows_matched: matched,
          rows_ignored: skipped
        });

        let msg = `Loaded import file. Matched ${matched} accounts.`;
        if (skipped > 0) msg += ` Found ${skipped} unmatched accounts that require action below.`;
        if (combined > 0) msg += ` Merged ${combined} duplicate rows.`;
        setSuccess(msg);
      } catch (err) {
        setError(`File parsing error: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Map Existing Unmatched Account Action
  const handleMapExisting = (index, targetAccountId) => {
    if (!targetAccountId) return;
    const account = accounts.find(a => String(a.id) === String(targetAccountId));
    if (!account) return;

    const targetMissing = missingAccounts[index];
    
    // Add amounts to matched account balances
    setBalances(prev => {
      const current = prev[account.id] || { debit: 0, credit: 0 };
      return {
        ...prev,
        [account.id]: {
          debit: current.debit + (targetMissing.debit || 0),
          credit: current.credit + (targetMissing.credit || 0)
        }
      };
    });

    setMissingAccounts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'Mapped', mappedId: account.id };
      return copy;
    });

    setSuccess(`Mapped missing row "${targetMissing.code}" to existing account "${account.name}"`);
  };

  // Ignore Unmatched Account Action
  const handleIgnoreMissing = (index) => {
    setMissingAccounts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'Ignored' };
      return copy;
    });
  };

  // Create & Continue Unmatched Account Action
  const openCreateAccountModal = (index) => {
    const missing = missingAccounts[index];
    setActiveMappingIndex(index);
    setNewAccountForm({
      code: missing.code,
      name: missing.name,
      category: 'Asset',
      normal_balance: 'Debit'
    });
    setShowCreateModal(true);
  };

  const handleCreateAccountAndContinue = async () => {
    setError('');
    try {
      const res = await api.post('/accounts', {
        ...newAccountForm,
        company_id: activeCompany.id
      });

      const newAccount = res.data;

      // Add to accounts list
      setAccounts(prev => [...prev, newAccount]);

      // Map balance
      const targetMissing = missingAccounts[activeMappingIndex];
      setBalances(prev => ({
        ...prev,
        [newAccount.id]: {
          debit: targetMissing.debit || 0,
          credit: targetMissing.credit || 0
        }
      }));

      // Update missing array status
      setMissingAccounts(prev => {
        const copy = [...prev];
        copy[activeMappingIndex] = { ...copy[activeMappingIndex], status: 'Created', mappedId: newAccount.id };
        return copy;
      });

      setShowCreateModal(false);
      setSuccess(`Created account "${newAccount.code} - ${newAccount.name}" and mapped balance successfully.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to create new account inline.');
    }
  };

  // Clear Draft Action with Dialog
  const handleClearDraft = async () => {
    if (status === 'POSTED') return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/opening-balances/clear', { fiscal_year_id: selectedFyId });
      
      const resetBalances = {};
      accounts.forEach(a => {
        resetBalances[a.id] = { debit: 0, credit: 0 };
      });
      setBalances(resetBalances);
      setMissingAccounts([]);
      setStatus('NOT_STARTED');
      setDraftId(null);
      setImportMeta(null);
      setShowClearConfirm(false);
      setSuccess('Draft configuration cleared successfully.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to clear draft.');
    }
    setSaving(false);
  };

  // Save Draft API Call
  const handleSaveDraft = async () => {
    if (status === 'POSTED') return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payloadLines = Object.keys(balances).map(id => ({
        accountId: id,
        debit: balances[id].debit,
        credit: balances[id].credit
      }));

      await api.post('/opening-balances', {
        fiscal_year_id: selectedFyId,
        entry_date: selectedFy?.start_date,
        description: `Migration opening balances for FY ${selectedFy?.year_name}`,
        lines: payloadLines,
        import_file_name: importMeta?.file_name || null,
        rows_imported: importMeta?.rows_imported || 0,
        rows_matched: importMeta?.rows_matched || 0,
        rows_ignored: importMeta?.rows_ignored || 0
      });

      setStatus('DRAFT');
      setSuccess('Draft balances saved successfully.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save draft balances.');
    }
    setSaving(false);
  };

  // Post Opening Balances API Call
  const handlePost = async () => {
    if (status === 'POSTED') return;
    if (diff > 0.01) {
      setError('Debits must equal credits before posting.');
      return;
    }

    setPosting(true);
    setError('');
    setSuccess('');
    try {
      const payloadLines = Object.keys(balances).map(id => ({
        accountId: id,
        debit: balances[id].debit,
        credit: balances[id].credit
      }));

      await api.post('/opening-balances', {
        fiscal_year_id: selectedFyId,
        lines: payloadLines,
        import_file_name: importMeta?.file_name || null,
        rows_imported: importMeta?.rows_imported || 0,
        rows_matched: importMeta?.rows_matched || 0,
        rows_ignored: importMeta?.rows_ignored || 0
      });

      await api.post('/opening-balances/post', { fiscal_year_id: selectedFyId });

      setStatus('POSTED');
      setSuccess('Opening balances posted and locked successfully.');
      setStep(1);
      loadBalances();
    } catch (err) {
      console.error(err);
      if (err.response?.data?.details) {
        const det = err.response.data.details;
        setError(`Posting failed. Out of Balance details: 
          Difference: PKR ${parseFloat(det.difference).toLocaleString()} | 
          Debits: PKR ${parseFloat(det.debits).toLocaleString()} | 
          Credits: PKR ${parseFloat(det.credits).toLocaleString()}`);
      } else {
        setError(err.response?.data?.error || 'Failed to post opening balances.');
      }
    }
    setPosting(false);
  };

  // Related documents list for audit trail
  const documentsJourneyList = useMemo(() => {
    if (status !== 'POSTED' || !draftId) return [];
    return [
      { type: 'OPENING_BALANCE', number: `OB-${selectedFy?.year_name}`, status: 'POSTED', link: `/dashboard/accounts/opening-balances?fiscal_year_id=${selectedFyId}` },
      { type: 'VOUCHER', number: `JE #${draftId}`, status: 'POSTED', link: `/dashboard/journal` }
    ];
  }, [status, draftId, selectedFy, selectedFyId]);

  // Formatter helper
  const fmtPKR = (v) => parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered account rows for UI manual adjustments
  const filteredAccounts = accounts.filter(a => {
    const q = searchQuery.toLowerCase();
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });

  const trialBalancePreviewLines = useMemo(() => {
    return accounts
      .filter(a => {
        const bal = balances[a.id];
        return bal && (bal.debit > 0 || bal.credit > 0);
      })
      .map(a => ({
        account: a,
        debit: balances[a.id].debit,
        credit: balances[a.id].credit
      }));
  }, [accounts, balances]);

  // Check unresolved missing rows count
  const unresolvedMissingCount = useMemo(() => {
    return missingAccounts.filter(m => m.status === 'Missing').length;
  }, [missingAccounts]);

  // Pre-post validation checklist checks
  const prePostChecklist = useMemo(() => {
    return [
      { id: 'balanced', label: 'Debits equal Credits', ok: diff < 0.02 },
      { id: 'unresolved', label: 'No missing/unmapped accounts', ok: unresolvedMissingCount === 0 },
      { id: 'negatives', label: 'No negative balances', ok: Object.values(balances).every(b => (b.debit >= 0 && b.credit >= 0)) },
      { id: 'tb', label: 'Trial Balance verified', ok: activeLinesCount > 0 }
    ];
  }, [diff, unresolvedMissingCount, balances, activeLinesCount]);

  if (loading && step === 1) {
    return (
      <WorkspaceLayout title="Opening Balance Migration" subtitle="Migration manager" icon={Sliders}>
        <div className="col-span-full py-16 text-center">
          <RefreshCw className="mx-auto animate-spin text-slate-400 mb-2" size={28} />
          <p className="text-[13px] text-slate-500">Syncing migration setup...</p>
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout
      title="Opening Balance Migration"
      subtitle="Migrate previous system closing balances as opening ledger balances"
      icon={Sliders}
      badgeText="Setup Wizard"
      breadcrumbs={['ACCOUNTELLENCE', 'Finance', 'Opening Balances']}
    >
      <div className="col-span-full space-y-6 pb-16 no-print">
        
        {/* Step Indicator */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex items-center justify-between shadow-2xs select-none">
          {[
            { s: 1, label: 'Select Year' },
            { s: 2, label: 'Import & Adjust' },
            { s: 3, label: 'Trial Balance Preview' },
            { s: 4, label: 'Post Balances' }
          ].map((item) => {
            const isCompleted = step > item.s || (status === 'POSTED' && item.s === 4);
            const isActive = step === item.s;
            return (
              <div key={item.s} className="flex items-center gap-2.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black border transition-all ${
                  isCompleted ? 'bg-emerald-500 text-white border-emerald-600' :
                  isActive ? 'bg-blue-600 text-white border-blue-700 shadow-xs shadow-blue-600/10' :
                  'bg-white text-slate-400 border-slate-200'
                }`}>
                  {isCompleted ? '✓' : item.s}
                </span>
                <span className={`text-[12px] ${isActive ? 'text-blue-700 font-extrabold' : isCompleted ? 'text-slate-700 font-bold' : 'text-slate-400 font-medium'}`}>
                  {item.label}
                </span>
                {item.s < 4 && <ChevronRight size={13} className="text-slate-300 ml-1" />}
              </div>
            );
          })}
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100">
            <AlertCircle className="text-rose-500 mt-0.5 flex-shrink-0" size={16} />
            <p className="text-[13px] text-rose-700 font-medium whitespace-pre-line">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="text-emerald-500 mt-0.5 flex-shrink-0" size={16} />
            <p className="text-[13px] text-emerald-700 font-medium">{success}</p>
          </div>
        )}

        {/* Main Content Areas */}
        <AnimatePresence mode="wait">
          
          {/* Step 1: Selection & Posted Verification */}
          {step === 1 && (
            <Motion.div key="step-1" variants={slideUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              <div className="card bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
                <h3 className="text-[15px] font-bold text-slate-900">Choose Migration Target Year</h3>
                <p className="text-[12.5px] text-slate-500">Opening balances are tied to a specific accounting fiscal year. Choose the year you wish to configure or review.</p>
                
                <div className="flex items-center gap-4 max-w-md pt-2">
                  <div className="relative flex-1">
                    <select 
                      className="input-enterprise pr-10 text-[13px] cursor-pointer appearance-none"
                      value={selectedFyId} 
                      onChange={e => setSelectedFyId(e.target.value)}
                    >
                      {fiscalYears.map(fy => (
                        <option key={fy.id} value={fy.id}>Fiscal Year {fy.year_name} ({new Date(fy.start_date).toLocaleDateString()} - {new Date(fy.end_date).toLocaleDateString()})</option>
                      ))}
                    </select>
                    <Sliders size={14} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Status Info Cards */}
              {status === 'POSTED' ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-6 rounded-3xl bg-emerald-50/50 border border-emerald-100/80 flex items-start gap-4">
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-[16px] font-bold text-slate-900">Opening Balances Posted & Locked</h4>
                          <p className="text-[12.5px] text-slate-600 mt-1">Starting balances have been successfully committed to the general ledger for Fiscal Year {selectedFy?.year_name}. Modifications are disabled to preserve audit trail integrity.</p>
                        </div>
                        <button 
                          onClick={() => window.print()}
                          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 text-[12px] font-bold rounded-xl cursor-pointer"
                        >
                          <Printer size={13} /> Print Report
                        </button>
                      </div>
                      
                      {/* Comprehensive Audit Details mapping */}
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-t border-emerald-100 pt-4 text-[11.5px] text-slate-500">
                        {auditMeta && (
                          <>
                            <div>
                              <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Posted By</span>
                              <span className="text-slate-800 font-bold">{auditMeta.posted_name}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Posted On</span>
                              <span className="text-slate-800 font-bold">{new Date(auditMeta.posted_at).toLocaleString()}</span>
                            </div>
                          </>
                        )}
                        {importMeta && (
                          <>
                            <div>
                              <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Source File</span>
                              <span className="text-slate-800 font-bold truncate block" title={importMeta.file_name}>{importMeta.file_name}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Import Rows</span>
                              <span className="text-slate-800 font-bold">
                                {importMeta.rows_matched} matched, {importMeta.rows_ignored} skipped ({importMeta.rows_imported} total)
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Related Documents journey timeline */}
                  <RelatedDocuments documents={documentsJourneyList} currentType="OPENING_BALANCE" />
                </div>
              ) : (
                <div className="card bg-white border border-slate-200 p-6 rounded-3xl flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                    <Database size={32} />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-bold text-slate-900">Opening Balances Not Configured</h4>
                    <p className="text-[12.5px] text-slate-500 max-w-md mt-1">
                      {status === 'DRAFT' 
                        ? `A draft balances configuration exists for FY ${selectedFy?.year_name || ''}. You can resume editing and complete migration.`
                        : `No starting balances exist for FY ${selectedFy?.year_name || ''}. Begin setup by importing your Excel trial balance or entering figures manually.`
                      }
                    </p>
                  </div>
                  <button 
                    onClick={() => setStep(2)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md cursor-pointer transition active:scale-95 border-none flex items-center gap-1.5 text-[13px]"
                  >
                    {status === 'DRAFT' ? 'Resume Migration Draft' : 'Begin Balance Setup'} <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </Motion.div>
          )}

          {/* Step 2: Import & Manual Entry */}
          {step === 2 && (
            <Motion.div key="step-2" variants={slideUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              
              {/* Excel/CSV Tool bar */}
              <div className="card bg-white border border-slate-200 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-3xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-800">Migration File Import</h4>
                    <p className="text-[11.5px] text-slate-400">Match accounts automatically by Code or Name</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 px-4 py-2 text-[12.5px] font-bold rounded-xl transition cursor-pointer"
                  >
                    <Download size={14} /> Download Template
                  </button>
                  <label className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-[12.5px] font-bold rounded-xl transition cursor-pointer shadow-sm active:scale-95 select-none">
                    <FileText size={14} /> Import File
                    <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Unresolved / Missing Accounts mapping section */}
              {missingAccounts.length > 0 && (
                <div className="card bg-amber-50/40 border border-amber-200 rounded-3xl p-5 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="text-amber-600 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-[14px] font-bold text-amber-900">Unmatched Accounts Detected ({unresolvedMissingCount} unresolved)</h4>
                      <p className="text-[12px] text-amber-700 mt-0.5">The following accounts from your import file do not match your current Chart of Accounts. Choose an action for each row.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[300px] border border-amber-100 rounded-2xl bg-white">
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                          <th className="!pl-4 py-2 text-[10px] font-extrabold uppercase text-amber-800 text-left">Code</th>
                          <th className="py-2 text-[10px] font-extrabold uppercase text-amber-800 text-left">Account Name</th>
                          <th className="py-2 text-[10px] font-extrabold uppercase text-amber-800 text-right">Debit</th>
                          <th className="py-2 text-[10px] font-extrabold uppercase text-amber-800 text-right">Credit</th>
                          <th className="py-2 text-[10px] font-extrabold uppercase text-amber-800 text-center">Status</th>
                          <th className="!pr-4 py-2 text-[10px] font-extrabold uppercase text-amber-800 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingAccounts.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-50 text-[12.5px]">
                            <td className="!pl-4 font-mono font-bold text-slate-500">{item.code}</td>
                            <td className="font-semibold text-slate-800">{item.name}</td>
                            <td className="text-right font-mono">{item.debit > 0 ? fmtPKR(item.debit) : '-'}</td>
                            <td className="text-right font-mono">{item.credit > 0 ? fmtPKR(item.credit) : '-'}</td>
                            <td className="text-center">
                              {item.status === 'Missing' && <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">🔴 Missing</span>}
                              {item.status === 'Ignored' && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">⚪ Ignored</span>}
                              {item.status === 'Mapped' && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">🟡 Mapped</span>}
                              {item.status === 'Created' && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">🟢 Created</span>}
                            </td>
                            <td className="!pr-4 text-right">
                              {item.status === 'Missing' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button 
                                    onClick={() => openCreateAccountModal(idx)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded border-none cursor-pointer"
                                  >
                                    Create & Continue
                                  </button>
                                  <div className="relative">
                                    <select 
                                      className="input-enterprise !py-1 text-[11px] max-w-[140px] pr-6 cursor-pointer"
                                      value={mappingSelectId}
                                      onChange={e => {
                                        handleMapExisting(idx, e.target.value);
                                        setMappingSelectId('');
                                      }}
                                    >
                                      <option value="">Map Existing...</option>
                                      {accounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <button 
                                    onClick={() => handleIgnoreMissing(idx)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold px-2 py-1 rounded border border-slate-200 cursor-pointer"
                                  >
                                    Ignore
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11.5px] text-slate-400 italic font-medium">Resolved</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Manual adjust inputs grid */}
              <div className="card bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                  <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
                    Review Chart Balances
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border">{filteredAccounts.length} accounts</span>
                  </h3>

                  <div className="relative w-64">
                    <input 
                      type="text" 
                      className="input-enterprise pr-10 text-[12.5px]" 
                      placeholder="Find account..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[480px]">
                  <table className="data-table">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-3xs">
                      <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                        <th className="!pl-5 py-3 text-[10px] font-black uppercase text-[#2E4D3F] text-left">Code</th>
                        <th className="py-3 text-[10px] font-black uppercase text-[#2E4D3F] text-left">Account Name</th>
                        <th className="py-3 text-[10px] font-black uppercase text-[#2E4D3F] text-left">Category</th>
                        <th className="py-3 text-[10px] font-black uppercase text-[#2E4D3F] text-left">Normal Bal</th>
                        <th className="py-3 text-[10px] font-black uppercase text-[#2E4D3F] text-right pr-6" style={{ width: '16%' }}>Debit</th>
                        <th className="py-3 text-[10px] font-black uppercase text-[#2E4D3F] text-right pr-6" style={{ width: '16%' }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map(acc => {
                        const bal = balances[acc.id] || { debit: 0, credit: 0 };
                        return (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="!pl-5 font-mono text-[12.5px] text-slate-500 font-bold">{acc.code}</td>
                            <td>
                              <span className="font-semibold text-[13.5px] text-slate-800">{acc.name}</span>
                            </td>
                            <td>
                              <span className="text-[11.5px] text-slate-500 font-medium">{acc.category}</span>
                            </td>
                            <td>
                              <span className={`text-[11px] font-bold ${acc.normal_balance === 'Debit' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                {acc.normal_balance}
                              </span>
                            </td>
                            <td className="text-right pr-4">
                              <input 
                                type="number" 
                                className="input-enterprise font-mono text-[13px] text-right pr-2 w-full !py-1 bg-white focus:bg-white"
                                placeholder="0.00"
                                value={bal.debit || ''}
                                onChange={e => handleInputChange(acc.id, 'debit', e.target.value)}
                              />
                            </td>
                            <td className="text-right pr-4">
                              <input 
                                type="number" 
                                className="input-enterprise font-mono text-[13px] text-right pr-2 w-full !py-1 bg-white focus:bg-white"
                                placeholder="0.00"
                                value={bal.credit || ''}
                                onChange={e => handleInputChange(acc.id, 'credit', e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer status summary line */}
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4 text-[13px]">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px] uppercase">Accounts Configured</span>
                      <span className="text-slate-800 font-extrabold">{activeLinesCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px] uppercase">Debit Total</span>
                      <span className="text-slate-800 font-extrabold">PKR {fmtPKR(totalDebits)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px] uppercase">Credit Total</span>
                      <span className="text-slate-800 font-extrabold">PKR {fmtPKR(totalCredits)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold block text-[10.5px] uppercase mr-1">Imbalance check:</span>
                    {diff < 0.02 ? (
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-extrabold flex items-center gap-1 leading-none">
                        🟢 Balanced
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-100 text-[11px] font-extrabold flex items-center gap-1 leading-none">
                        🔴 Out of Balance: PKR {fmtPKR(diff)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Wizard navigation bar */}
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setStep(1)} 
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer"
                >
                  <ChevronLeft size={15} /> Back
                </button>

                <div className="flex items-center gap-3">
                  {status === 'DRAFT' && (
                    <button 
                      onClick={() => setShowClearConfirm(true)}
                      className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-5 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer"
                    >
                      <Trash2 size={14} /> Clear Draft
                    </button>
                  )}

                  <button 
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 px-5 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
                  </button>

                  <button 
                    onClick={() => setStep(3)}
                    disabled={activeLinesCount === 0 || unresolvedMissingCount > 0}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer shadow-md active:scale-95 border-none disabled:opacity-50"
                    title={unresolvedMissingCount > 0 ? "Resolve missing accounts first" : ""}
                  >
                    Preview Trial Balance <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </Motion.div>
          )}

          {/* Step 3: Trial Balance Preview */}
          {step === 3 && (
            <Motion.div key="step-3" variants={slideUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              <div className="card bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-[14px] font-bold text-slate-900 uppercase tracking-wide">Trial Balance Preview</h3>
                  <p className="text-[11.5px] text-slate-400">Verifying ledger double-entry configuration impact before committing</p>
                </div>

                <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-[12.5px] text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-400 block text-[9.5px] uppercase">Target Year</span>
                    <span className="text-slate-800 font-bold">Fiscal Year {selectedFy?.year_name}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400 block text-[9.5px] uppercase">Effective Entry Date</span>
                    <span className="text-slate-800 font-bold">{new Date(selectedFy?.start_date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400 block text-[9.5px] uppercase">Balances Configured</span>
                    <span className="text-slate-800 font-bold">{trialBalancePreviewLines.length} accounts</span>
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th className="!pl-6 py-2.5 text-[10px] font-extrabold uppercase text-slate-400 text-left">Code</th>
                      <th className="py-2.5 text-[10px] font-extrabold uppercase text-slate-400 text-left">Account Name</th>
                      <th className="py-2.5 text-[10px] font-extrabold uppercase text-slate-400 text-left">Category</th>
                      <th className="py-2.5 text-[10px] font-extrabold uppercase text-slate-400 text-right pr-8">Debit (PKR)</th>
                      <th className="py-2.5 text-[10px] font-extrabold uppercase text-slate-400 text-right pr-8">Credit (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalancePreviewLines.map(line => (
                      <tr key={line.account.id} className="hover:bg-slate-50/30">
                        <td className="!pl-6 font-mono text-[12px] text-slate-500 font-bold">{line.account.code}</td>
                        <td>
                          <span className="font-semibold text-[13px] text-slate-800">{line.account.name}</span>
                        </td>
                        <td>
                          <span className="text-[11px] text-slate-400 font-semibold">{line.account.category}</span>
                        </td>
                        <td className="text-right pr-8 font-mono text-[12.5px] text-slate-700 font-medium">
                          {line.debit > 0 ? fmtPKR(line.debit) : '-'}
                        </td>
                        <td className="text-right pr-8 font-mono text-[12.5px] text-slate-700 font-medium">
                          {line.credit > 0 ? fmtPKR(line.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 font-black border-t-2 border-slate-200">
                      <td colSpan={3} className="!pl-6 text-[12px] text-slate-800 text-left font-bold uppercase tracking-wide">Totals</td>
                      <td className="text-right pr-8 font-mono text-[13px] text-slate-900">
                        {fmtPKR(totalDebits)}
                      </td>
                      <td className="text-right pr-8 font-mono text-[13px] text-slate-900">
                        {fmtPKR(totalCredits)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Wizard navigation bar */}
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setStep(2)} 
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer"
                >
                  <ChevronLeft size={15} /> Back
                </button>

                <button 
                  onClick={() => setStep(4)}
                  disabled={diff > 0.01}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer shadow-md active:scale-95 border-none"
                >
                  Next: Post Balances <ChevronRight size={14} />
                </button>
              </div>
            </Motion.div>
          )}

          {/* Step 4: Summary & Post */}
          {step === 4 && (
            <Motion.div key="step-4" variants={slideUp} initial="initial" animate="animate" exit="exit" className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Audit overview */}
                <div className="card bg-white border border-slate-200 p-6 rounded-3xl space-y-4 md:col-span-2">
                  <h3 className="text-[15px] font-bold text-slate-900">Migration Audit Parameters</h3>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] pt-1">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Target Fiscal Year</span>
                      <span className="text-slate-800 font-bold">FY {selectedFy?.year_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Document Classification</span>
                      <span className="text-slate-800 font-bold">Type: OPENING_BALANCE / Source: MIGRATION</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Total Balanced Turnover</span>
                      <span className="text-slate-850 font-extrabold text-[14px]">PKR {fmtPKR(totalDebits)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Active Accounts Matched</span>
                      <span className="text-slate-800 font-bold">{trialBalancePreviewLines.length} Accounts</span>
                    </div>
                    {importMeta && (
                      <>
                        <div className="col-span-2 border-t border-slate-100 my-1" />
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Migration Source File</span>
                          <span className="text-slate-800 font-bold truncate block" title={importMeta.file_name}>{importMeta.file_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase">Upload Row Metrics</span>
                          <span className="text-slate-800 font-bold">
                            {importMeta.rows_matched} matched, {importMeta.rows_ignored} ignored ({importMeta.rows_imported} total)
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Pre-post validation checklist */}
                <div className="card bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
                  <h4 className="text-[14px] font-bold text-slate-900 uppercase tracking-wide">Pre-Post Checklist</h4>
                  <div className="space-y-3">
                    {prePostChecklist.map(chk => (
                      <div key={chk.id} className="flex items-center justify-between text-[13px] border-b border-slate-50 pb-2">
                        <span className="text-slate-600 font-semibold">{chk.label}</span>
                        <span className={`font-black ${chk.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {chk.ok ? '✓ Ready' : '✗ Required'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Lock notice warning card */}
              <div className="card bg-amber-50/50 border border-amber-200/80 p-5 rounded-3xl flex items-start gap-3">
                <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={16} />
                <p className="text-[12px] text-amber-800 leading-relaxed font-semibold">
                  Posting opening balances will lock editing for Fiscal Year {selectedFy?.year_name}. Any subsequent corrections must be done via normal journal entries. Ensure all balances are correct before continuing.
                </p>
              </div>

              {/* Wizard navigation bar */}
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setStep(3)} 
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 text-[13px] font-bold rounded-xl transition cursor-pointer"
                >
                  <ChevronLeft size={15} /> Back
                </button>

                <button 
                  onClick={handlePost}
                  disabled={posting || prePostChecklist.some(c => !c.ok)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3 text-[13px] font-black rounded-xl transition cursor-pointer shadow-md active:scale-95 border-none disabled:opacity-50"
                >
                  <Send size={14} /> {posting ? 'Posting Balances...' : 'Post Opening Balances'}
                </button>
              </div>

            </Motion.div>
          )}

        </AnimatePresence>

        {/* Clear Draft Confirmation Dialog Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border border-slate-200 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-xl"
            >
              <h4 className="text-[15px] font-extrabold text-slate-900">Clear Draft Opening Balances?</h4>
              <p className="text-[12.5px] text-slate-500 leading-relaxed">
                This will remove all imported and manually entered balances for Fiscal Year {selectedFy?.year_name}. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[12.5px] font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearDraft}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-bold rounded-xl border-none cursor-pointer"
                >
                  Clear Draft
                </button>
              </div>
            </Motion.div>
          </div>
        )}

        {/* Mini-Modal: Create Missing Account Inline */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border border-slate-200 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-xl"
            >
              <h4 className="text-[15px] font-extrabold text-slate-900">Create & Map Account</h4>
              <p className="text-[12px] text-slate-400">Configure missing account details for import mapping</p>
              
              <div className="space-y-3.5 pt-1 text-[13px]">
                <div>
                  <label className="text-slate-400 font-semibold block text-[11px] uppercase mb-1">Account Code</label>
                  <input 
                    type="text" 
                    className="input-enterprise w-full"
                    value={newAccountForm.code}
                    onChange={e => setNewAccountForm(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block text-[11px] uppercase mb-1">Account Name</label>
                  <input 
                    type="text" 
                    className="input-enterprise w-full"
                    value={newAccountForm.name}
                    onChange={e => setNewAccountForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 font-semibold block text-[11px] uppercase mb-1">Category</label>
                    <select 
                      className="input-enterprise w-full cursor-pointer"
                      value={newAccountForm.category}
                      onChange={e => setNewAccountForm(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block text-[11px] uppercase mb-1">Balance Type</label>
                    <select 
                      className="input-enterprise w-full cursor-pointer"
                      value={newAccountForm.normal_balance}
                      onChange={e => setNewAccountForm(prev => ({ ...prev, normal_balance: e.target.value }))}
                    >
                      <option value="Debit">Debit</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[12.5px] font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateAccountAndContinue}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-bold rounded-xl border-none cursor-pointer"
                >
                  Create & Continue
                </button>
              </div>
            </Motion.div>
          </div>
        )}

      </div>

      {/* Renders standard print layout for Opening Balance Report */}
      <div className="only-print w-full p-8 font-sans text-slate-900 bg-white min-h-screen">
        <style>{`
          .only-print { display: none; }
          @media print {
            .no-print { display: none !important; }
            .only-print { display: block !important; }
            body { background: white !important; }
            @page { size: A4; margin: 1.5cm; }
          }
        `}</style>
        
        {/* Report Header block */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-[22px] font-black uppercase tracking-tight text-slate-800">{activeCompany?.name}</h1>
            <h2 className="text-[14px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Opening Balance Audit Report</h2>
            <p className="text-[12px] text-slate-400 mt-1">Fiscal Year Segment: {selectedFy?.year_name}</p>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <p>Printed On: {new Date().toLocaleString()}</p>
            <p>Posted By: {auditMeta?.posted_name || 'Admin'}</p>
            <p>Source Code: OB-{selectedFy?.year_name}</p>
          </div>
        </div>

        {/* Audit row summary details */}
        <div className="my-6 grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-[12px]">
          <div>
            <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Total Debit Turnover</span>
            <span className="text-slate-800 font-extrabold">PKR {fmtPKR(totalDebits)}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Total Credit Turnover</span>
            <span className="text-slate-800 font-extrabold">PKR {fmtPKR(totalCredits)}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Commit Status</span>
            <span className="text-emerald-700 font-extrabold">POSTED & LOCKED</span>
          </div>
          <div>
            <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Accounts Loaded</span>
            <span className="text-slate-800 font-extrabold">{trialBalancePreviewLines.length} Accounts</span>
          </div>
        </div>

        {/* Audit accounts list */}
        <table className="w-full text-[12px] border-collapse mt-4">
          <thead>
            <tr className="border-b-2 border-slate-350 bg-slate-50 text-slate-500 uppercase text-[9.5px] font-black tracking-wider">
              <th className="py-2.5 text-left pl-2">Account Code</th>
              <th className="py-2.5 text-left">Account Name</th>
              <th className="py-2.5 text-left">Category</th>
              <th className="py-2.5 text-right pr-4">Debit (PKR)</th>
              <th className="py-2.5 text-right pr-4">Credit (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {trialBalancePreviewLines.map(line => (
              <tr key={line.account.id} className="border-b border-slate-100">
                <td className="py-2 pl-2 font-mono font-bold text-slate-600">{line.account.code}</td>
                <td className="py-2 font-semibold text-slate-800">{line.account.name}</td>
                <td className="py-2 text-slate-400 font-semibold">{line.account.category}</td>
                <td className="py-2 text-right pr-4 font-mono">{line.debit > 0 ? fmtPKR(line.debit) : '-'}</td>
                <td className="py-2 text-right pr-4 font-mono">{line.credit > 0 ? fmtPKR(line.credit) : '-'}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-800 font-black text-[13px] bg-slate-50/50">
              <td colSpan={3} className="py-3 pl-2 text-left uppercase">Total Ledger Balances</td>
              <td className="py-3 text-right pr-4 font-mono text-slate-900">{fmtPKR(totalDebits)}</td>
              <td className="py-3 text-right pr-4 font-mono text-slate-900">{fmtPKR(totalCredits)}</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures block */}
        <div className="mt-16 pt-8 border-t border-slate-150 grid grid-cols-2 gap-8 text-[12px] text-slate-500">
          <div>
            <div className="w-48 border-b border-slate-300 h-8" />
            <p className="mt-2 font-semibold">Prepared By (Chief Accountant)</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="w-48 border-b border-slate-300 h-8" />
            <p className="mt-2 font-semibold pr-4">Approved By (Chief Financial Officer)</p>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
