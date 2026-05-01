import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Save, RefreshCw,
  CheckCircle2, AlertCircle, X, Search, ChevronDown, Check, FileText
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

function AccountSelect({ accounts, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef();
  useEffect(() => {
    const handle = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  const selected = accounts.find(a => a.id === value);
  const filtered = accounts.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || a.code.includes(q));
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => !disabled && setOpen(!open)}
        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-[13px] ${
          open ? 'ring-2 ring-emerald-500 bg-white' : 'hover:bg-slate-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ border: '1.5px solid #e2e8f0' }}>
        <span className={selected ? 'text-slate-900 font-medium' : 'text-slate-400'}>
          {selected ? `${selected.code} — ${selected.name}` : 'Select account...'}
        </span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-card-lg overflow-hidden"
            style={{ border: '1px solid #e2e8f0' }}>
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus className="input-enterprise py-2 text-[13px]"
                  style={{ paddingLeft: '38px' }}
                  placeholder="Search accounts..." value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-3">No matches</p>
              ) : filtered.map(acc => (
                <div key={acc.id}
                  onClick={() => { onChange(acc.id); setOpen(false); setQ(''); }}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-[13px] transition-colors ${
                    value === acc.id ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-700'
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{acc.code}</span>
                    <span className="truncate font-medium">{acc.name}</span>
                  </div>
                  {value === acc.id && <Check size={13} className="text-emerald-500 flex-shrink-0" />}
                </div>
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
  const { activeCompany } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('JE-' + Math.floor(1000 + Math.random() * 9000));
  const [lines, setLines] = useState([genRow(), genRow()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextAction, setNextAction] = useState('save');

  useEffect(() => {
    if (!activeCompany) return;
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
  }, [activeCompany]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

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
      await api.post('/journal', {
        company_id: activeCompany.id, entry_date: date, reference,
        description: cleanLines[0]?.description || 'Journal Entry', lines: cleanLines,
      });
      setToast(true); setTimeout(() => setToast(false), 3500);
      if (nextAction === 'save_add') {
        setLines([genRow(), genRow()]);
        setReference('JE-' + Math.floor(1000 + Math.random() * 9000));
      } else { navigate('/dashboard/ledger'); }
    } catch (err) { setError(err.response?.data?.message || 'Failed to post entry.'); }
    setSaving(false);
  };

  const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 lg:p-8 pb-16 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors mb-2 uppercase tracking-wider">
            <ArrowLeft size={13} /> Back to Ledger
          </button>
          <h1 className="font-display font-extrabold text-[22px] text-slate-900">Journal Entry</h1>
        </div>
        <div className="flex gap-2.5">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => validate('save_add')} disabled={saving}
            className="btn btn-secondary btn-sm">Save & Add New</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => validate('save')} disabled={saving}
            className="btn btn-primary">
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Entry</>}
          </motion.button>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 p-3.5 rounded-xl mb-5 bg-red-50 border border-red-100">
          <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-red-600 font-medium flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={14} className="text-red-400" /></button>
        </motion.div>
      )}

      <div className="card overflow-hidden">
        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-6 border-b border-slate-100 bg-slate-50/40">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date</label>
            <input type="date" className="input-enterprise font-medium" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Reference</label>
            <input type="text" className="input-enterprise font-mono" value={reference} onChange={e => setReference(e.target.value)} />
          </div>
        </div>

        {/* Lines table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 780 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['#', 'Account', 'Description', 'Debits', 'Credits', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 text-left" style={{ width: i === 0 ? 40 : i === 3 || i === 4 ? 130 : i === 5 ? 48 : 'auto' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.map((line, idx) => (
                <tr key={line.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 text-[11px] font-bold text-slate-300 text-center">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <AccountSelect accounts={accounts} value={line.accountId}
                      onChange={v => setLine(idx, 'accountId', v)} disabled={accounts.length === 0} />
                  </td>
                  <td className="px-2 py-2">
                    <input className="input-enterprise text-[13px] py-2"
                      placeholder="Line description..." value={line.description}
                      onChange={e => setLine(idx, 'description', e.target.value)} />
                  </td>
                  {['debit', 'credit'].map(field => (
                    <td key={field} className="px-2 py-2">
                      <input type="number" step="0.01" placeholder="0.00"
                        disabled={field === 'debit' ? !!line.credit : !!line.debit}
                        className="input-enterprise text-right font-mono text-[13px] py-2 disabled:opacity-30"
                        value={line[field]} onChange={e => setLine(idx, field, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(line.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3">
            <button onClick={() => setLines([...lines, genRow()])}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-emerald-600 transition-colors">
              <Plus size={13} className="stroke-[2.5]" /> Add line
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 border-t border-slate-100 bg-slate-50/40">
          <div>
            {balanced ? (
              <span className="balance-badge balance-ok">
                <CheckCircle2 size={13} /> Balanced
              </span>
            ) : (
              <span className="balance-badge balance-diff">
                <AlertCircle size={13} /> Difference: ${fmt(diff)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Debits</p>
              <p className="font-mono font-bold text-[18px] text-slate-900">${fmt(totalDebit)}</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Credits</p>
              <p className="font-mono font-bold text-[18px] text-slate-900">${fmt(totalCredit)}</p>
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
                <h2 className="font-display font-extrabold text-[18px] text-slate-900">Preview Journal Entry</h2>
                <p className="text-[13px] text-slate-500 mt-1">Review before posting to ledger.</p>
              </div>
              <div className="p-7">
                <div className="flex justify-between mb-5 text-[13px]">
                  <div><span className="text-slate-400">Date: </span><span className="font-semibold">{date}</span></div>
                  <div><span className="text-slate-400">Ref: </span><span className="font-mono font-semibold">{reference}</span></div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th className="px-4 py-2.5 text-left font-bold uppercase text-[10px] tracking-widest text-slate-400">Account</th>
                        <th className="px-4 py-2.5 text-right font-bold uppercase text-[10px] tracking-widest text-slate-400 w-28">Debit</th>
                        <th className="px-4 py-2.5 text-right font-bold uppercase text-[10px] tracking-widest text-slate-400 w-28">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.filter(l => l.accountId && (parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0)).map((l, i) => {
                        const acc = accounts.find(a => String(a.id) === String(l.accountId));
                        return (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{acc?.name || '—'}</p>
                              {l.description && <p className="text-[11px] text-slate-400 mt-0.5">{l.description}</p>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{parseFloat(l.debit || 0) > 0 ? `$${fmt(parseFloat(l.debit))}` : ''}</td>
                            <td className="px-4 py-3 text-right font-mono">{parseFloat(l.credit || 0) > 0 ? `$${fmt(parseFloat(l.credit))}` : ''}</td>
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
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={submit} className="btn btn-primary flex-[2]">
                  <FileText size={14} /> Post to Ledger
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-card-xl"
            style={{ background: 'var(--blue-900)', color: 'white' }}>
            <CheckCircle2 size={17} className="text-emerald-400" />
            <span className="text-[14px] font-semibold">Entry posted successfully.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
