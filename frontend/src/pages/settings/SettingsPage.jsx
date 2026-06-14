import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Calculator, Palette, Globe, Settings, Mail,
  UploadCloud, ShieldCheck, Save, AlertTriangle, RefreshCw,
  Plus, Trash2, Download, Eye, Check, CheckSquare,
  FileSpreadsheet, Play, ArrowRight, Lock, Key, FileText,
  User, Computer, Info, ArrowLeftRight, Bell
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Tabs configuration
const TABS = [
  { id: 'company', label: 'Company Info', icon: Building2 },
  { id: 'accounting', label: 'Accounting Preferences', icon: Calculator },
  { id: 'branding', label: 'Branding & Form Styles', icon: Palette },
  { id: 'currency', label: 'Currencies', icon: Globe },
  { id: 'modules', label: 'Feature Toggles', icon: Settings },
  { id: 'email', label: 'Email & Reminders', icon: Mail },
  { id: 'notifications', label: 'Notification Preferences', icon: Bell },
  { id: 'import', label: 'Data Import / Export', icon: UploadCloud },
  { id: 'security', label: 'Security & Audit', icon: ShieldCheck },
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
      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
    >
      <option value="">— Select Account —</option>
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
      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
    />
  );
}

export default function SettingsPage() {
  const { user, activeCompany, fetchUserCompanies, settings, setSettings } = useAuthStore();
  const activeCompanyId = activeCompany?.id;
  const effectiveRole = activeCompany?.user_role || user?.role || 'Member';
  const canEdit = ['Company Admin', 'Accountant', 'Super Admin'].includes(effectiveRole);

  const [activeTab, setActiveTab] = useState('company');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Local settings copy to edit before saving
  const [localSettings, setLocalSettings] = useState({});

  // Notification preferences states
  const [notifPreferences, setNotifPreferences] = useState({
    email_enabled: true,
    in_app_enabled: true,
    critical_only: false
  });

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // CSV Import state
  const [importType, setImportType] = useState('coa'); // 'coa' | 'customers' | 'vendors' | 'products' | 'balances'
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState(null);

  const canSave = Boolean(activeCompanyId && canEdit && !saving);

  const requestConfig = useMemo(
    () => activeCompanyId ? { headers: { 'x-company-id': String(activeCompanyId) } } : undefined,
    [activeCompanyId]
  );

  // Load backend configurations
  const loadData = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      setMessage({ type: 'error', text: 'No active company selected.' });
      return;
    }
    setLoading(true);
    try {
      const [accRes, setRes, prefRes] = await Promise.all([
        api.get(`/accounts/company/${activeCompanyId}`, requestConfig),
        api.get(`/settings/${activeCompanyId}`, requestConfig),
        api.get(`/notifications/preferences/${activeCompanyId}`, requestConfig).catch(e => {
          console.error('Failed to load notification preferences:', e);
          return { data: { email_enabled: true, in_app_enabled: true, critical_only: false } };
        })
      ]);
      setAccounts(accRes.data || []);
      setNotifPreferences(prefRes.data || { email_enabled: true, in_app_enabled: true, critical_only: false });
      const raw = setRes.data || {};
      
      // Seed default settings schema
      const initialSettings = {
        companyName: raw.companyName || activeCompany?.name || '',
        taxId: raw.taxId || '',
        ntn: raw.ntn || '',
        strn: raw.strn || '',
        address: raw.address || '',
        contactEmail: raw.contactEmail || '',
        contactPhone: raw.contactPhone || '',
        fiscalYear: raw.fiscalYear || 'July-June',
        
        defaultSalesAccountId: raw.defaultSalesAccountId || raw.default_sales_account_id || '',
        defaultApAccountId: raw.defaultApAccountId || raw.default_ap_account_id || '',
        defaultArAccountId: raw.defaultArAccountId || raw.default_ar_account_id || '',
        defaultInventoryAccountId: raw.defaultInventoryAccountId || raw.default_inventory_account_id || '',
        defaultCogsAccountId: raw.defaultCogsAccountId || raw.default_cogs_account_id || '',
        defaultCashAccountId: raw.defaultCashAccountId || raw.default_cash_account_id || '',
        defaultSalariesAccountId: raw.defaultSalariesAccountId || raw.default_salaries_account_id || '',
        closingDate: raw.closingDate || '',
        
        logoUrl: raw.logoUrl || null,
        invoiceTemplate: raw.invoiceTemplate || 'Classic',
        accentColor: raw.accentColor || '#10b981',
        
        baseCurrency: raw.baseCurrency || 'PKR',
        foreignCurrencies: raw.foreignCurrencies || [],
        
        inventoryEnabled: raw.inventoryEnabled ?? true,
        payrollEnabled: raw.payrollEnabled ?? false,
        warehousingEnabled: raw.warehousingEnabled ?? true,
        budgetingEnabled: raw.budgetingEnabled ?? true,
        
        smtpHost: raw.smtpHost || '',
        smtpPort: raw.smtpPort || '',
        smtpUser: raw.smtpUser || '',
        smtpPass: raw.smtpPass || '',
        smtpFrom: raw.smtpFrom || '',
        autoRemindersEnabled: raw.autoRemindersEnabled ?? false,
        autoRemindersDays: raw.autoRemindersDays || 5,
        
        minPasswordLength: raw.minPasswordLength || 8,
        passwordComplexity: raw.passwordComplexity ?? false,
        sessionTimeout: raw.sessionTimeout || '1hour',
        mfaRequired: raw.mfaRequired ?? false,
      };
      
      setLocalSettings(initialSettings);
      setSettings(initialSettings);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load configuration data.' });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, requestConfig, activeCompany?.name, setSettings]);

  useEffect(() => {
    Promise.resolve().then(() => loadData());
  }, [loadData]);

  // Load audit logs when switching to Security
  const fetchAuditLogs = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoadingAudit(true);
    try {
      const response = await api.get(`/audit/${activeCompanyId}`, requestConfig);
      setAuditLogs(response.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [activeCompanyId, requestConfig]);

  useEffect(() => {
    if (activeTab === 'security') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Save modified configurations
  const saveSettings = async () => {
    if (!activeCompanyId) return;
    if (!canEdit) return;

    setSaving(true);
    setMessage(null);
    try {
      if (activeTab === 'notifications') {
        const res = await api.put(`/notifications/preferences/${activeCompanyId}`, notifPreferences, requestConfig);
        setNotifPreferences(res.data);
        setMessage({ type: 'success', text: 'Notification preferences saved successfully.' });
        setTimeout(() => setMessage(null), 4000);
        setSaving(false);
        return;
      }

      // 1. Put settings updates
      const res = await api.put(`/settings/${activeCompanyId}`, localSettings, requestConfig);

      // 2. Post audit log entry
      await api.post(`/audit/${activeCompanyId}`, {
        action: 'UPDATE',
        entityType: 'SETTINGS',
        entityId: 'SETTINGS',
        beforeState: settings,
        afterState: localSettings
      }, requestConfig);

      // 3. Sync Zustand global store
      setSettings(res.data);
      setMessage({ type: 'success', text: 'Settings saved & audit logged successfully.' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Serve static logo correctly in dev vs prod
  const getLogoSrc = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const isProd = import.meta.env.PROD;
    const host = isProd ? window.location.origin : 'http://localhost:5001';
    return `${host}${path}`;
  };

  // Logo file upload handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Logo file size must be less than 2MB.' });
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    setSaving(true);
    try {
      const res = await api.post(`/upload/logo/${activeCompanyId}`, formData, {
        headers: {
          ...requestConfig?.headers,
          'Content-Type': 'multipart/form-data'
        }
      });
      setLocalSettings(s => ({ ...s, logoUrl: res.data.url }));
      setMessage({ type: 'success', text: 'Logo uploaded successfully. Save changes to commit.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upload logo.' });
    } finally {
      setSaving(false);
    }
  };

  // CSV template generation
  const downloadTemplate = (type) => {
    let headers = '';
    let filename = '';
    switch (type) {
      case 'coa':
        headers = 'Code,Name,Type,Category,Description\n1010,Main Cash,Asset,Asset,Primary cash account\n2010,Accounts Payable,Liability,Liability,AP control account\n4010,Sales Revenue,Revenue,Revenue,Sales revenue';
        filename = 'chart_of_accounts_template.csv';
        break;
      case 'customers':
        headers = 'Name,Email,Phone,Address,NTN,STRN\nAcme Corp,acme@example.com,0300-1234567,123 Main St Lahore,1234567-8,9876543-2';
        filename = 'customers_template.csv';
        break;
      case 'vendors':
        headers = 'Name,Email,Phone,Address,NTN,STRN\nGlobal Supplier,supplier@example.com,0321-7654321,456 Industrial Zone Karachi,8765432-1,2345678-9';
        filename = 'vendors_template.csv';
        break;
      case 'products':
        headers = 'Code,Name,Description,Price,Cost,Sku\nPROD001,Premium Widget,Industrial widget,1500,1000,WIDG-PREM-1';
        filename = 'products_template.csv';
        break;
      case 'balances':
        headers = 'AccountCode,Debit,Credit,Date\n1010,50000,0,2026-06-01\n4010,0,50000,2026-06-01';
        filename = 'opening_balances_template.csv';
        break;
    }
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV parsing
  const handleCSVFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setMessage({ type: 'error', text: 'CSV file is empty or missing data rows.' });
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim());
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = values[idx];
          });
          parsed.push(obj);
        }
      }
      setImportPreview(parsed);
      setMessage({ type: 'success', text: `Loaded ${parsed.length} rows from CSV. Review preview below.` });
    };
    reader.readAsText(file);
  };

  // Execute Batch CSV Importing
  const handleImportCSV = async () => {
    if (!importPreview.length || importing) return;

    setImporting(true);
    setImportProgress(0);
    setImportStatus('Starting import...');

    let successCount = 0;
    let failCount = 0;
    const total = importPreview.length;

    if (importType === 'balances') {
      // Process opening balances as a single balanced journal entry
      try {
        setImportStatus('Verifying and aligning ledger balances...');
        const lines = importPreview.map(row => {
          const debit = parseFloat(row.Debit || row.debit || 0);
          const credit = parseFloat(row.Credit || row.credit || 0);
          const accountCode = row.AccountCode || row.account_code;
          
          const acc = accounts.find(a => String(a.code) === String(accountCode));
          if (!acc) throw new Error(`Account code "${accountCode}" not found in chart of accounts.`);
          
          return {
            account_id: acc.id,
            debit,
            credit,
            description: 'Opening Balance Import'
          };
        });

        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          throw new Error(`Unbalanced opening journal. Debits (${totalDebit}) must equal Credits (${totalCredit}).`);
        }

        const entryDate = importPreview[0].Date || importPreview[0].date || new Date().toISOString().slice(0, 10);

        // 1. Create Draft Journal
        const journalRes = await api.post('/journal', {
          entry_date: entryDate,
          description: 'Opening Balances Import',
          lines
        }, requestConfig);

        // 2. Post Journal Entry to Ledger
        await api.post(`/journal/${journalRes.data.id}/post`, {}, requestConfig);

        successCount = total;
        setImportProgress(100);
        setImportStatus('Opening balances posted to Ledger successfully!');
      } catch (err) {
        console.error(err);
        failCount = total;
        setImportStatus(`Import failed: ${err.message || 'Error occurred during journal processing'}`);
      }
    } else {
      // Normal sequential API records importing
      for (let i = 0; i < total; i++) {
        const row = importPreview[i];
        try {
          if (importType === 'coa') {
            await api.post('/accounts', {
              code: row.Code || row.code,
              name: row.Name || row.name,
              type: row.Type || row.type || 'Asset',
              category: row.Category || row.category || 'Asset',
              description: row.Description || row.description || ''
            }, requestConfig);
          } else if (importType === 'customers') {
            await api.post(`/clients/${activeCompanyId}`, {
              name: row.Name || row.name,
              email: row.Email || row.email || '',
              phone: row.Phone || row.phone || '',
              address: row.Address || row.address || '',
              ntn: row.NTN || row.ntn || '',
              strn: row.STRN || row.strn || '',
            }, requestConfig);
          } else if (importType === 'vendors') {
            await api.post(`/vendors/${activeCompanyId}`, {
              name: row.Name || row.name,
              email: row.Email || row.email || '',
              phone: row.Phone || row.phone || '',
              address: row.Address || row.address || '',
              ntn: row.NTN || row.ntn || '',
              strn: row.STRN || row.strn || '',
            }, requestConfig);
          } else if (importType === 'products') {
            await api.post(`/products/${activeCompanyId}`, {
              code: row.Code || row.code,
              name: row.Name || row.name,
              description: row.Description || row.description || '',
              price: parseFloat(row.Price || row.price || 0),
              cost: parseFloat(row.Cost || row.cost || 0),
              sku: row.Sku || row.sku || '',
            }, requestConfig);
          }
          successCount++;
        } catch (err) {
          console.error(err);
          failCount++;
        }
        setImportProgress(Math.round(((i + 1) / total) * 100));
        setImportStatus(`Processing: ${i + 1}/${total} (${successCount} OK, ${failCount} Errors)`);
      }
    }

    // Log the import to the audit log
    try {
      await api.post(`/audit/${activeCompanyId}`, {
        action: 'IMPORT',
        entityType: importType.toUpperCase(),
        entityId: 'IMPORT',
        beforeState: null,
        afterState: { type: importType, count: successCount }
      }, requestConfig);
    } catch (auditErr) {
      console.error(auditErr);
    }

    setImporting(false);
    setMessage({
      type: failCount === 0 ? 'success' : 'error',
      text: `Import completed: ${successCount} imported, ${failCount} failed.`
    });
    setImportPreview([]);
    loadData();
  };

  const update = (key, val) => setLocalSettings(s => ({ ...s, [key]: val }));

  // Helper for generating account options
  const accountOptions = useMemo(() => {
    return accounts.map(a => ({ value: a.id, label: `${a.code} - ${a.name} (${a.category})` }));
  }, [accounts]);

  const filterAccounts = (categories) => {
    return accountOptions.filter(o => {
      const acc = accounts.find(a => a.id === parseInt(o.value) || a.id === o.value);
      return acc && categories.includes(acc.category);
    });
  };

  const toggleForeignCurrency = (cur) => {
    const list = localSettings.foreignCurrencies || [];
    if (list.includes(cur)) {
      update('foreignCurrencies', list.filter(c => c !== cur));
    } else {
      update('foreignCurrencies', [...list, cur]);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-600 border-r-emerald-600 animate-spin"></div>
          </div>
          <p className="text-[13px] font-bold text-slate-500 tracking-wide">Loading configurations...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'company':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 size={20} className="text-emerald-500" /> Company Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Legal Company Name" hint="Appears on official vouchers & invoices.">
                <InputField value={localSettings.companyName} onChange={v => update('companyName', v)} disabled={!canEdit} />
              </Field>
              <Field label="Tax ID / EIN" hint="Federal Tax ID number.">
                <InputField value={localSettings.taxId} onChange={v => update('taxId', v)} disabled={!canEdit} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="NTN (National Tax Number)" hint="NTN registered with FBR.">
                <InputField value={localSettings.ntn} onChange={v => update('ntn', v)} disabled={!canEdit} />
              </Field>
              <Field label="STRN (Sales Tax Registration Number)" hint="STRN registered with FBR.">
                <InputField value={localSettings.strn} onChange={v => update('strn', v)} disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Official Business Address">
              <textarea
                rows={3}
                className="w-full p-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-emerald-500 transition-all focus:ring-2 focus:ring-emerald-500/20"
                value={localSettings.address || ''}
                onChange={e => update('address', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Contact Email">
                <InputField type="email" value={localSettings.contactEmail} onChange={v => update('contactEmail', v)} disabled={!canEdit} />
              </Field>
              <Field label="Contact Phone">
                <InputField value={localSettings.contactPhone} onChange={v => update('contactPhone', v)} disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Fiscal Year Setup" hint="Sets the start of your reporting cycles.">
              <select
                value={localSettings.fiscalYear || 'July-June'}
                onChange={e => update('fiscalYear', e.target.value)}
                disabled={!canEdit}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              >
                <option value="July-June">July 1 - June 30 (Standard Pakistan)</option>
                <option value="Jan-Dec">January 1 - December 31 (Calendar Year)</option>
                <option value="April-March">April 1 - March 31</option>
              </select>
            </Field>
          </div>
        );

      case 'accounting':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Calculator size={20} className="text-emerald-500" /> Accounting Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Accounts Receivable (A/R)" hint="Tracks outstanding customer balances.">
                <SelectField value={localSettings.defaultArAccountId} onChange={v => update('defaultArAccountId', v)} options={filterAccounts(['Asset'])} disabled={!canEdit} />
              </Field>
              <Field label="Accounts Payable (A/P)" hint="Tracks outstanding vendor payables.">
                <SelectField value={localSettings.defaultApAccountId} onChange={v => update('defaultApAccountId', v)} options={filterAccounts(['Liability'])} disabled={!canEdit} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default Cash & Bank Account" hint="Operating account for liquid funds.">
                <SelectField value={localSettings.defaultCashAccountId} onChange={v => update('defaultCashAccountId', v)} options={filterAccounts(['Asset'])} disabled={!canEdit} />
              </Field>
              <Field label="Default Sales Revenue Account" hint="Main income account for product sales.">
                <SelectField value={localSettings.defaultSalesAccountId} onChange={v => update('defaultSalesAccountId', v)} options={filterAccounts(['Revenue'])} disabled={!canEdit} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default Inventory Asset Account" hint="Monitors physical stock value.">
                <SelectField value={localSettings.defaultInventoryAccountId} onChange={v => update('defaultInventoryAccountId', v)} options={filterAccounts(['Asset'])} disabled={!canEdit} />
              </Field>
              <Field label="Default COGS Account" hint="Records direct cost of sold stock.">
                <SelectField value={localSettings.defaultCogsAccountId} onChange={v => update('defaultCogsAccountId', v)} options={filterAccounts(['Expense'])} disabled={!canEdit} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default Salaries Expense Account" hint="Tracks payroll salaries cost.">
                <SelectField value={localSettings.defaultSalariesAccountId} onChange={v => update('defaultSalariesAccountId', v)} options={filterAccounts(['Expense'])} disabled={!canEdit} />
              </Field>
            </div>

            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-amber-900 font-bold mb-1">
                <Lock size={16} />
                <span className="text-[13px]">Close the Books</span>
              </div>
              <p className="text-[12px] text-amber-700 mb-3 leading-relaxed">
                Prevent edits, changes, or deletions to any general ledger transactions dated on or before this closing date.
              </p>
              <InputField type="date" value={localSettings.closingDate} onChange={v => update('closingDate', v)} disabled={!canEdit} />
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Palette size={20} className="text-emerald-500" /> Branding & Forms
            </h2>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="w-28 h-28 bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative group">
                {localSettings.logoUrl ? (
                  <>
                    <img src={getLogoSrc(localSettings.logoUrl)} alt="Company Logo" className="w-full h-full object-contain" />
                    <button 
                      onClick={() => update('logoUrl', null)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-[11px] font-bold"
                    >
                      Remove Logo
                    </button>
                  </>
                ) : (
                  <div className="text-center text-slate-400 p-2">
                    <UploadCloud size={24} className="mx-auto mb-1 text-slate-300" />
                    <span className="text-[10px] font-bold block">No Logo</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center md:text-left">
                <h3 className="font-bold text-[14px] text-slate-900">Upload Company Logo</h3>
                <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
                  Support PNG, JPEG, or WebP formats. Max file size: 2MB. Logo will automatically display on all reports, invoices, and purchase vouchers.
                </p>
                <div className="flex justify-center md:justify-start">
                  <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5">
                    <Plus size={14} /> Upload Image
                    <input type="file" onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Invoice & Voucher Template Style">
                <select
                  value={localSettings.invoiceTemplate || 'Classic'}
                  onChange={e => update('invoiceTemplate', e.target.value)}
                  disabled={!canEdit}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                >
                  <option value="Classic">Classic ERP (Professional & Compact)</option>
                  <option value="Modern">Modern Minimalist (Sleek Clean Borders)</option>
                  <option value="Clean">Bold Corporate (High-Contrast Header)</option>
                </select>
              </Field>

              <Field label="Accent Brand Color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={localSettings.accentColor || '#10b981'}
                    onChange={e => update('accentColor', e.target.value)}
                    disabled={!canEdit}
                    className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                  />
                  <InputField value={localSettings.accentColor} onChange={v => update('accentColor', v)} disabled={!canEdit} />
                </div>
              </Field>
            </div>
          </div>
        );

      case 'currency':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Globe size={20} className="text-emerald-500" /> Currencies
            </h2>
            
            <Field label="Base / Home Currency" hint="The main currency in which your company ledger is kept.">
              <select
                value={localSettings.baseCurrency || 'PKR'}
                onChange={e => update('baseCurrency', e.target.value)}
                disabled={!canEdit}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
              >
                <option value="PKR">PKR - Pakistani Rupee (₨)</option>
                <option value="USD">USD - United States Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="AED">AED - United Arab Emirates Dirham (د.إ)</option>
                <option value="SAR">SAR - Saudi Riyal (ر.س)</option>
              </select>
            </Field>

            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
              <h3 className="font-bold text-[13px] text-slate-900 mb-2">Track Foreign Currencies</h3>
              <p className="text-[12px] text-slate-500 mb-4">Select foreign currencies to record transactions and view multi-currency reports.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'CNY'].map(cur => {
                  const isChecked = (localSettings.foreignCurrencies || []).includes(cur);
                  return (
                    <label 
                      key={cur} 
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        isChecked 
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 font-bold' 
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleForeignCurrency(cur)}
                        disabled={!canEdit}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[13px]">{cur}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'modules':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Settings size={20} className="text-emerald-500" /> Feature Toggles
            </h2>
            <p className="text-[13px] text-slate-500 font-medium">
              Activate or deactivate ERP modules. Deactivating modules updates sidebar menus and blocks route access.
            </p>

            <div className="space-y-4">
              {[
                { key: 'inventoryEnabled', title: 'Inventory Management', desc: 'Manage products, stock transactions, purchase operations, and low stock alerts.', default: true },
                { key: 'warehousingEnabled', title: 'Multi-Warehousing', desc: 'Track physical stock balances across multiple custom locations and warehouses.', default: true },
                { key: 'budgetingEnabled', title: 'Advanced Budgeting & Analytics', desc: 'Exposes ratios, financial projections, 12-month trends, and monthly operational budgeting.', default: true },
                { key: 'payrollEnabled', title: 'Payroll & HR', desc: 'Generate monthly payroll runs, employee salary structures, tax deductions, and bank templates.', default: false },
              ].map(mod => (
                <div key={mod.key} className="flex items-start justify-between p-4 border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition-colors">
                  <div className="space-y-1 pr-6">
                    <h3 className="text-[14px] font-bold text-slate-900">{mod.title}</h3>
                    <p className="text-[12px] text-slate-500 leading-relaxed max-w-xl">{mod.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={localSettings[mod.key] ?? mod.default}
                      onChange={e => update(mod.key, e.target.checked)}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Mail size={20} className="text-emerald-500" /> Email & Reminders
            </h2>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-[13px] text-slate-900">SMTP Settings</h3>
              <p className="text-[11px] text-slate-500">Configure your company SMTP relay to send official invoices and vouchers via custom email domains.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Field label="SMTP Server Host">
                    <InputField value={localSettings.smtpHost} onChange={v => update('smtpHost', v)} placeholder="smtp.gmail.com" disabled={!canEdit} />
                  </Field>
                </div>
                <Field label="SMTP Port">
                  <InputField type="number" value={localSettings.smtpPort} onChange={v => update('smtpPort', v)} placeholder="587" disabled={!canEdit} />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="SMTP Username">
                  <InputField value={localSettings.smtpUser} onChange={v => update('smtpUser', v)} placeholder="user@company.com" disabled={!canEdit} />
                </Field>
                <Field label="SMTP Password">
                  <InputField type="password" value={localSettings.smtpPass} onChange={v => update('smtpPass', v)} placeholder="••••••••••••" disabled={!canEdit} />
                </Field>
              </div>

              <Field label="From Email Address">
                <InputField value={localSettings.smtpFrom} onChange={v => update('smtpFrom', v)} placeholder="billing@company.com" disabled={!canEdit} />
              </Field>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-[13px] text-slate-900">Automated Invoice Reminders</h3>
                  <p className="text-[11px] text-slate-500">Auto-email unpaid invoices and reminders to customer emails.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.autoRemindersEnabled ?? false}
                    onChange={e => update('autoRemindersEnabled', e.target.checked)}
                    disabled={!canEdit}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              
              {localSettings.autoRemindersEnabled && (
                <div className="pt-3">
                  <Field label="Trigger Reminder Days">
                    <div className="flex items-center gap-3">
                      <InputField type="number" value={localSettings.autoRemindersDays} onChange={v => update('autoRemindersDays', v)} disabled={!canEdit} />
                      <span className="text-[13px] text-slate-600 font-medium shrink-0">days after invoice is overdue.</span>
                    </div>
                  </Field>
                </div>
              )}
            </div>
          </div>
        );

      case 'import':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <UploadCloud size={20} className="text-emerald-500" /> Data Import & Export
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Type selection */}
              <div className="space-y-2">
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Import Schema Module</label>
                {[
                  { id: 'coa', label: 'Chart of Accounts', desc: 'Codes, Categories, Names' },
                  { id: 'customers', label: 'Customers', desc: 'Billing details, NTN/STRN' },
                  { id: 'vendors', label: 'Vendors / Suppliers', desc: 'Payee directories' },
                  { id: 'products', label: 'Product Inventory', desc: 'SKUs, Cost, Selling Prices' },
                  { id: 'balances', label: 'Opening Balances', desc: 'Double-Entry Ledger journal' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setImportType(opt.id);
                      setImportPreview([]);
                    }}
                    className={`w-full text-left p-3 border rounded-xl transition-all ${
                      importType === opt.id
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[13px] block">{opt.label}</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Upload panel */}
              <div className="md:col-span-2 space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center">
                  <FileSpreadsheet size={36} className="text-slate-400 mb-3" />
                  <h3 className="font-bold text-[14px] text-slate-900 mb-1">Upload CSV Template File</h3>
                  <p className="text-[11px] text-slate-500 mb-4 max-w-xs">
                    Please make sure your CSV columns match the official template headers exactly.
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button 
                      onClick={() => downloadTemplate(importType)}
                      className="px-4 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[12px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Download size={14} /> Download CSV Template
                    </button>
                    <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm flex items-center gap-1.5">
                      <UploadCloud size={14} /> Choose CSV
                      <input type="file" onChange={handleCSVFileChange} accept=".csv" className="hidden" />
                    </label>
                  </div>
                </div>

                {importing && (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between text-[12px] text-emerald-800 font-bold">
                      <span>{importStatus}</span>
                      <span>{importProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-2 transition-all duration-150" style={{ width: `${importProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {importPreview.length > 0 && !importing && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-[13px] text-slate-900">Parsed CSV Preview</h4>
                        <p className="text-[11px] text-slate-500">Displaying first 4 rows to check formatting.</p>
                      </div>
                      <button
                        onClick={handleImportCSV}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-black rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Play size={13} /> Run Import ({importPreview.length} Records)
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200">
                            {Object.keys(importPreview[0]).map(k => <th key={k} className="px-4 py-2">{k}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {importPreview.slice(0, 4).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              {Object.values(row).map((val, idx) => <td key={idx} className="px-4 py-2 truncate max-w-[150px]">{String(val)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-500" /> Security & Audit Logs
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Policies */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="font-black text-[13px] text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Lock size={15} /> Company Password Policy
                </h3>
                
                <Field label="Minimum Password Length">
                  <select
                    value={localSettings.minPasswordLength || 8}
                    onChange={e => update('minPasswordLength', parseInt(e.target.value))}
                    disabled={!canEdit}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                  >
                    <option value="8">8 Characters (Standard)</option>
                    <option value="12">12 Characters (Recommended)</option>
                    <option value="16">16 Characters (Enterprise)</option>
                  </select>
                </Field>

                <div className="flex items-start gap-3 mt-4">
                  <input
                    type="checkbox"
                    id="pwComplexity"
                    checked={localSettings.passwordComplexity ?? false}
                    onChange={e => update('passwordComplexity', e.target.checked)}
                    disabled={!canEdit}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <label htmlFor="pwComplexity" className="text-[12px] text-slate-600 cursor-pointer">
                    <span className="font-bold text-slate-800 block">Require Complexity</span>
                    Require numbers, symbols, and mixed uppercase / lowercase.
                  </label>
                </div>

                <div className="pt-2">
                  <Field label="User Session Expiry Timeout">
                    <select
                      value={localSettings.sessionTimeout || '1hour'}
                      onChange={e => update('sessionTimeout', e.target.value)}
                      disabled={!canEdit}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-500 transition-all"
                    >
                      <option value="30mins">30 minutes</option>
                      <option value="1hour">1 hour</option>
                      <option value="4hours">4 hours</option>
                      <option value="1day">1 day</option>
                    </select>
                  </Field>
                </div>

                <div className="flex items-start gap-3 mt-4 border-t border-slate-200 pt-4">
                  <input
                    type="checkbox"
                    id="mfaRequired"
                    checked={localSettings.mfaRequired ?? false}
                    onChange={e => update('mfaRequired', e.target.checked)}
                    disabled={!canEdit}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                  />
                  <label htmlFor="mfaRequired" className="text-[12px] text-slate-600 cursor-pointer">
                    <span className="font-bold text-slate-800 block">Enforce Multi-Factor (MFA)</span>
                    Force all users to complete TOTP / MFA verification to log in.
                  </label>
                </div>
              </div>

              {/* Audit logs viewer */}
              <div className="md:col-span-2 space-y-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[13px] text-slate-900">Enterprise Audit Trails</h4>
                      <p className="text-[11px] text-slate-500">Immutable chronicles of recent configurations & database actions.</p>
                    </div>
                    <button 
                      onClick={fetchAuditLogs}
                      className="p-2 border rounded-lg bg-white text-slate-500 hover:text-slate-800 transition-colors"
                      title="Refresh logs"
                    >
                      <RefreshCw size={14} className={loadingAudit ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div className="overflow-x-auto text-[11px]">
                    {loadingAudit ? (
                      <div className="p-10 text-center text-slate-400 font-medium">Loading audit logs...</div>
                    ) : auditLogs.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 font-medium">No audit logs recorded for this company yet.</div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 uppercase font-bold border-b border-slate-200">
                            <th className="px-4 py-2.5">Date & Time</th>
                            <th className="px-4 py-2.5">User</th>
                            <th className="px-4 py-2.5 text-center">Action</th>
                            <th className="px-4 py-2.5">Target</th>
                            <th className="px-4 py-2.5">IP & Browser</th>
                            <th className="px-4 py-2.5 text-center">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {auditLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {log.user_name || log.user_email || `User #${log.user_id}`}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  log.action === 'UPDATE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  log.action === 'IMPORT' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                  'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-500">{log.entity_type}</td>
                              <td className="px-4 py-3 truncate max-w-[150px]">
                                <span className="block text-slate-700">{log.ip_address}</span>
                                <span className="block text-[10px] text-slate-400 truncate">{log.user_agent}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {(log.before_state || log.after_state) ? (
                                  <button
                                    onClick={() => setSelectedLog(log)}
                                    className="p-1 border rounded bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                                    title="View Diff Data"
                                  >
                                    <Eye size={12} />
                                  </button>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-[18px] font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Bell size={20} className="text-emerald-500" /> Notification Preferences
            </h2>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Choose how you want to be notified about transaction approvals, period locks, permission overrides, and system events.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div>
                  <span className="block text-[13px] font-bold text-slate-800">In-App Notifications</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Show notifications inside the ERP bell icon dropdown and alerts.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.in_app_enabled}
                  onChange={e => setNotifPreferences(s => ({ ...s, in_app_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
              </div>

              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div>
                  <span className="block text-[13px] font-bold text-slate-800">Email Notifications</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Receive summary or instant emails for events.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.email_enabled}
                  onChange={e => setNotifPreferences(s => ({ ...s, email_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
              </div>

              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div>
                  <span className="block text-[13px] font-bold text-slate-800">Critical Alerts Only</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Filter out low/medium priority events. Only show/email CRITICAL and HIGH priority alerts.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.critical_only}
                  onChange={e => setNotifPreferences(s => ({ ...s, critical_only: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Settings size={18} className="text-white fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Settings & Preferences</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">System Wide</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
              Manage configuration for {activeCompany?.name || 'your workspace'}. Role: {effectiveRole} ({canEdit ? 'Editable' : 'Read-only'})
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 md:mt-0 flex-wrap">
          <button onClick={saveSettings} disabled={!canSave} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] disabled:opacity-50 text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar Nav */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMessage(null);
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-[13px] font-bold transition-all border-l-4 ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                      : 'border-transparent text-slate-600 hover:bg-slate-50/50 hover:text-slate-900'
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

      {/* Audit Logs State Diff Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[14px] text-slate-950">Audit Log Diffs</h3>
                  <p className="text-[11px] text-slate-500">Compare values before and after this configuration change.</p>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-slate-600 text-[12px] font-bold border px-3 py-1 bg-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Before State</span>
                    <pre className="p-3 bg-red-50 border border-red-200 text-red-800 text-[11px] rounded-lg overflow-x-auto font-mono max-h-[40vh]">
                      {JSON.stringify(selectedLog.before_state, null, 2) || '{}'}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">After State</span>
                    <pre className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-lg overflow-x-auto font-mono max-h-[40vh]">
                      {JSON.stringify(selectedLog.after_state, null, 2) || '{}'}
                    </pre>
                  </div>
                </div>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
