import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Save, RefreshCw,
  CheckCircle2, AlertCircle, X, Search, ChevronDown, Check, FileText, CheckSquare,
  Scale, Keyboard, BookOpen, Sparkles, HelpCircle, Activity,
  ArrowRight, ToggleLeft, ToggleRight, Info, Eye, Zap, Layers
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RequirePermission from '../../components/RequirePermission';

function AccountSelect({ id, accounts, value, onChange, disabled, onKeyDown }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef();
  const triggerRef = useRef();
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    const handle = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (open && triggerRef.current) {
      triggerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 260; // search input + max list height + padding

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [open]);

  const selected = accounts.find(a => String(a.id) === String(value));
  const filtered = accounts.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || a.code.includes(q));

  const handleSelect = (accId) => {
    onChange(accId);
    setOpen(false);
    setQ('');
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 20);
  };

  return (
    <div className="relative focus-within:z-[50]" ref={ref}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(prev => !prev);
          } else if (e.key === 'Escape') {
            setOpen(false);
          } else {
            onKeyDown?.(e);
          }
        }}
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg cursor-pointer transition-all text-[13px] bg-white border-2 border-slate-100 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 outline-none text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
        }`}
      >
        <span className={selected ? 'text-slate-900 font-semibold truncate' : 'text-slate-400'}>
          {selected ? `${selected.code} — ${selected.name}` : 'Select account...'}
        </span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform flex-shrink-0 ml-1 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: openUpward ? -6 : 6, scale: 0.98 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? -6 : 6, scale: 0.98 }} 
            transition={{ duration: 0.12 }}
            className={`absolute z-50 w-full bg-white rounded-xl shadow-card-lg overflow-hidden border border-slate-100 min-w-[280px] ${
              openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  autoFocus 
                  className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                  placeholder="Search accounts..." 
                  value={q} 
                  onChange={e => setQ(e.target.value)} 
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-1.5 sarfis-scrollbar">
              {filtered.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-3">No matches</p>
              ) : filtered.map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelect(acc.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-[13px] text-left transition-colors ${
                    String(value) === String(acc.id) ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{acc.code}</span>
                    <span className="truncate">{acc.name}</span>
                  </div>
                  {String(value) === String(acc.id) && <Check size={13} className="text-emerald-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const genRow = () => ({ id: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' });

export default function JournalEntryPage() {
  const navigate = useNavigate();
  const { activeCompany, user, permissions } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  
  const canPost = user?.role === 'Super Admin' || (permissions || []).includes('journal.post');
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('JE-' + Math.floor(1000 + Math.random() * 9000));
  const [lines, setLines] = useState([genRow(), genRow()]);
  const [editingId, setEditingId] = useState(null);
  
  // Ledger Settings
  const [postingMode, setPostingMode] = useState('REALTIME'); // REALTIME | BATCH (saves draft)
  
  // UI States
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Entry saved successfully.');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [nextAction, setNextAction] = useState('post'); // post | draft
  
  // Recent transactions sidebar state
  const [recentDrawerOpen, setRecentDrawerOpen] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [selectedRecentEntry, setSelectedRecentEntry] = useState(null);
  const [detailEntry, setDetailEntry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recentFilter, setRecentFilter] = useState('');

  // Fetch accounts on load
  useEffect(() => {
    if (!activeCompany) return;
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
  }, [activeCompany]);

  // Fetch recent journal entries when drawer is opened or entries are posted
  const fetchRecent = async () => {
    if (!activeCompany) return;
    setLoadingRecent(true);
    try {
      const r = await api.get('/journal');
      setRecentEntries(r.data);
    } catch (err) {
      console.error(err);
    }
    setLoadingRecent(false);
  };

  useEffect(() => {
    fetchRecent();
  }, [activeCompany]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  // Keyboard navigation & spreadsheet row manipulation
  const handleKeyDown = (e, idx, field) => {
    const cols = ['account', 'description', 'debit', 'credit'];
    const colIdx = cols.indexOf(field);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const el = document.getElementById(`je-input-${idx + 1}-${field}`);
      if (el) el.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const el = document.getElementById(`je-input-${idx - 1}-${field}`);
      if (el) el.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'credit') {
        if (idx === lines.length - 1) {
          const nextLines = [...lines, genRow()];
          setLines(nextLines);
          setTimeout(() => {
            const el = document.getElementById(`je-input-${idx + 1}-account`);
            if (el) el.focus();
          }, 50);
        } else {
          const el = document.getElementById(`je-input-${idx + 1}-account`);
          if (el) el.focus();
        }
      } else {
        const nextField = cols[colIdx + 1];
        const el = document.getElementById(`je-input-${idx}-${nextField}`);
        if (el) el.focus();
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (field === 'credit' && idx === lines.length - 1) {
        e.preventDefault();
        const nextLines = [...lines, genRow()];
        setLines(nextLines);
        setTimeout(() => {
          const el = document.getElementById(`je-input-${idx + 1}-account`);
          if (el) el.focus();
        }, 50);
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      if (field === 'account' && idx > 0) {
        e.preventDefault();
        const el = document.getElementById(`je-input-${idx - 1}-credit`);
        if (el) el.focus();
      }
    }
  };

  // Keyboard Shortcuts Global Listener
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.ctrlKey && e.altKey) {
        if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          handleAutoBalance();
        } else if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          setLines(l => [...l, genRow()]);
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleNewEntry();
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          setKeyboardHelpOpen(prev => !prev);
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          setPostingMode(prev => prev === 'REALTIME' ? 'BATCH' : 'REALTIME');
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          validate(postingMode === 'REALTIME' ? 'post' : 'draft');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [lines, postingMode, totalDebit, totalCredit]);

  const setLine = (idx, field, val) => {
    const next = [...lines];
    next[idx][field] = val;
    if (field === 'debit' && val && parseFloat(val) > 0) next[idx].credit = '';
    if (field === 'credit' && val && parseFloat(val) > 0) next[idx].debit = '';
    if (idx === lines.length - 1 && next[idx].accountId && (parseFloat(next[idx].debit) > 0 || parseFloat(next[idx].credit) > 0)) {
      next.push(genRow());
    }
    setLines(next);
  };

  const removeRow = (id) => {
    if (lines.length <= 2) { setLines(lines.map(l => l.id === id ? genRow() : l)); return; }
    setLines(lines.filter(l => l.id !== id));
  };

  // Auto-Balance calculations & row injections
  const handleAutoBalance = () => {
    const diffVal = totalDebit - totalCredit;
    if (Math.abs(diffVal) < 0.01) return;

    // Try to fill in active row if it has account set but no values
    const lastIdx = lines.length - 1;
    const activeRow = lines[lastIdx];
    if (activeRow.accountId && !activeRow.debit && !activeRow.credit) {
      const next = [...lines];
      if (diffVal > 0) {
        next[lastIdx].credit = diffVal.toFixed(2);
      } else {
        next[lastIdx].debit = Math.abs(diffVal).toFixed(2);
      }
      setLines(next);
      return;
    }

    // Otherwise create balancing line
    const balanceRow = genRow();
    if (diffVal > 0) {
      balanceRow.credit = diffVal.toFixed(2);
    } else {
      balanceRow.debit = Math.abs(diffVal).toFixed(2);
    }
    // Copy description from previous line
    const lastFilled = lines.filter(l => l.description).pop();
    if (lastFilled) {
      balanceRow.description = lastFilled.description;
    }
    setLines([...lines, balanceRow]);
  };

  const handleNewEntry = () => {
    setLines([genRow(), genRow()]);
    setReference('JE-' + Math.floor(1000 + Math.random() * 9000));
    setDate(new Date().toISOString().split('T')[0]);
    setError('');
    setEditingId(null);
  };

  const validate = (action) => {
    setError('');
    const active = lines.filter(l => l.accountId || parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0);
    if (active.length < 2) { setError('At least two lines are required.'); return; }
    if (active.find(l => !l.accountId)) { setError('All active lines must have an account.'); return; }
    if (!balanced) { setError('Debits and credits must be equal.'); return; }
    if (!active.some(l => l.description)) { setError('At least one line needs a description.'); return; }
    setNextAction(action); setConfirmOpen(true);
  };

  const submit = async () => {
    setConfirmOpen(false); setSaving(true);
    const cleanLines = lines.filter(l => l.accountId && (parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0))
      .map(l => ({ accountId: l.accountId, description: l.description, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0) }));
    try {
      const response = await api.post('/journal', {
        company_id: activeCompany.id, entry_date: date, reference,
        description: cleanLines[0]?.description || 'Journal Entry', lines: cleanLines,
      });
      
      const entryId = response.data.id;
      
      if (nextAction === 'post') {
        await api.post(`/journal/${entryId}/post`);
        setToastMessage('Transaction posted to general ledger successfully.');
      } else if (nextAction === 'submit') {
        await api.post(`/journal/${entryId}/submit`);
        setToastMessage('Transaction submitted for approval.');
      } else {
        setToastMessage('Transaction saved as draft.');
      }

      // If we were editing a draft, void/delete the old one to avoid duplicates
      if (editingId) {
        try {
          await api.delete(`/journal/${editingId}`);
        } catch (e) {
          console.error("Cleanup error", e);
        }
      }

      setToast(true); setTimeout(() => setToast(false), 3500);
      fetchRecent();
      handleNewEntry();
    } catch (err) { setError(err.response?.data?.message || 'Failed to process entry.'); }
    setSaving(false);
  };

  // View detailed entry from sidebar
  const handleViewDetail = async (entry) => {
    setDetailLoading(true);
    setSelectedRecentEntry(entry);
    try {
      const response = await api.get(`/journal/${entry.id}`);
      setDetailEntry(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch journal entry details.");
    }
    setDetailLoading(false);
  };

  // Load selected draft back to active edit sheet
  const handleLoadDraft = (entryData) => {
    if (!entryData) return;
    setDate(entryData.entry_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
    setReference(entryData.reference || 'JE-LOADED');
    
    // Map lines
    const mapped = entryData.lines.map(l => ({
      id: crypto.randomUUID(),
      accountId: l.account_id,
      description: l.description || entryData.description || '',
      debit: l.debit > 0 ? String(l.debit) : '',
      credit: l.credit > 0 ? String(l.credit) : ''
    }));
    // Append empty line
    mapped.push(genRow());
    
    setLines(mapped);
    setEditingId(entryData.id);
    setSelectedRecentEntry(null);
    setDetailEntry(null);
    setRecentDrawerOpen(false);
  };

  // Delete draft entry
  const handleDeleteDraft = async (id) => {
    if (!window.confirm("Are you sure you want to delete/void this draft entry?")) return;
    try {
      await api.delete(`/journal/${id}`);
      setToastMessage("Draft entry deleted successfully.");
      setToast(true); setTimeout(() => setToast(false), 3500);
      setSelectedRecentEntry(null);
      setDetailEntry(null);
      fetchRecent();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete draft.");
    }
  };

  const handleSubmitDraft = async (id) => {
    try {
      await api.post(`/journal/${id}/submit`);
      setToastMessage("Draft entry submitted for approval.");
      setToast(true); setTimeout(() => setToast(false), 3500);
      setSelectedRecentEntry(null);
      setDetailEntry(null);
      fetchRecent();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit draft.");
    }
  };

  const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Calculate relative balance scale offset (maximum 15 degrees tilt)
  const getScaleRotation = () => {
    if (totalDebit === 0 && totalCredit === 0) return 0;
    const differenceVal = totalDebit - totalCredit;
    if (differenceVal === 0) return 0;
    // Scale offset factor based on diff size
    const factor = differenceVal / Math.max(totalDebit, totalCredit);
    return Math.min(15, Math.max(-15, factor * 25));
  };

  const filteredRecent = recentEntries.filter(entry => 
    entry.description.toLowerCase().includes(recentFilter.toLowerCase()) ||
    (entry.status || '').toLowerCase().includes(recentFilter.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6]">
      <style>{`
        /* Hide scrollbar completely by default, only show when hovering and overflow exists */
        body .sarfis-scrollbar::-webkit-scrollbar {
          width: 0px !important;
          background: transparent !important;
        }
        body .sarfis-scrollbar:hover::-webkit-scrollbar {
          width: 5px !important;
        }
        body .sarfis-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
        }
        body .sarfis-scrollbar::-webkit-scrollbar-thumb {
          background: transparent !important;
          border-radius: 99px !important;
          transition: background 0.2s ease;
        }
        body .sarfis-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3) !important;
        }
        .sarfis-scrollbar {
          scrollbar-width: none !important;
        }
        .sarfis-scrollbar:hover {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(16, 185, 129, 0.3) transparent !important;
        }
        /* Hide native spinner controls on numeric input fields */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {/* Sarfis Logo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Zap size={18} className="text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">SARFIS</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Real-Time Edition</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              General Ledger Sync: ONLINE
            </p>
          </div>
        </div>
        
        {/* Posting Mode & Transaction Drawer Toggle */}
        <div className="flex items-center gap-4 mt-3 md:mt-0 flex-wrap">
          {/* Engine Mode Toggle Button */}
          <div className="flex items-center bg-white border border-[#C2F3DC] rounded-xl p-1.5 shadow-sm">
            <span className="text-[11px] font-bold uppercase text-slate-500 px-2.5">Engine Mode:</span>
            <button 
              type="button"
              onClick={() => {
                console.log("Toggling posting mode from click");
                setPostingMode(prev => prev === 'REALTIME' ? 'BATCH' : 'REALTIME');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase transition-all cursor-pointer relative z-10 select-none ${
                postingMode === 'REALTIME' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' 
                  : 'bg-cyan-50 text-cyan-700 border border-cyan-100 shadow-sm'
              }`}
            >
              {postingMode === 'REALTIME' ? (
                <><Activity size={12} className="stroke-[2.5] animate-pulse" /> Real-time</>
              ) : (
                <><Layers size={12} className="stroke-[2.5]" /> Batch Draft</>
              )}
            </button>
          </div>

          {/* Recent Entries Button with Sarfis Logo Icon */}
          <button
            type="button"
            onClick={() => setRecentDrawerOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-4 h-4 rounded bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white flex-shrink-0">
              <Zap size={9} className="text-white fill-white" />
            </div>
            <span>Recent Entries ({recentEntries.length})</span>
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Table & Header controls */}
        <div className="lg:col-span-3 space-y-5">
          {/* Main Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
            <button 
              onClick={() => navigate('/dashboard/ledger')} 
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider pl-2"
            >
              <ArrowLeft size={13} /> Back to Ledger
            </button>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={handleNewEntry} 
                className="flex items-center gap-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 px-3.5 py-2 text-[12px] font-bold rounded-xl border border-slate-200 transition-all active:scale-95"
              >
                <Plus size={14} /> Clear / New
              </button>
              <button
                type="button"
                onClick={handleAutoBalance}
                disabled={Math.abs(totalDebit - totalCredit) < 0.01}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 disabled:pointer-events-none px-3.5 py-2 text-[12px] font-bold rounded-xl border border-emerald-200 transition-all active:scale-95"
              >
                <Scale size={14} /> Auto-Balance
              </button>
              <button 
                type="button"
                onClick={() => setKeyboardHelpOpen(true)}
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-2 text-[12px] font-bold rounded-xl border border-slate-200 transition-all active:scale-95"
              >
                <Keyboard size={14} /> Keys
              </button>
              
              <RequirePermission permission="journal.create">
                <button
                  onClick={() => validate(postingMode === 'REALTIME' ? (canPost ? 'post' : 'submit') : 'draft')}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <><RefreshCw size={14} className="animate-spin" /> Syncing...</>
                  ) : (
                    <><Save size={14} /> {postingMode === 'REALTIME' ? (canPost ? 'Post to Ledger' : 'Submit for Approval') : 'Save Draft'}</>
                  )}
                </button>
              </RequirePermission>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100">
              <AlertCircle size={15} className="text-rose-600 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-rose-700 font-semibold flex-1">{error}</p>
              <button onClick={() => setError('')}><X size={14} className="text-rose-400" /></button>
            </motion.div>
          )}

          {/* Form Content Card */}
          <div className="card !rounded-2xl border border-slate-100 bg-white" style={{ overflow: 'visible' }}>
            {/* Header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 border-b border-slate-100 bg-[#FAF9F8]">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Transaction Date</label>
                <input 
                  type="date" 
                  className="input-enterprise font-semibold focus:border-emerald-500 focus:ring-emerald-500/5 bg-white" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Document Reference</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="input-enterprise font-mono uppercase focus:border-emerald-500 focus:ring-emerald-500/5 bg-white tracking-wider font-semibold" 
                    value={reference} 
                    onChange={e => setReference(e.target.value)} 
                  />
                  {editingId && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm">Editing Draft</span>
                  )}
                </div>
              </div>
            </div>

            {/* Excel-style spreadsheet grid */}
            <div className="overflow-x-auto lg:overflow-visible pb-24" style={{ minHeight: '380px' }}>
              <table className="w-full" style={{ minWidth: 720 }}>
                <thead>
                  <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
                    {['#', 'General Ledger Account', 'Line Description', 'Debit Amount', 'Credit Amount', ''].map((h, i) => (
                      <th key={i} 
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#2E4D3F] text-left" 
                        style={{ 
                          width: i === 0 ? 45 : i === 1 ? '35%' : i === 2 ? '30%' : i === 3 || i === 4 ? 165 : 45 
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EBE8]">
                  {lines.map((line, idx) => {
                    const isRowFilled = line.accountId && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0);
                    return (
                      <tr 
                        key={line.id} 
                        className={`group transition-colors relative focus-within:z-30 ${
                          idx % 2 === 0 ? 'bg-[#FFFDFB] hover:bg-emerald-50/15' : 'bg-[#FAFAF9] hover:bg-emerald-50/15'
                        }`}
                      >
                        <td className="px-4 py-2 text-[11px] font-bold text-slate-400 text-center">
                          {isRowFilled ? (
                            <div className="flex items-center justify-center">
                              <CheckCircle2 size={13} className="text-[#5C8A76]" />
                            </div>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-2 py-1.5 relative focus-within:z-30">
                          <AccountSelect 
                            id={`je-input-${idx}-account`}
                            accounts={accounts} 
                            value={line.accountId}
                            onChange={v => setLine(idx, 'accountId', v)} 
                            disabled={accounts.length === 0} 
                            onKeyDown={e => handleKeyDown(e, idx, 'account')}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input 
                            id={`je-input-${idx}-description`}
                            className="w-full bg-white border-2 border-slate-100 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 placeholder:text-slate-400 font-semibold outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5"
                            placeholder="Line Memo..." 
                            value={line.description}
                            onChange={e => setLine(idx, 'description', e.target.value)} 
                            onKeyDown={e => handleKeyDown(e, idx, 'description')}
                          />
                        </td>
                        {['debit', 'credit'].map(field => (
                          <td key={field} className="px-2 py-1.5">
                            <input 
                              id={`je-input-${idx}-${field}`}
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              disabled={field === 'debit' ? !!line.credit : !!line.debit}
                              className="w-full bg-white border-2 border-slate-100 rounded-lg px-2 py-1.5 text-right font-mono text-[13px] font-semibold outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 disabled:opacity-30 disabled:bg-slate-50"
                              value={line[field]} 
                              onChange={e => setLine(idx, field, e.target.value)} 
                              onKeyDown={e => handleKeyDown(e, idx, field)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <button 
                            type="button"
                            onClick={() => removeRow(line.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Quick add line button */}
            <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setLines([...lines, genRow()])}
                className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <Plus size={13} className="stroke-[2.5]" /> Add line
              </button>
            </div>
          </div>
        </div>

        {/* Real-time Balancing Scale & KPI Widgets */}
        <div className="lg:col-span-1 space-y-5">
          {/* Balance Scale box */}
          <div className="bg-white border border-[#C2F3DC] rounded-2xl p-5 shadow-sm">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#064E3B] mb-4 flex items-center gap-1">
              <Scale size={13} className="text-[#10b981]" />
              <span>Balance Scale</span>
            </h3>

            {/* SVG Interactive Scale Illustration */}
            <div className="flex justify-center py-4 relative">
              <div 
                className="transition-transform duration-300 ease-out origin-bottom"
                style={{ transform: `rotate(${getScaleRotation()}deg)` }}
              >
                {/* Scale SVG Drawing */}
                <svg width="120" height="70" viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
                  {/* Beam */}
                  <line x1="20" y1="20" x2="100" y2="20" stroke="#788880" strokeWidth="4" strokeLinecap="round" />
                  {/* Pivot Pin */}
                  <circle cx="60" cy="20" r="4" fill="#3D4A41" />
                  {/* Chains and Pans */}
                  {/* Left Pan */}
                  <line x1="20" y1="20" x2="10" y2="45" stroke="#9AABA2" strokeWidth="1.5" />
                  <line x1="20" y1="20" x2="30" y2="45" stroke="#9AABA2" strokeWidth="1.5" />
                  <path d="M5 45H35C35 52 5 52 5 45Z" fill={totalDebit > totalCredit ? "#10b981" : "#BACAC0"} />
                  {/* Right Pan */}
                  <line x1="100" y1="20" x2="90" y2="45" stroke="#9AABA2" strokeWidth="1.5" />
                  <line x1="100" y1="20" x2="110" y2="45" stroke="#9AABA2" strokeWidth="1.5" />
                  <path d="M85 45H115C115 52 85 52 85 45Z" fill={totalCredit > totalDebit ? "#10b981" : "#BACAC0"} />
                </svg>
              </div>
              {/* Stand */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Column */}
                  <rect x="18" y="10" width="4" height="30" fill="#3D4A41" rx="2" />
                  {/* Base */}
                  <path d="M5 40H35C35 44 5 44 5 40Z" fill="#3D4A41" />
                </svg>
              </div>
            </div>

            {/* Balancing Status text */}
            <div className="mt-4 text-center">
              {balanced ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-100 uppercase tracking-wider">
                  <CheckCircle2 size={12} /> Ledger Balanced
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-black border border-cyan-100 uppercase tracking-wider">
                    <AlertCircle size={12} className="animate-pulse" /> Out of Balance
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 mt-1">
                    Difference: <span className="font-mono text-cyan-600">${fmt(diff)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="w-full mt-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white py-2 px-3 text-[11.5px] font-extrabold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer"
                  >
                    Auto-Balance Sheet
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100 my-4" />

            {/* Double Progress Bar indicator */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-extrabold uppercase text-slate-400">
                <span>Debits</span>
                <span>Credits</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-[#10b981] h-full transition-all duration-300"
                  style={{ width: `${totalDebit === 0 && totalCredit === 0 ? 50 : (totalDebit / (totalDebit + totalCredit)) * 100}%` }}
                />
                <div 
                  className="bg-[#06b6d4] h-full transition-all duration-300 flex-1"
                />
              </div>
            </div>
          </div>

          {/* Running Totals boxes */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Total Debits</p>
              <p className="font-mono font-black text-[22px] text-[#2A2F3D] mt-0.5">${fmt(totalDebit)}</p>
            </div>
            <div className="h-px bg-slate-100" />
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Total Credits</p>
              <p className="font-mono font-black text-[22px] text-[#2A2F3D] mt-0.5">${fmt(totalCredit)}</p>
            </div>
          </div>

          {/* Tips Info Box */}
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 flex items-start gap-2.5">
            <Info size={14} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[11.5px] text-emerald-800 leading-relaxed font-semibold">
              <p>SARFIS supports keyboard navigation. Select an account, type details, press Enter to jump to descriptions/values, and toggle modes using <kbd className="bg-white px-1 border border-emerald-200 rounded">Ctrl+Alt+M</kbd>.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-box w-full max-w-lg"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.2 }}>
              <div className="px-7 pt-6 pb-4 border-b border-slate-100">
                <h2 className="font-display font-extrabold text-[18px] text-slate-900">Review Posting Draft</h2>
                <p className="text-[13px] text-slate-500 mt-1">Verify general ledger transaction prior to finalize.</p>
              </div>
              <div className="p-7">
                <div className="flex justify-between mb-5 text-[13px]">
                  <div><span className="text-slate-400 font-semibold">Date: </span><span className="font-bold text-slate-700">{date}</span></div>
                  <div><span className="text-slate-400 font-semibold">Ref: </span><span className="font-mono font-bold text-slate-700">{reference}</span></div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th className="px-4 py-2.5 text-left font-extrabold uppercase text-[10px] tracking-widest text-slate-400">Account</th>
                        <th className="px-4 py-2.5 text-right font-extrabold uppercase text-[10px] tracking-widest text-slate-400 w-28">Debit</th>
                        <th className="px-4 py-2.5 text-right font-extrabold uppercase text-[10px] tracking-widest text-slate-400 w-28">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.filter(l => l.accountId && (parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0)).map((l, i) => {
                        const acc = accounts.find(a => String(a.id) === String(l.accountId));
                        return (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{acc?.name || '—'}</p>
                              {l.description && <p className="text-[11px] text-slate-400 mt-0.5">{l.description}</p>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-700 font-bold">{parseFloat(l.debit || 0) > 0 ? `$${fmt(parseFloat(l.debit))}` : ''}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-700 font-bold">{parseFloat(l.credit || 0) > 0 ? `$${fmt(parseFloat(l.credit))}` : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td className="px-4 py-3 font-extrabold uppercase text-[11px] tracking-widest text-slate-500 text-right">Totals</td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-slate-900">${fmt(totalDebit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-slate-900">${fmt(totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="flex gap-3 px-7 pb-7">
                <button onClick={() => setConfirmOpen(false)} className="btn btn-secondary flex-1">Back to Edit</button>
                <button
                  onClick={submit} 
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 rounded-xl font-bold text-[14px] bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] text-white shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <FileText size={14} /> {nextAction === 'post' ? 'Post to Ledger' : nextAction === 'submit' ? 'Submit for Approval' : 'Save Draft'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Guide Modal */}
      <AnimatePresence>
        {keyboardHelpOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-box w-full max-w-md"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}>
              <div className="px-7 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-display font-extrabold text-[16px] text-slate-900">SARFIS Shortcuts</h2>
                <button onClick={() => setKeyboardHelpOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="p-7 space-y-4 text-[13px] text-slate-600 font-semibold">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Auto-Balance Entry</span>
                  <kbd className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] font-bold">Ctrl + Alt + B</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Toggle Engine Posting Mode</span>
                  <kbd className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] font-bold">Ctrl + Alt + M</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Add New Table Line</span>
                  <kbd className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] font-bold">Ctrl + Alt + A</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Reset Sheet / New Transaction</span>
                  <kbd className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] font-bold">Ctrl + Alt + N</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Submit / Review Posting</span>
                  <kbd className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] font-bold">Ctrl + Alt + S</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Move focus up / down</span>
                  <span className="font-mono text-[11px] text-slate-500 font-bold">Arrow Up / Arrow Down</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span>Excel-style Cell Navigation</span>
                  <span className="font-mono text-[11px] text-slate-500 font-bold">Enter / Tab / Shift+Tab</span>
                </div>
              </div>
              <div className="px-7 pb-7">
                <button onClick={() => setKeyboardHelpOpen(false)} className="btn btn-secondary w-full cursor-pointer">Got it</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Collapsible Recent Transactions Feed Drawer */}
      <AnimatePresence>
        {recentDrawerOpen && (
          <>
            {/* Overlay */}
            <motion.div 
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-[150]" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setRecentDrawerOpen(false)}
            />
            {/* Drawer */}
            <motion.div 
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[160] border-l border-slate-100 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-display font-extrabold text-[15px] text-slate-950">Journal Entries Feed</h3>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Real-time ledger audit log</p>
                </div>
                <button 
                  onClick={() => setRecentDrawerOpen(false)} 
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Search filter in feed */}
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[12px] font-semibold outline-none focus:bg-white focus:border-emerald-500"
                    placeholder="Search recent entries..." 
                    value={recentFilter}
                    onChange={e => setRecentFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Entries list with custom scrollbar */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 sarfis-scrollbar">
                {loadingRecent ? (
                  <div className="p-6 text-center text-slate-400 text-[12px]">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Fetching feed...</span>
                  </div>
                ) : filteredRecent.length === 0 ? (
                  <p className="p-6 text-center text-[12px] text-slate-400 font-semibold">No journal entries found</p>
                ) : (
                  filteredRecent.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handleViewDetail(entry)}
                      className="w-full p-3 hover:bg-slate-50 rounded-xl transition-all text-left flex items-start justify-between gap-3 group relative cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wider">#{String(entry.id)}</span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            entry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-cyan-50 text-cyan-700 border border-cyan-100'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                        <p className="text-[13px] font-bold text-slate-800 truncate mt-1 group-hover:text-emerald-600 transition-colors">{entry.description}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                          {new Date(entry.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[12px] font-black text-slate-900">${fmt(parseFloat(entry.total_amount || 0))}</p>
                        <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">By {entry.created_name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Recent Entry Details Dialog */}
      <AnimatePresence>
        {selectedRecentEntry && (
          <motion.div className="modal-overlay" style={{ zIndex: 200 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div 
              className="modal-box w-full max-w-xl"
              initial={{ opacity: 0, scale: 0.95, y: 16 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div>
                  <h3 className="font-display font-extrabold text-[15px] text-slate-950 flex items-center gap-1.5">
                    <FileText size={15} className="text-[#10b981]" />
                    <span>Journal Entry #{String(selectedRecentEntry.id)}</span>
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Created by {selectedRecentEntry.created_name}</p>
                </div>
                <button 
                  onClick={() => { setSelectedRecentEntry(null); setDetailEntry(null); }} 
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {detailLoading ? (
                  <div className="py-12 text-center text-[12px] text-slate-400">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Loading entry details...</span>
                  </div>
                ) : detailEntry ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-[12px] bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 font-semibold block">Date</span>
                        <span className="font-bold text-slate-800">{new Date(detailEntry.entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">Status / Reference</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            detailEntry.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-cyan-50 text-cyan-700 border border-cyan-100'
                          }`}>
                            {detailEntry.status}
                          </span>
                          <span className="font-mono font-bold text-slate-600">{detailEntry.reference || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 font-semibold block">Main Description</span>
                        <span className="font-bold text-slate-800">{detailEntry.description}</span>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-[12.5px] text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150">
                            <th className="px-4 py-2 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider">Account</th>
                            <th className="px-4 py-2 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider">Memo</th>
                            <th className="px-4 py-2 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider text-right w-24">Debit</th>
                            <th className="px-4 py-2 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider text-right w-24">Credit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {detailEntry.lines?.map((line, i) => (
                            <tr key={i} className="hover:bg-slate-50/40">
                              <td className="px-4 py-2.5">
                                <span className="font-mono text-[10px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1">{line.code}</span>
                                <span className="font-bold text-slate-800">{line.account_name}</span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 truncate max-w-[120px] font-semibold">{line.description || '—'}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-700 font-bold">{line.debit > 0 ? `$${fmt(line.debit)}` : ''}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-700 font-bold">{line.credit > 0 ? `$${fmt(line.credit)}` : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-150 font-bold text-slate-900">
                            <td colSpan="2" className="px-4 py-2.5 text-right uppercase text-[10px] text-slate-400 tracking-wider">Totals</td>
                            <td className="px-4 py-2.5 text-right font-mono text-[13px] font-extrabold">${fmt(detailEntry.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-[13px] font-extrabold">${fmt(detailEntry.lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-center py-6 text-slate-400 text-[12px] font-semibold">Could not load details.</p>
                )}
              </div>

              <div className="flex gap-2.5 px-6 pb-6 pt-3 border-t border-slate-50 bg-slate-50/30 justify-end">
                {detailEntry?.status === 'DRAFT' && (
                  <>
                    <button 
                      onClick={() => handleSubmitDraft(detailEntry.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-amber-700 hover:bg-amber-50 transition-colors border border-amber-100 cursor-pointer"
                    >
                      <CheckSquare size={13} /> Submit Approval
                    </button>
                    <button 
                      onClick={() => handleDeleteDraft(detailEntry.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-rose-600 hover:bg-rose-50 transition-colors border border-rose-100 cursor-pointer"
                    >
                      <Trash2 size={13} /> Void Draft
                    </button>
                  </>
                )}
                
                {detailEntry?.status === 'PENDING_APPROVAL' && canPost && (
                  <button 
                    onClick={async () => {
                      try {
                        await api.post(`/journal/${detailEntry.id}/post`);
                        setToastMessage("Journal entry posted successfully.");
                        setToast(true); setTimeout(() => setToast(false), 3500);
                        setSelectedRecentEntry(null);
                        setDetailEntry(null);
                        fetchRecent();
                      } catch (err) {
                        setError(err.response?.data?.message || "Failed to post entry.");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-emerald-800 bg-[#EBFDF5] hover:bg-[#d5f7e6] transition-colors border border-[#C2F3DC] cursor-pointer"
                  >
                    <CheckSquare size={13} /> Post GL
                  </button>
                )}

                <button 
                  onClick={() => handleLoadDraft(detailEntry)} 
                  className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-[12px] font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all border border-emerald-200 active:scale-95 cursor-pointer"
                >
                  <Eye size={13} /> Load into Editor
                </button>

                <button 
                  onClick={() => { setSelectedRecentEntry(null); setDetailEntry(null); }} 
                  className="px-4.5 py-2 text-[12px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Close Detail
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[250] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-card-xl border border-[#D1EBE1]"
            style={{ background: '#EBF9F4', color: '#1B5E45' }}>
            <CheckCircle2 size={18} className="text-[#34B484]" />
            <span className="text-[13px] font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
