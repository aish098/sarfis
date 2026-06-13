import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Save, RefreshCw,
  CheckCircle2, AlertCircle, X, Search, ChevronDown, Check,
  FileText, RotateCcw, Copy, BookOpen,
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import RequirePermission from '../../components/RequirePermission';
import { formatDateOnly } from '../../utils/formatDate';

const QB = {
  green: '#2ca01c',
  greenHover: '#248017',
  toolbar: '#ece9e3',
  toolbarBorder: '#d4d0c8',
  panel: '#ffffff',
  panelBorder: '#c8c4bc',
  gridHead: '#f4f2ed',
  gridLine: '#dedad2',
  gridHover: '#faf8f5',
  text: '#393939',
  muted: '#6b6b6b',
  label: '#5c5c5c',
  danger: '#c0392b',
  ok: '#107c10',
  inputBg: '#ffffff',
  inputFocus: '#2ca01c',
};

function AccountSelect({ accounts, value, onChange, disabled, onTabNext }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selected = accounts.find((a) => a.id === value);
  const filtered = accounts.filter(
    (a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.code.includes(q)
  );

  return (
    <div className="relative h-full" ref={ref}>
      <button
        type="button"
        ref={inputRef}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            if (!open && ref.current) {
              setTimeout(() => {
                ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !open && onTabNext) onTabNext(e);
        }}
        className="w-full h-full min-h-[34px] flex items-center justify-between gap-2 px-2.5 text-left text-[12.5px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#faf8f5]"
        style={{ color: selected ? QB.text : QB.muted }}
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-mono text-[11px] text-[#888] mr-1.5">{selected.code}</span>
              {selected.name}
            </>
          ) : (
            'Select account…'
          )}
        </span>
        <ChevronDown size={12} className="text-[#999] flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-0.5 bg-white overflow-hidden shadow-lg"
            style={{ border: `1px solid ${QB.panelBorder}`, minWidth: 280 }}
          >
            <div className="p-2" style={{ borderBottom: `1px solid ${QB.gridLine}`, background: QB.gridHead }}>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" />
                <input
                  autoFocus
                  className="w-full pl-8 pr-2 py-1.5 text-[12px] outline-none"
                  style={{ border: `1px solid ${QB.gridLine}`, background: QB.inputBg }}
                  placeholder="Search by code or name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-[12px] text-[#999] text-center py-4">No accounts found</p>
              ) : (
                filtered.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      onChange(acc.id);
                      setOpen(false);
                      setQ('');
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[#eef7ec]"
                    style={{
                      background: value === acc.id ? '#eef7ec' : 'transparent',
                      color: QB.text,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-[10px] px-1 py-0.5 flex-shrink-0"
                        style={{ background: '#eee', color: '#666' }}
                      >
                        {acc.code}
                      </span>
                      <span className="truncate">{acc.name}</span>
                    </div>
                    {value === acc.id && <Check size={12} style={{ color: QB.green }} />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const genRow = () => ({ id: crypto.randomUUID(), accountId: '', description: '', debit: '', credit: '' });

function MoneyInput({ value, onChange, disabled, placeholder = '0.00', onKeyDown }) {
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className="w-full h-full min-h-[34px] px-2.5 text-right font-mono text-[12.5px] outline-none disabled:opacity-40 disabled:bg-[#f7f7f7] focus:bg-[#fffef5]"
      style={{ color: QB.text, background: 'transparent' }}
    />
  );
}

export default function JournalEntryPage() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('JE-' + Math.floor(1000 + Math.random() * 9000));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState([genRow(), genRow()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextAction, setNextAction] = useState('save');

  useEffect(() => {
    if (!activeCompany) return;
    api.get('/accounts').then((r) => setAccounts(r.data)).catch(() => {});
  }, [activeCompany]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);
  const activeLineCount = lines.filter(
    (l) => l.accountId || parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0
  ).length;

  const fmt = useCallback(
    (v) =>
      `PKR ${Number(v || 0).toLocaleString('en-PK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    []
  );

  const setLine = (idx, field, val) => {
    const next = [...lines];
    next[idx][field] = val;
    if (field === 'debit' && val && parseFloat(val) > 0) next[idx].credit = '';
    if (field === 'credit' && val && parseFloat(val) > 0) next[idx].debit = '';
    if (
      idx === lines.length - 1 &&
      next[idx].accountId &&
      (parseFloat(next[idx].debit) > 0 || parseFloat(next[idx].credit) > 0)
    ) {
      next.push(genRow());
    }
    setLines(next);
  };

  const removeRow = (id) => {
    if (lines.length <= 2) {
      setLines(lines.map((l) => (l.id === id ? genRow() : l)));
      return;
    }
    setLines(lines.filter((l) => l.id !== id));
  };

  const resetForm = () => {
    setLines([genRow(), genRow()]);
    setReference('JE-' + Math.floor(1000 + Math.random() * 9000));
    setMemo('');
    setDate(new Date().toISOString().split('T')[0]);
    setError('');
  };

  const validate = (action) => {
    setError('');
    const active = lines.filter(
      (l) => l.accountId || parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0
    );
    if (active.length < 2) {
      setError('At least two lines with amounts are required.');
      return;
    }
    if (active.find((l) => !l.accountId)) {
      setError('Every line with an amount must have an account selected.');
      return;
    }
    if (!balanced) {
      setError(`Entry is out of balance by ${fmt(diff)}. Debits must equal credits.`);
      return;
    }
    setNextAction(action);
    setConfirmOpen(true);
  };

  const submit = async () => {
    setConfirmOpen(false);
    setSaving(true);
    const cleanLines = lines
      .filter((l) => l.accountId && (parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0))
      .map((l) => ({
        accountId: l.accountId,
        description: l.description || memo,
        debit: parseFloat(l.debit || 0),
        credit: parseFloat(l.credit || 0),
      }));
    try {
      const response = await api.post('/journal', {
        company_id: activeCompany.id,
        entry_date: date,
        reference,
        description: memo || cleanLines[0]?.description || 'Journal Entry',
        lines: cleanLines,
      });

      const entryId = response.data.id;

      if (nextAction === 'post') {
        await api.post(`/journal/${entryId}/post`);
      }

      setToast({
        message:
          nextAction === 'post'
            ? 'Journal entry posted to the general ledger.'
            : 'Journal entry saved as draft.',
      });
      setTimeout(() => setToast(null), 4000);

      if (nextAction === 'save_add' || nextAction === 'draft_add') {
        resetForm();
      } else {
        navigate('/dashboard/ledger');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process entry.');
    }
    setSaving(false);
  };

  const displayDate = formatDateOnly(date, 'en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="p-4 lg:p-6 pb-20 max-w-[1180px] mx-auto">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate('/dashboard/ledger')}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-3 transition-colors hover:opacity-80"
        style={{ color: QB.muted }}
      >
        <ArrowLeft size={12} /> Back to Ledger
      </button>

      {/* Document window — QB / Peachtree style */}
      <div
        className="overflow-hidden shadow-md"
        style={{ border: `1px solid ${QB.panelBorder}`, background: QB.panel }}
      >
        {/* Title bar */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5"
          style={{ background: '#3d3d3d', color: '#fff' }}
        >
          <div className="flex items-center gap-2.5">
            <BookOpen size={16} className="opacity-80" />
            <div>
              <h1 className="text-[14px] font-bold leading-tight">Make General Journal Entries</h1>
              <p className="text-[11px] opacity-70 mt-0.5">
                {activeCompany?.name || 'Company'} · Manual double-entry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className="px-2 py-0.5 rounded-sm font-semibold"
              style={{
                background: balanced ? 'rgba(16,124,16,0.25)' : 'rgba(192,57,43,0.25)',
                color: balanced ? '#90ee90' : '#ffb3b3',
              }}
            >
              {balanced ? 'In Balance' : 'Out of Balance'}
            </span>
            <span className="opacity-60">{activeLineCount} active lines</span>
          </div>
        </div>

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{ background: QB.toolbar, borderBottom: `1px solid ${QB.toolbarBorder}` }}
        >
          <RequirePermission permission="journal.create">
            <ToolbarBtn
              icon={Save}
              label="Save Draft"
              onClick={() => validate('draft')}
              disabled={saving}
            />
          </RequirePermission>
          <RequirePermission permission="journal.post">
            <ToolbarBtn
              icon={saving ? RefreshCw : CheckCircle2}
              label={saving ? 'Processing…' : 'Record & Post'}
              primary
              onClick={() => validate('post')}
              disabled={saving}
              spin={saving}
            />
          </RequirePermission>
          <div className="w-px h-6 mx-1 hidden sm:block" style={{ background: QB.toolbarBorder }} />
          <ToolbarBtn icon={Plus} label="Save & New" onClick={() => validate('draft_add')} disabled={saving} />
          <ToolbarBtn icon={RotateCcw} label="Clear" onClick={resetForm} disabled={saving} />
          <div className="flex-1" />
          <ToolbarBtn icon={Copy} label="Review" onClick={() => balanced && validate('post')} disabled={!balanced || saving} />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-start gap-2 px-4 py-2.5 text-[12px]"
            style={{ background: '#fdecea', borderBottom: `1px solid #f5c6c2`, color: QB.danger }}
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{error}</p>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss">
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Header fields — date, ref, memo */}
        <div
          className="grid grid-cols-1 md:grid-cols-12 gap-0"
          style={{ borderBottom: `1px solid ${QB.gridLine}`, background: '#faf9f7' }}
        >
          <HeaderField label="Date" className="md:col-span-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="journal-field"
            />
            <span className="text-[10px] mt-1 block" style={{ color: QB.muted }}>
              {displayDate}
            </span>
          </HeaderField>
          <HeaderField label="Journal No." className="md:col-span-2">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="journal-field font-mono"
            />
          </HeaderField>
          <HeaderField label="Memo / Description" className="md:col-span-8">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Entry description shown on reports and ledger…"
              className="journal-field"
            />
          </HeaderField>
        </div>

        {/* Spreadsheet grid */}
        <div className="overflow-x-auto pb-48">
          <table className="w-full border-collapse" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ background: QB.gridHead, borderBottom: `2px solid ${QB.gridLine}` }}>
                {[
                  { label: '#', w: 36, align: 'center' },
                  { label: 'Account', w: 'auto', align: 'left' },
                  { label: 'Line Description', w: 'auto', align: 'left' },
                  { label: 'Debit (PKR)', w: 130, align: 'right' },
                  { label: 'Credit (PKR)', w: 130, align: 'right' },
                  { label: '', w: 36, align: 'center' },
                ].map((col, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color: QB.label,
                      textAlign: col.align,
                      width: typeof col.w === 'number' ? col.w : undefined,
                      borderRight: i < 5 ? `1px solid ${QB.gridLine}` : undefined,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={line.id}
                  className="group transition-colors"
                  style={{ borderBottom: `1px solid ${QB.gridLine}` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = QB.gridHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td
                    className="text-center text-[11px] font-semibold"
                    style={{ color: '#aaa', borderRight: `1px solid ${QB.gridLine}` }}
                  >
                    {idx + 1}
                  </td>
                  <td style={{ borderRight: `1px solid ${QB.gridLine}`, padding: 0 }}>
                    <AccountSelect
                      accounts={accounts}
                      value={line.accountId}
                      onChange={(v) => setLine(idx, 'accountId', v)}
                      disabled={accounts.length === 0}
                    />
                  </td>
                  <td style={{ borderRight: `1px solid ${QB.gridLine}`, padding: 0 }}>
                    <input
                      className="w-full h-full min-h-[34px] px-2.5 text-[12.5px] outline-none focus:bg-[#fffef5]"
                      style={{ color: QB.text, background: 'transparent' }}
                      placeholder="Line memo…"
                      value={line.description}
                      onChange={(e) => setLine(idx, 'description', e.target.value)}
                    />
                  </td>
                  <td style={{ borderRight: `1px solid ${QB.gridLine}`, padding: 0 }}>
                    <MoneyInput
                      value={line.debit}
                      disabled={!!line.credit}
                      onChange={(e) => setLine(idx, 'debit', e.target.value)}
                    />
                  </td>
                  <td style={{ borderRight: `1px solid ${QB.gridLine}`, padding: 0 }}>
                    <MoneyInput
                      value={line.credit}
                      disabled={!!line.debit}
                      onChange={(e) => setLine(idx, 'credit', e.target.value)}
                    />
                  </td>
                  <td className="text-center" style={{ padding: 0 }}>
                    <button
                      type="button"
                      onClick={() => removeRow(line.id)}
                      className="w-8 h-8 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-red-600"
                      style={{ color: '#bbb' }}
                      title="Remove line"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: QB.gridHead, borderTop: `2px solid ${QB.gridLine}` }}>
                <td colSpan={3} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setLines([...lines, genRow()])}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
                    style={{ color: QB.green }}
                  >
                    <Plus size={12} strokeWidth={2.5} /> Insert new row
                  </button>
                </td>
                <td
                  className="px-2.5 py-2 text-right font-mono text-[13px] font-bold"
                  style={{ color: QB.text, borderLeft: `1px solid ${QB.gridLine}` }}
                >
                  {fmt(totalDebit)}
                </td>
                <td
                  className="px-2.5 py-2 text-right font-mono text-[13px] font-bold"
                  style={{ color: QB.text, borderLeft: `1px solid ${QB.gridLine}` }}
                >
                  {fmt(totalCredit)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Balance status bar — Peachtree-style footer */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
          style={{
            background: balanced ? '#eef7ee' : '#fdf0ef',
            borderTop: `2px solid ${balanced ? QB.ok : QB.danger}`,
          }}
        >
          <div className="flex items-center gap-2">
            {balanced ? (
              <>
                <CheckCircle2 size={16} style={{ color: QB.ok }} />
                <span className="text-[12px] font-bold" style={{ color: QB.ok }}>
                  Debits and credits are equal — ready to post
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} style={{ color: QB.danger }} />
                <span className="text-[12px] font-bold" style={{ color: QB.danger }}>
                  Out of balance by {fmt(diff)}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-6 text-right">
            <TotalBlock label="Total Debits" value={fmt(totalDebit)} />
            <div className="w-px h-8" style={{ background: QB.gridLine }} />
            <TotalBlock label="Total Credits" value={fmt(totalCredit)} />
          </div>
        </div>
      </div>

      {/* Help hint */}
      <p className="mt-3 text-[11px]" style={{ color: QB.muted }}>
        Tip: Enter an amount in either Debit or Credit — not both. A new row is added automatically when you complete the last line.
      </p>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl overflow-hidden shadow-2xl"
              style={{ background: QB.panel, border: `1px solid ${QB.panelBorder}` }}
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
            >
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ background: '#3d3d3d', color: '#fff' }}
              >
                <div>
                  <h2 className="text-[14px] font-bold">Review Journal Entry</h2>
                  <p className="text-[11px] opacity-70 mt-0.5">Confirm before posting to the general ledger</p>
                </div>
                <button type="button" onClick={() => setConfirmOpen(false)} className="opacity-70 hover:opacity-100">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5">
                <div
                  className="grid grid-cols-3 gap-4 mb-4 text-[12px]"
                  style={{ borderBottom: `1px solid ${QB.gridLine}`, paddingBottom: 12 }}
                >
                  <div>
                    <span style={{ color: QB.muted }}>Date </span>
                    <span className="font-semibold">{displayDate}</span>
                  </div>
                  <div>
                    <span style={{ color: QB.muted }}>Journal No. </span>
                    <span className="font-mono font-semibold">{reference}</span>
                  </div>
                  <div className="col-span-1 md:col-span-1 truncate">
                    <span style={{ color: QB.muted }}>Memo </span>
                    <span className="font-semibold">{memo || '—'}</span>
                  </div>
                </div>

                <div style={{ border: `1px solid ${QB.gridLine}` }}>
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr style={{ background: QB.gridHead }}>
                        <th className="px-3 py-2 text-left font-bold uppercase text-[10px]" style={{ color: QB.label }}>
                          Account
                        </th>
                        <th className="px-3 py-2 text-right font-bold uppercase text-[10px] w-28" style={{ color: QB.label }}>
                          Debit
                        </th>
                        <th className="px-3 py-2 text-right font-bold uppercase text-[10px] w-28" style={{ color: QB.label }}>
                          Credit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines
                        .filter(
                          (l) =>
                            l.accountId &&
                            (parseFloat(l.debit || 0) > 0 || parseFloat(l.credit || 0) > 0)
                        )
                        .map((l, i) => {
                          const acc = accounts.find((a) => String(a.id) === String(l.accountId));
                          return (
                            <tr key={i} style={{ borderTop: `1px solid ${QB.gridLine}` }}>
                              <td className="px-3 py-2.5">
                                <span className="font-mono text-[10px] text-[#888] mr-1.5">{acc?.code}</span>
                                <span className="font-semibold">{acc?.name || '—'}</span>
                                {l.description && (
                                  <p className="text-[11px] mt-0.5" style={{ color: QB.muted }}>
                                    {l.description}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {parseFloat(l.debit || 0) > 0 ? fmt(parseFloat(l.debit)) : ''}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {parseFloat(l.credit || 0) > 0 ? fmt(parseFloat(l.credit)) : ''}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: QB.gridHead, borderTop: `2px solid ${QB.gridLine}` }}>
                        <td className="px-3 py-2.5 text-right font-bold uppercase text-[10px]" style={{ color: QB.label }}>
                          Totals
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">{fmt(totalDebit)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">{fmt(totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div
                className="flex gap-2 px-5 py-4"
                style={{ background: QB.toolbar, borderTop: `1px solid ${QB.toolbarBorder}` }}
              >
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 h-9 text-[12px] font-bold transition-colors hover:bg-white"
                  style={{ border: `1px solid ${QB.panelBorder}`, color: QB.text, background: '#fff' }}
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={submit}
                  className="flex-[2] h-9 inline-flex items-center justify-center gap-2 text-[12px] font-bold text-white transition-colors"
                  style={{ background: QB.green }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = QB.greenHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = QB.green;
                  }}
                >
                  <FileText size={14} />
                  {nextAction === 'post' ? 'Post to General Ledger' : 'Save as Draft'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 shadow-lg text-[13px] font-semibold text-white"
            style={{ background: '#3d3d3d' }}
          >
            <CheckCircle2 size={16} style={{ color: '#90ee90' }} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .journal-field {
          width: 100%;
          height: 32px;
          padding: 0 10px;
          font-size: 12.5px;
          color: ${QB.text};
          background: ${QB.inputBg};
          border: 1px solid ${QB.gridLine};
          outline: none;
        }
        .journal-field:focus {
          border-color: ${QB.inputFocus};
          box-shadow: 0 0 0 1px ${QB.inputFocus};
        }
      `}</style>
    </div>
  );
}

function ToolbarBtn({ icon: Icon, label, onClick, disabled, primary, spin }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={
        primary
          ? {
              background: QB.green,
              color: '#fff',
              border: `1px solid ${QB.greenHover}`,
            }
          : {
              background: '#fff',
              color: QB.text,
              border: `1px solid ${QB.panelBorder}`,
            }
      }
      onMouseEnter={(e) => {
        if (!disabled && primary) e.currentTarget.style.background = QB.greenHover;
        if (!disabled && !primary) e.currentTarget.style.background = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        if (primary) e.currentTarget.style.background = QB.green;
        else e.currentTarget.style.background = '#fff';
      }}
    >
      <Icon size={13} className={spin ? 'animate-spin' : undefined} />
      {label}
    </button>
  );
}

function HeaderField({ label, children, className = '' }) {
  return (
    <div
      className={`px-4 py-3 ${className}`}
      style={{ borderRight: `1px solid ${QB.gridLine}` }}
    >
      <label
        className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: QB.label }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function TotalBlock({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: QB.muted }}>
        {label}
      </p>
      <p className="font-mono font-bold text-[15px]" style={{ color: QB.text }}>
        {value}
      </p>
    </div>
  );
}
