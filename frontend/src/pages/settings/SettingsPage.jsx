import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Receipt, ShoppingCart, Calculator, Package, ShieldCheck,
  Save, AlertTriangle, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Tabs configuration
const TABS = [
  { id: 'company', label: 'Company Info', icon: Building2 },
  { id: 'sales', label: 'Sales & Invoicing', icon: Receipt },
  { id: 'expenses', label: 'Expenses & Vendors', icon: ShoppingCart },
  { id: 'accounting', label: 'Advanced Accounting', icon: Calculator },
  { id: 'inventory', label: 'Inventory Settings', icon: Package },
  { id: 'security', label: 'Security & Roles', icon: ShieldCheck },
];

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-bold text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({ value, onChange, options, disabled }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500"
    >
      <option value="">— Select —</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function InputField({ type = 'text', value, onChange, placeholder, disabled }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500"
    />
  );
}

export default function SettingsPage() {
  const { user, activeCompany, fetchUserCompanies } = useAuthStore();
  const activeCompanyId = activeCompany?.id;
  const effectiveRole = activeCompany?.user_role || user?.role || 'Member';
  const canEdit = ['Company Admin', 'Accountant', 'Super Admin'].includes(effectiveRole);
  const canSave = Boolean(activeCompanyId && canEdit && !saving);
  const requestConfig = useMemo(
    () => activeCompanyId ? { headers: { 'x-company-id': String(activeCompanyId) } } : undefined,
    [activeCompanyId]
  );

  const [activeTab, setActiveTab] = useState('company');
  const [accounts, setAccounts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  const loadData = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      setMessage({ type: 'error', text: 'No active company selected. Please select a company before editing settings.' });
      return;
    }
    setLoading(true);
    try {
      const [accRes, setRes] = await Promise.all([
        api.get(`/accounts/company/${activeCompanyId}`, requestConfig),
        api.get(`/settings/${activeCompanyId}`, requestConfig)
      ]);
      const raw = setRes.data || {};
      setAccounts(accRes.data || []);
      setSettings({
        ...raw,
        defaultSalesAccountId: raw.defaultSalesAccountId || raw.default_sales_account_id || '',
        defaultApAccountId: raw.defaultApAccountId || raw.default_ap_account_id || '',
        defaultArAccountId: raw.defaultArAccountId || raw.default_ar_account_id || '',
        defaultInventoryAccountId: raw.defaultInventoryAccountId || raw.default_inventory_account_id || '',
        defaultCogsAccountId: raw.defaultCogsAccountId || raw.default_cogs_account_id || '',
        defaultCashAccountId: raw.defaultCashAccountId || raw.default_cash_account_id || '',
        taxRate: raw.taxRate ?? raw.tax_rate ?? 0,
      });
    } catch (err) {
      const text = err.response?.status === 403
        ? 'Access denied for this company. Please reselect your active company or sign in again.'
        : 'Failed to load configuration data.';
      setMessage({ type: 'error', text });
    }
    setLoading(false);
  }, [activeCompanyId, requestConfig]);

  useEffect(() => {
    Promise.resolve().then(() => loadData());
  }, [loadData]);

  const saveSettings = async () => {
    if (!activeCompanyId) {
      setMessage({ type: 'error', text: 'No active company selected. Please select a company before saving settings.' });
      return;
    }
    if (!canEdit) {
      setMessage({ type: 'error', text: 'You do not have permission to change settings.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/settings/${activeCompanyId}`, {
        defaultSalesAccountId: settings.defaultSalesAccountId || null,
        defaultApAccountId: settings.defaultApAccountId || null,
        defaultArAccountId: settings.defaultArAccountId || null,
        defaultInventoryAccountId: settings.defaultInventoryAccountId || null,
        defaultCogsAccountId: settings.defaultCogsAccountId || null,
        defaultCashAccountId: settings.defaultCashAccountId || null,
        taxRate: settings.taxRate || 0,
      }, requestConfig);
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      const text = err.response?.status === 403
        ? 'Permission denied. This action requires Company Admin or Accountant access for the active company.'
        : err.response?.data?.error || 'Failed to save settings.';
      setMessage({ type: 'error', text });
    }
    setSaving(false);
  };

  const refreshCompanyContext = async () => {
    setMessage(null);
    setLoading(true);
    try {
      await fetchUserCompanies();
      setMessage({ type: 'success', text: 'Company context refreshed. Try loading or saving again.' });
    } catch {
      setMessage({ type: 'error', text: 'Could not refresh company context. Please sign in again.' });
    }
    setLoading(false);
  };

  const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  // Helper for generating account options
  const accountOptions = useMemo(() => {
    return accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }));
  }, [accounts]);

  const filterAccounts = (types) => accountOptions.filter(o => {
    const acc = accounts.find(a => a.id === parseInt(o.value) || a.id === o.value);
    return acc && types.includes(acc.category || acc.type);
  });

  const renderContent = () => {
    if (loading) {
      return <div className="p-10 text-center text-slate-500 font-medium">Loading settings...</div>;
    }

    switch (activeTab) {
      case 'company':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 border-b border-slate-100 pb-3">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Legal Company Name" hint="Appears on official documents.">
                <InputField value={settings.companyName || activeCompany?.name} onChange={v => update('companyName', v)} disabled={!canEdit} />
              </Field>
              <Field label="Tax ID / EIN" hint="Used for tax reporting.">
                <InputField value={settings.taxId} onChange={v => update('taxId', v)} disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Company Address">
              <textarea 
                rows={3} 
                className="w-full p-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500" 
                value={settings.address || ''} 
                onChange={e => update('address', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Contact Email">
                <InputField type="email" value={settings.contactEmail} onChange={v => update('contactEmail', v)} disabled={!canEdit} />
              </Field>
              <Field label="Contact Phone">
                <InputField value={settings.contactPhone} onChange={v => update('contactPhone', v)} disabled={!canEdit} />
              </Field>
            </div>
          </div>
        );
      
      case 'sales':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 border-b border-slate-100 pb-3">Sales & Invoicing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default Sales Account" hint="Revenue account for sales invoices.">
                <SelectField value={settings.defaultSalesAccountId} onChange={v => update('defaultSalesAccountId', v)} options={filterAccounts(['Revenue', 'Income'])} disabled={!canEdit} />
              </Field>
              <Field label="Accounts Receivable (A/R)" hint="Asset account for unpaid invoices.">
                <SelectField value={settings.defaultArAccountId} onChange={v => update('defaultArAccountId', v)} options={filterAccounts(['Asset'])} disabled={!canEdit} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default Payment Terms">
                <SelectField 
                  value={settings.defaultPaymentTerms} 
                  onChange={v => update('defaultPaymentTerms', v)} 
                  options={[
                    {value: '0', label: 'Due on Receipt'},
                    {value: '15', label: 'Net 15'},
                    {value: '30', label: 'Net 30'},
                    {value: '60', label: 'Net 60'},
                  ]} 
                  disabled={!canEdit} 
                />
              </Field>
              <Field label="Invoice Number Prefix">
                <InputField value={settings.invoicePrefix} onChange={v => update('invoicePrefix', v)} placeholder="e.g. INV-" disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Default Sales Tax Rate (%)">
              <InputField type="number" value={settings.taxRate} onChange={v => update('taxRate', v)} disabled={!canEdit} />
            </Field>
          </div>
        );

      case 'expenses':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 border-b border-slate-100 pb-3">Expenses & Vendors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Accounts Payable (A/P)" hint="Liability account for unpaid bills.">
                <SelectField value={settings.defaultApAccountId} onChange={v => update('defaultApAccountId', v)} options={filterAccounts(['Liability'])} disabled={!canEdit} />
              </Field>
              <Field label="Default COGS / Expense Account" hint="Cost of goods sold account.">
                <SelectField value={settings.defaultCogsAccountId} onChange={v => update('defaultCogsAccountId', v)} options={filterAccounts(['Expense', 'Cost'])} disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Default Bill Payment Terms">
              <SelectField 
                value={settings.defaultBillTerms} 
                onChange={v => update('defaultBillTerms', v)} 
                options={[
                  {value: '0', label: 'Due on Receipt'},
                  {value: '30', label: 'Net 30'},
                ]} 
                disabled={!canEdit} 
              />
            </Field>
          </div>
        );

      case 'accounting':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 border-b border-slate-100 pb-3">Advanced Accounting</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default Cash / Bank Account" hint="Main operating account.">
                <SelectField value={settings.defaultCashAccountId} onChange={v => update('defaultCashAccountId', v)} options={filterAccounts(['Asset'])} disabled={!canEdit} />
              </Field>
              <Field label="Fiscal Year Start Month">
                <SelectField 
                  value={settings.fiscalYearStart} 
                  onChange={v => update('fiscalYearStart', v)} 
                  options={[
                    {value: '1', label: 'January'},
                    {value: '4', label: 'April'},
                    {value: '7', label: 'July'},
                    {value: '10', label: 'October'}
                  ]} 
                  disabled={!canEdit} 
                />
              </Field>
            </div>
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="text-[13px] font-bold text-amber-900">Close the Books</h3>
              <p className="text-[12px] text-amber-700 mt-1 mb-3">Prevent changes to transactions dated on or before the closing date.</p>
              <Field label="Closing Date">
                <InputField type="date" value={settings.closingDate} onChange={v => update('closingDate', v)} disabled={!canEdit} />
              </Field>
            </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 border-b border-slate-100 pb-3">Inventory Settings</h2>
            <Field label="Inventory Asset Account" hint="Tracks the total value of stock on hand.">
              <SelectField value={settings.defaultInventoryAccountId} onChange={v => update('defaultInventoryAccountId', v)} options={filterAccounts(['Asset'])} disabled={!canEdit} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Costing Method" hint="Inventory valuation logic.">
                <SelectField 
                  value={settings.costingMethod || 'FIFO'} 
                  onChange={v => update('costingMethod', v)} 
                  options={[
                    {value: 'FIFO', label: 'First In, First Out (FIFO)'},
                    {value: 'LIFO', label: 'Last In, First Out (LIFO)'},
                    {value: 'AVG', label: 'Weighted Average Cost'}
                  ]} 
                  disabled={!canEdit} 
                />
              </Field>
              <Field label="Global Low Stock Threshold" hint="Warn when item quantity drops below this.">
                <InputField type="number" value={settings.lowStockThreshold} onChange={v => update('lowStockThreshold', v)} disabled={!canEdit} />
              </Field>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 border-b border-slate-100 pb-3">Security & Access</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[14px] text-slate-900">Your Current Role: {effectiveRole}</h3>
                  <p className="text-[12px] text-slate-500">You are logged in as {user?.email}.</p>
                </div>
              </div>
              {!canEdit && (
                <div className="p-3 bg-red-50 text-red-700 text-[12px] rounded border border-red-100 font-medium flex items-center gap-2">
                  <AlertTriangle size={15} />
                  You cannot modify settings. Only Company Admins and Accountants have write access.
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[26px] font-black text-slate-900 tracking-tight">Settings & Preferences</h1>
          <p className="text-[13px] text-slate-500 font-medium mt-1">Manage configuration for {activeCompany?.name || 'your workspace'}.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">
              Role: {effectiveRole}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold ${canEdit ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {canEdit ? 'Settings editable' : 'Read-only access'}
            </span>
          </div>
        </div>
        <button 
          onClick={saveSettings} 
          disabled={!canSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg transition-colors shadow-sm"
        >
          {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          Save Changes
        </button>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar Nav */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-[13px] font-bold transition-colors border-l-4 ${
                    isActive 
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800' 
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {message && (
              <Motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className={`mb-5 p-4 rounded-lg border text-[13px] font-bold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  {message.type === 'success' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                  {message.text}
                </span>
                {message.text.includes('company') && (
                  <button
                    type="button"
                    onClick={refreshCompanyContext}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-white/80 border border-current text-[11px] font-bold hover:bg-white"
                  >
                    Refresh company
                  </button>
                )}
              </Motion.div>
            )}
          </AnimatePresence>

          <Motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[500px]"
          >
            {renderContent()}
          </Motion.div>
        </div>
      </div>
    </div>
  );
}
