import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, Building2, Calendar, Check, CheckCircle2,
  Crown, Database, FileDown, FileUp, Info, KeyRound, Lock, LogOut,
  RefreshCw, Save, Search, ShieldCheck, Trash2, Unlock, UserPlus, Users, X
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { useSearchParams } from 'react-router-dom';
import WorkspaceLayout from '../../components/layout/WorkspaceLayout';

const ROLE_NOTES = {
  Admin: 'Full control over users, settings, roles, and company data.',
  Accountant: 'Can manage accounting, vouchers, ledger, reports, and financial settings.',
  'Inventory Manager': 'Can manage stock, warehouses, inventory movement, and products.',
  'Sales Manager': 'Can manage clients, sales invoices, and customer analytics.',
  'Finance Manager': 'Access to analytics, financial monitoring, and reporting.',
  Viewer: 'Read-only access to dashboards, accounts, and reports.',
};

const roleTone = {
  Admin: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Accountant: 'bg-blue-50 text-blue-700 border-blue-100',
  'Inventory Manager': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  'Sales Manager': 'bg-violet-50 text-violet-700 border-violet-100',
  'Finance Manager': 'bg-amber-50 text-amber-700 border-amber-100',
  Viewer: 'bg-slate-50 text-slate-600 border-slate-200',
};

// QuickBooks-style Role Permissions Matrix mapping
// F = Full Access, R = Read Only, N = No Access
const PERMISSION_ROWS = [
  {
    group: 'Transaction Processing',
    items: [
      { name: 'View Vouchers', code: 'voucher.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'F', 'Sales Manager': 'F', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Create Vouchers', code: 'voucher.create', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'F', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Edit/Delete Vouchers', code: 'voucher.edit', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Approve Vouchers', code: 'voucher.approve', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Post Vouchers to GL', code: 'voucher.post', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } }
    ]
  },
  {
    group: 'General Ledger & Manual Journals',
    items: [
      { name: 'View Journals', code: 'journal.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Create Manual Journals', code: 'journal.create', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Post Journals', code: 'journal.post', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'View General Ledger', code: 'ledger.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } }
    ]
  },
  {
    group: 'Operations & Stock Controls',
    items: [
      { name: 'Manage CRM Customers', code: 'client.manage', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'F', 'Finance Manager': 'N', Viewer: 'R' } },
      { name: 'Manage CRM Vendors', code: 'vendor.manage', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'R' } },
      { name: 'View Inventory Stock', code: 'inventory.view', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'F' } },
      { name: 'Manage Products', code: 'product.manage', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Manage Warehouses', code: 'warehouse.manage', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } }
    ]
  },
  {
    group: 'System Admin & Reports',
    items: [
      { name: 'Manage Settings', code: 'settings.manage', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Manage Users & Access', code: 'user.manage', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'View Financial Reports', code: 'report.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'F', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'View Analytics Dashboards', code: 'analytics.view', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'F', 'Finance Manager': 'F', Viewer: 'F' } }
    ]
  },
  {
    group: 'Fiscal Periods & Audits',
    items: [
      { name: 'View Fiscal Periods', code: 'period.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Manage & Lock Periods', code: 'period.manage', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'View Pending Approvals', code: 'approval.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'F', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Approve Transactions', code: 'approval.manage', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'View Audit Logs', code: 'audit.view', rights: { Admin: 'F', Accountant: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Database Maintenance & Backups', code: 'audit.manage', rights: { Admin: 'F', Accountant: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } }
    ]
  },
  {
    group: 'Payroll & HR Management',
    items: [
      { name: 'View Payroll Register', code: 'payroll.view', rights: { Admin: 'F', Accountant: 'F', Manager: 'F', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Generate Payroll Runs', code: 'payroll.run', rights: { Admin: 'F', Accountant: 'N', Manager: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Manage Salary Structures', code: 'payroll.manage', rights: { Admin: 'F', Accountant: 'N', Manager: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } }
    ]
  },
  {
    group: 'Fixed Asset Management',
    items: [
      { name: 'View Asset Register', code: 'asset.view', rights: { Admin: 'F', Accountant: 'F', Manager: 'F', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Manage Categories & Assets', code: 'asset.manage', rights: { Admin: 'F', Accountant: 'N', Manager: 'N', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } },
      { name: 'Run Asset Depreciation', code: 'asset.depreciate', rights: { Admin: 'F', Accountant: 'F', Manager: 'N', 'Inventory Manager': 'N', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } }
    ]
  },
  {
    group: 'Logistics & Distribution',
    items: [
      { name: 'View Delivery Routing', code: 'distribution.view', rights: { Admin: 'F', Accountant: 'F', Manager: 'F', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'F', Viewer: 'F' } },
      { name: 'Manage Routes & Dispatch', code: 'distribution.manage', rights: { Admin: 'F', Accountant: 'N', Manager: 'N', 'Inventory Manager': 'F', 'Sales Manager': 'N', 'Finance Manager': 'N', Viewer: 'N' } }
    ]
  }
];

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md border text-[11px] font-bold ${roleTone[role] || roleTone.Viewer}`}>
      {role || 'Viewer'}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

function formatUserAgent(ua) {
  if (!ua) return 'Unknown Client';
  if (ua.includes('Windows')) {
    if (ua.includes('Chrome')) return 'Chrome on Windows';
    if (ua.includes('Firefox')) return 'Firefox on Windows';
    if (ua.includes('Edg')) return 'Edge on Windows';
    return 'Windows PC';
  }
  if (ua.includes('Macintosh')) {
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari on macOS';
    if (ua.includes('Chrome')) return 'Chrome on macOS';
    return 'macOS Device';
  }
  if (ua.includes('Android')) return 'Android App';
  if (ua.includes('iPhone')) return 'iPhone App';
  return ua.split(' ')[0] || 'Web Browser';
}

export default function AdminPage() {
  const { activeCompany, user, fetchUserCompanies } = useAuthStore();
  const activeCompanyId = activeCompany?.id;
  const activeCompanyName = activeCompany?.name || '';
  const effectiveRole = activeCompany?.user_role || user?.role || 'Member';
  const adminRoles = ['Company Admin', 'Super Admin', 'Admin', 'Owner', 'CEO'];
  const canAdmin = adminRoles.includes(effectiveRole) || adminRoles.includes(user?.role);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'users');

  useEffect(() => {
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const [members, setMembers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState(Object.keys(ROLE_NOTES));
  const [periods, setPeriods] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all'); // 'all', 'active', 'terminated'

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Users Tab forms
  const [invite, setInvite] = useState({ name: '', email: '', password: '', role: 'Viewer' });
  const [companyName, setCompanyName] = useState('');
  const [rename, setRename] = useState('');

  // Users Tab overrides states
  const [selectedOverrideUser, setSelectedOverrideUser] = useState(null);
  const [userPermissionDetails, setUserPermissionDetails] = useState(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [localOverrides, setLocalOverrides] = useState({});

  // Backup form
  const [backupType, setBackupType] = useState('full');

  // Restore form
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');

  // Purge form
  const [purgePassword, setPurgePassword] = useState('');
  const [purgeConfirmName, setPurgeConfirmName] = useState('');
  const [purgeSlider, setPurgeSlider] = useState(false);

  const requestConfig = useMemo(
    () => activeCompanyId ? { headers: { 'x-company-id': String(activeCompanyId) } } : undefined,
    [activeCompanyId]
  );

  const loadData = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      // Fetch users, roles, workspaces
      const resOverview = await api.get(`/admin/overview?companyId=${activeCompanyId}`, requestConfig);
      setMembers(resOverview.data.members || []);
      setCompanies(resOverview.data.companies || []);
      setRoles(resOverview.data.roles || Object.keys(ROLE_NOTES));
      setRename(activeCompanyName);

      // Fetch fiscal periods
      const resPeriods = await api.get(`/periods/${activeCompanyId}`, requestConfig);
      setPeriods(resPeriods.data || []);

      // Fetch active sessions
      const resSessions = await api.get(`/admin/companies/${activeCompanyId}/sessions`, requestConfig);
      setSessions(resSessions.data || []);
    } catch (err) {
      const text = err.response?.status === 403
        ? 'Admin access required. Only Company Admins can manage workspace controls.'
        : err.response?.data?.message || 'Failed to load administration workspace details.';
      setMessage({ type: 'error', text });
    }
    setLoading(false);
  }, [activeCompanyId, activeCompanyName, requestConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab switching loads updated logs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    loadData();
  };

  // --- MEMBER MANAGEMENT ---
  const addMember = async (e) => {
    e.preventDefault();
    if (!canAdmin || !activeCompanyId) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.post(`/admin/companies/${activeCompanyId}/members`, invite, requestConfig);
      setInvite({ name: '', email: '', password: '', role: 'Viewer' });
      setMessage({ type: 'success', text: 'Team member added and workspace role mapped.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add user.' });
    }
    setSaving(false);
  };

  const updateRole = async (member, role) => {
    if (!canAdmin || !activeCompanyId) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/admin/companies/${activeCompanyId}/members/${member.id}`, { role }, requestConfig);
      setMessage({ type: 'success', text: `${member.name || member.email} role updated to ${role}.` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update role.' });
    }
    setSaving(false);
  };

  const removeMember = async (member) => {
    if (!canAdmin || !activeCompanyId) return;
    if (!window.confirm(`Remove access for ${member.name || member.email} from this company?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.delete(`/admin/companies/${activeCompanyId}/members/${member.id}`, requestConfig);
      setMessage({ type: 'success', text: 'User access removed.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove user.' });
    }
    setSaving(false);
  };

  // --- COMPANY WORKSPACES ---
  const createCompany = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/admin/companies', { name: companyName.trim() }, requestConfig);
      setCompanyName('');
      await fetchUserCompanies();
      setMessage({ type: 'success', text: 'New company created and Chart of Accounts seeded.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create company.' });
    }
    setSaving(false);
  };

  const renameCompany = async () => {
    if (!canAdmin || !activeCompanyId || !rename.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/admin/companies/${activeCompanyId}`, { name: rename.trim() }, requestConfig);
      await fetchUserCompanies();
      setMessage({ type: 'success', text: 'Company name successfully updated.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to rename company.' });
    }
    setSaving(false);
  };

  // --- FISCAL PERIODS ---
  const handleTogglePeriod = async (periodId, currentStatus) => {
    if (!canAdmin) return;
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    setSaving(true);
    try {
      await api.patch(`/periods/${activeCompanyId}/${periodId}`, { status: nextStatus }, requestConfig);
      setMessage({ type: 'success', text: `Period status toggled to ${nextStatus}.` });
      // Reload periods
      const resPeriods = await api.get(`/periods/${activeCompanyId}`, requestConfig);
      setPeriods(resPeriods.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update period status.' });
    }
    setSaving(false);
  };

  const generateDefaultPeriods = async () => {
    if (!canAdmin) return;
    setSaving(true);
    setMessage(null);
    try {
      const currentYear = new Date().getFullYear();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      for (let m = 0; m < 12; m++) {
        const periodName = `${monthNames[m]} ${currentYear}`;
        const startDate = new Date(currentYear, m, 1).toISOString().split('T')[0];
        const endDate = new Date(currentYear, m + 1, 0).toISOString().split('T')[0];

        await api.post(`/periods/${activeCompanyId}`, {
          periodName,
          startDate,
          endDate,
          status: 'OPEN'
        }, requestConfig);
      }
      setMessage({ type: 'success', text: `Successfully generated 12 monthly periods for ${currentYear}.` });
      const resPeriods = await api.get(`/periods/${activeCompanyId}`, requestConfig);
      setPeriods(resPeriods.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to seed default fiscal periods.' });
    }
    setSaving(false);
  };

  // --- BACKUP UTILITY ---
  const downloadBackup = async () => {
    try {
      setMessage(null);
      const res = await api.get(`/admin/companies/${activeCompanyId}/backup?type=${backupType}&format=xlsx`, {
        ...requestConfig,
        responseType: 'blob'
      });

      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SARFIS_${backupType.toUpperCase()}_Backup_${activeCompanyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: `Downloaded ${backupType.toUpperCase()} company backup successfully.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Backup extraction failed.' });
    }
  };

  // --- RESTORE UTILITY ---
  const handleBackupUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setMessage(null);

    if (file.name.endsWith('.xlsx')) {
      setSaving(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post(`/admin/companies/${activeCompanyId}/backup/parse`, formData, {
          headers: {
            ...requestConfig?.headers,
            'Content-Type': 'multipart/form-data'
          }
        });

        const parsed = response.data;
        const stats = {
          accounts: parsed.data.accounts?.length || 0,
          journalEntries: parsed.data.journal_entries?.length || 0,
          vouchers: parsed.data.vouchers?.length || 0,
          products: parsed.data.products?.length || 0,
          clients: parsed.data.clients?.length || 0,
          vendors: parsed.data.vendors?.length || 0,
        };

        setRestorePreview({
          backupType: parsed.backupType,
          originalCompany: parsed.companyName,
          timestamp: parsed.timestamp,
          stats,
          rawPayload: parsed
        });
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to parse Excel backup file.' });
        setRestorePreview(null);
      }
      setSaving(false);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed.data || !parsed.backupType) {
            setMessage({ type: 'error', text: 'Invalid file format. Please upload a valid SARFIS backup file.' });
            setRestorePreview(null);
            return;
          }

          const stats = {
            accounts: parsed.data.accounts?.length || 0,
            journalEntries: parsed.data.journal_entries?.length || 0,
            vouchers: parsed.data.vouchers?.length || 0,
            products: parsed.data.products?.length || 0,
            clients: parsed.data.clients?.length || 0,
            vendors: parsed.data.vendors?.length || 0,
          };

          setRestorePreview({
            backupType: parsed.backupType,
            originalCompany: parsed.companyName,
            timestamp: parsed.timestamp,
            stats,
            rawPayload: parsed
          });
        } catch (err) {
          setMessage({ type: 'error', text: 'Failed to parse backup JSON file.' });
          setRestorePreview(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const executeRestore = async () => {
    if (!canAdmin || !restorePreview) return;
    if (restoreConfirmInput !== 'RESTORE') {
      setMessage({ type: 'error', text: 'Confirmation text mismatch. Please type "RESTORE" to apply.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      // 1. Automatically extract rollback restore point backup for the client first
      const rollbackRes = await api.get(`/admin/companies/${activeCompanyId}/backup?type=full`, requestConfig);
      const rollbackBlob = new Blob([JSON.stringify(rollbackRes.data, null, 2)], { type: 'application/json' });
      const rollbackUrl = URL.createObjectURL(rollbackBlob);
      const rollbackLink = document.createElement('a');
      rollbackLink.href = rollbackUrl;
      rollbackLink.download = `ROLLBACK_RESTORE_POINT_${activeCompanyName.replace(/\s+/g, '_')}_${Date.now()}.json`;
      document.body.appendChild(rollbackLink);
      rollbackLink.click();
      document.body.removeChild(rollbackLink);

      // 2. Perform the database restore
      await api.post(`/admin/companies/${activeCompanyId}/restore`, {
        backupType: restorePreview.backupType,
        data: restorePreview.rawPayload.data
      }, requestConfig);

      setMessage({ type: 'success', text: 'Company state successfully restored. Rollback point downloaded.' });
      setRestoreFile(null);
      setRestorePreview(null);
      setRestoreConfirmInput('');
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Restore procedure failed.' });
    }
    setSaving(false);
  };

  // --- PURGE LEDGER UTILITY ---
  const executePurge = async () => {
    if (!canAdmin) return;
    if (!purgePassword || purgeConfirmName.trim() !== activeCompanyName) {
      setMessage({ type: 'error', text: 'Details validation failed. Please check password and company name.' });
      return;
    }
    if (!purgeSlider) {
      setMessage({ type: 'error', text: 'Please slide the safety switch to unlock purge execution.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.post(`/admin/companies/${activeCompanyId}/purge`, {
        password: purgePassword,
        companyName: purgeConfirmName.trim()
      }, requestConfig);

      setMessage({ type: 'success', text: 'All transaction histories successfully purged. Accounts preserved.' });
      setPurgePassword('');
      setPurgeConfirmName('');
      setPurgeSlider(false);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Purge request rejected.' });
    }
    setSaving(false);
  };

  // --- SESSION TERMINATION ---
  const terminateSession = async (sessionId) => {
    if (!canAdmin) return;
    setSaving(true);
    try {
      await api.post(`/admin/companies/${activeCompanyId}/sessions/${sessionId}/terminate`, {}, requestConfig);
      setMessage({ type: 'success', text: 'User session terminated successfully.' });
      const resSessions = await api.get(`/admin/companies/${activeCompanyId}/sessions`, requestConfig);
      setSessions(resSessions.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to terminate session.' });
    }
    setSaving(false);
  };

  const terminateOtherSessions = async () => {
    if (!canAdmin) return;
    if (!window.confirm("Are you sure you want to terminate all other active user sessions? Users will be signed out immediately.")) {
      return;
    }
    setSaving(true);
    try {
      await api.post(`/admin/companies/${activeCompanyId}/sessions/terminate-others`, {}, requestConfig);
      setMessage({ type: 'success', text: 'All other active sessions terminated.' });
      const resSessions = await api.get(`/admin/companies/${activeCompanyId}/sessions`, requestConfig);
      setSessions(resSessions.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to terminate other sessions.' });
    }
    setSaving(false);
  };

  const openUserOverrides = async (member) => {
    setSelectedOverrideUser(member);
    setOverrideModalOpen(true);
    setSaving(true);
    try {
      const res = await api.get(`/admin/companies/${activeCompanyId}/members/${member.id}/permissions`, requestConfig);
      setUserPermissionDetails(res.data);

      const initial = {};
      for (const o of res.data.overrides) {
        initial[o.permissionId] = {
          isAllowed: o.isAllowed,
          startDate: o.startDate || '',
          endDate: o.endDate || '',
          reason: o.reason || '',
          approvedByName: o.approvedByName || '',
          approvedByEmail: o.approvedByEmail || '',
          requestedBy: o.requestedBy || null,
          requestedByName: o.requestedByName || '',
          requestedByEmail: o.requestedByEmail || '',
          approvalStatus: o.approvalStatus || 'APPROVED',
          status: o.status || 'ACTIVE',
          isDeleted: false
        };
      }
      setLocalOverrides(initial);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load user permissions details.' });
    }
    setSaving(false);
  };

  const saveOverrides = async () => {
    if (!selectedOverrideUser) return;
    setSaving(true);
    setMessage(null);
    try {
      // Frontend validation for critical permission justification reason
      const criticalPermCodes = [
        'journal.post',
        'voucher.post',
        'settings.manage',
        'user.manage',
        'backup.restore',
        'ledger.purge',
        'period.lock',
        'role.manage',
        'permission.override'
      ];
      for (const permId of Object.keys(localOverrides)) {
        const ovr = localOverrides[permId];
        if (ovr && !ovr.isDeleted) {
          const dbPerm = userPermissionDetails?.allPermissions?.find(p => String(p.id) === String(permId));
          if (dbPerm && criticalPermCodes.includes(dbPerm.code)) {
            if (!ovr.reason || !ovr.reason.trim()) {
              setMessage({
                type: 'error',
                text: `A justification reason is required to override critical permission '${dbPerm.name}'.`
              });
              setSaving(false);
              return;
            }
          }
        }
      }

      const payload = Object.keys(localOverrides).map(permId => ({
        permissionId: parseInt(permId, 10),
        ...localOverrides[permId]
      }));

      await api.post(`/admin/companies/${activeCompanyId}/members/${selectedOverrideUser.id}/permissions`, {
        overrides: payload
      }, requestConfig);

      setMessage({ type: 'success', text: `Permission overrides for ${selectedOverrideUser.name} updated successfully.` });
      setOverrideModalOpen(false);
      setSelectedOverrideUser(null);
      setUserPermissionDetails(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save permission overrides.' });
    }
    setSaving(false);
  };

  const loadUserOverridesForMatrix = async (member) => {
    setSelectedOverrideUser(member);
    setSaving(true);
    try {
      const res = await api.get(`/admin/companies/${activeCompanyId}/members/${member.id}/permissions`, requestConfig);
      setUserPermissionDetails(res.data);

      const initial = {};
      for (const o of res.data.overrides) {
        initial[o.permissionId] = {
          isAllowed: o.isAllowed,
          startDate: o.startDate || '',
          endDate: o.endDate || '',
          reason: o.reason || '',
          approvedByName: o.approvedByName || '',
          approvedByEmail: o.approvedByEmail || '',
          requestedBy: o.requestedBy || null,
          requestedByName: o.requestedByName || '',
          requestedByEmail: o.requestedByEmail || '',
          approvalStatus: o.approvalStatus || 'APPROVED',
          status: o.status || 'ACTIVE',
          isDeleted: false
        };
      }
      setLocalOverrides(initial);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load user permissions details.' });
    }
    setSaving(false);
  };

  const saveOverridesInline = async () => {
    if (!selectedOverrideUser) return;
    setSaving(true);
    setMessage(null);
    try {
      // Frontend validation for critical permission justification reason
      const criticalPermCodes = [
        'journal.post',
        'voucher.post',
        'settings.manage',
        'user.manage',
        'backup.restore',
        'ledger.purge',
        'period.lock',
        'role.manage',
        'permission.override'
      ];
      for (const permId of Object.keys(localOverrides)) {
        const ovr = localOverrides[permId];
        if (ovr && !ovr.isDeleted) {
          const dbPerm = userPermissionDetails?.allPermissions?.find(p => String(p.id) === String(permId));
          if (dbPerm && criticalPermCodes.includes(dbPerm.code)) {
            if (!ovr.reason || !ovr.reason.trim()) {
              setMessage({
                type: 'error',
                text: `A justification reason is required to override critical permission '${dbPerm.name}'.`
              });
              setSaving(false);
              return;
            }
          }
        }
      }

      const payload = Object.keys(localOverrides).map(permId => ({
        permissionId: parseInt(permId, 10),
        ...localOverrides[permId]
      }));

      await api.post(`/admin/companies/${activeCompanyId}/members/${selectedOverrideUser.id}/permissions`, {
        overrides: payload
      }, requestConfig);

      setMessage({ type: 'success', text: `Permission overrides for ${selectedOverrideUser.name} updated successfully.` });
      const res = await api.get(`/admin/companies/${activeCompanyId}/members/${selectedOverrideUser.id}/permissions`, requestConfig);
      setUserPermissionDetails(res.data);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save permission overrides.' });
    }
    setSaving(false);
  };

  const approveOverride = async (userId, permissionId) => {
    setSaving(true);
    setMessage(null);
    try {
      await api.post(`/admin/companies/${activeCompanyId}/members/${userId}/permissions/${permissionId}/approve`, {}, requestConfig);
      setMessage({ type: 'success', text: 'Permission override approved successfully.' });

      const res = await api.get(`/admin/companies/${activeCompanyId}/members/${userId}/permissions`, requestConfig);
      setUserPermissionDetails(res.data);

      const initial = {};
      for (const o of res.data.overrides) {
        initial[o.permissionId] = {
          isAllowed: o.isAllowed,
          startDate: o.startDate || '',
          endDate: o.endDate || '',
          reason: o.reason || '',
          approvedByName: o.approvedByName || '',
          approvedByEmail: o.approvedByEmail || '',
          requestedBy: o.requestedBy || null,
          requestedByName: o.requestedByName || '',
          requestedByEmail: o.requestedByEmail || '',
          approvalStatus: o.approvalStatus || 'APPROVED',
          status: o.status || 'ACTIVE',
          isDeleted: false
        };
      }
      setLocalOverrides(initial);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to approve override.' });
    }
    setSaving(false);
  };

  return (
    <WorkspaceLayout
      title="Administration Workspace"
      subtitle={`Configure permissions, audit sessions, manage periods, and lock data for ${activeCompanyName || 'active company'}`}
      icon={ShieldCheck}
      badgeText="Admin"
      breadcrumbs={['SARFIS', 'Admin', 'Overview']}
      primaryAction={
        <button 
          onClick={loadData} 
          disabled={loading} 
          className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white px-5 py-2 text-[12.5px] font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-none outline-none"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Force Sync
        </button>
      }
    >
      <div className="col-span-full space-y-6">

      {/* Message Notifications */}
      {message && (
        <div className={`mb-5 rounded-lg border px-4 py-3 text-[13px] font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 mb-6 bg-white p-1 rounded-lg border">
        {[
          { id: 'users', label: 'Users & Teams', icon: Users },
          { id: 'permissions', label: 'Permissions Matrix', icon: ShieldCheck },
          { id: 'periods', label: 'Fiscal Periods', icon: Calendar },
          { id: 'data', label: 'Data Wizards', icon: Database },
          { id: 'sessions', label: 'Active Sessions', icon: Activity }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-all ${isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <TabIcon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tabs Panels Container */}
      <div className="space-y-6">
        {/* --- TAB 1: USERS & TEAMS --- */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 space-y-5">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <Users size={17} className="text-emerald-600" />
                    Company Users
                  </h2>
                  <span className="text-[11px] font-bold text-slate-400">{members.length} Active Members</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">User</th>
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Workspace Role</th>
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Access Overview</th>
                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-4">
                            <p className="text-[13px] font-bold text-slate-900">{member.name || 'Unnamed'}</p>
                            <p className="text-[11px] text-slate-500">{member.email}</p>
                          </td>
                          <td className="px-5 py-4">
                            {canAdmin ? (
                              <select
                                value={member.company_role}
                                onChange={(e) => updateRole(member, e.target.value)}
                                disabled={saving || member.id === user?.id}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : (
                              <RoleBadge role={member.company_role} />
                            )}
                          </td>
                          <td className="px-5 py-4 text-[12px] text-slate-500 max-w-[280px]">
                            {ROLE_NOTES[member.company_role] || 'Custom workspace role.'}
                          </td>
                          <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                            {member.global_role !== 'Super Admin' && canAdmin && (
                              <button
                                onClick={() => openUserOverrides(member)}
                                className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                                title="Manage Custom Permission Overrides"
                              >
                                Overrides
                              </button>
                            )}
                            <button
                              onClick={() => removeMember(member)}
                              disabled={!canAdmin || saving || member.user_id === user?.id}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                              title="Revoke access"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Role Library */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck size={17} className="text-emerald-600" />
                    Role Definitions Library
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
                  {roles.map((role) => (
                    <div key={role} className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                      <RoleBadge role={role} />
                      <p className="text-[12px] text-slate-500 mt-2.5 font-medium leading-relaxed">{ROLE_NOTES[role] || 'Built-in role configuration.'}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Sidebar form */}
            <div className="space-y-5">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <UserPlus size={17} className="text-emerald-600" />
                    Add Workspace Member
                  </h2>
                </div>
                <form onSubmit={addMember} className="p-5 space-y-4">
                  <Field label="Name">
                    <Input value={invite.name} onChange={(val) => setInvite((f) => ({ ...f, name: val }))} placeholder="Sana Malik" />
                  </Field>
                  <Field label="Email Address">
                    <Input type="email" value={invite.email} onChange={(val) => setInvite((f) => ({ ...f, email: val }))} placeholder="sana@company.com" />
                  </Field>
                  <Field label="Password Preset">
                    <Input type="password" value={invite.password} onChange={(val) => setInvite((f) => ({ ...f, password: val }))} placeholder="Defaults to ChangeMe123!" />
                  </Field>
                  <Field label="Initial Role">
                    <select
                      value={invite.role}
                      onChange={(e) => setInvite((f) => ({ ...f, role: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-emerald-500"
                    >
                      {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </Field>
                  <button
                    disabled={!canAdmin || saving || !invite.email}
                    className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <UserPlus size={15} /> Add User Access
                  </button>
                </form>
              </section>

              {/* Companies management */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <Building2 size={17} className="text-emerald-600" />
                    Company Workspaces
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <form onSubmit={createCompany} className="space-y-3">
                    <Field label="New Workspace Name">
                      <Input value={companyName} onChange={setCompanyName} placeholder="SARFIS Logistics" />
                    </Field>
                    <button
                      disabled={saving || !companyName.trim()}
                      className="w-full h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Create Workspace
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <Field label="Rename Workspace">
                      <Input value={rename} onChange={setRename} placeholder="Active company name" />
                    </Field>
                    <button
                      type="button"
                      onClick={renameCompany}
                      disabled={!canAdmin || saving || !rename.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Save size={15} /> Update Name
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Available Companies</p>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {companies.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-slate-800 truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-400">Company ID: {c.id}</p>
                          </div>
                          {c.owner_id === user?.id && <Crown size={14} className="text-amber-500 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* --- TAB 2: PERMISSIONS MATRIX --- */}
        {activeTab === 'permissions' && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  Permissions Matrix Settings
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">QuickBooks-style control matrix. Select a user to toggle custom overrides directly.</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Target User:</span>
                  <select
                    value={selectedOverrideUser?.id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedOverrideUser(null);
                        setUserPermissionDetails(null);
                        setLocalOverrides({});
                      } else {
                        const member = members.find(m => String(m.id) === String(val));
                        if (member) {
                          loadUserOverridesForMatrix(member);
                        }
                      }
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Role Defaults (View Only) --</option>
                    {members.filter(m => m.global_role !== 'Super Admin').map(m => (
                      <option key={m.id} value={m.id}>Customize: {m.name} ({m.company_role})</option>
                    ))}
                  </select>
                </div>

                {selectedOverrideUser && (
                  <button
                    onClick={saveOverridesInline}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold shadow-sm transition"
                  >
                    <Save size={14} /> Save Overrides
                  </button>
                )}

                <div className="flex gap-3 text-[11px] font-bold border-l border-slate-200 pl-4">
                  <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Full (F)</span>
                  <span className="flex items-center gap-1 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Read Only (R)</span>
                  <span className="flex items-center gap-1 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> No Access (N)</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-left">
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Module & Action</th>
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Permission Code</th>
                    {!selectedOverrideUser ? (
                      roles.map((role) => (
                        <th key={role} className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-center">{role}</th>
                      ))
                    ) : (
                      <>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-center">Role Default</th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-center">Override Matrix</th>
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Active Overrides Expiry Range</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_ROWS.map((group, gIdx) => (
                    <Fragment key={gIdx}>
                      {/* Section Row Header */}
                      <tr className="bg-slate-50/40">
                        <td colSpan={!selectedOverrideUser ? (2 + roles.length) : 5} className="px-5 py-2 text-[11px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50/30 border-y border-slate-100">
                          {group.group}
                        </td>
                      </tr>
                      {group.items.map((item, iIdx) => {
                        const dbPerm = userPermissionDetails?.allPermissions?.find(p => p.code === item.code);
                        const isDefaultAllowed = dbPerm ? userPermissionDetails.rolePermissionIds.includes(dbPerm.id) : false;
                        const activeOverride = dbPerm ? localOverrides[dbPerm.id] : null;

                        let status = 'default';
                        if (activeOverride && !activeOverride.isDeleted) {
                          status = activeOverride.isAllowed ? 'allow' : 'revoke';
                        }

                        const handleStatusChange = (newStatus) => {
                          if (!dbPerm) return;
                          setLocalOverrides(prev => {
                            const next = { ...prev };
                            if (newStatus === 'default') {
                              next[dbPerm.id] = { ...next[dbPerm.id], isDeleted: true };
                            } else {
                              next[dbPerm.id] = {
                                isAllowed: newStatus === 'allow',
                                startDate: next[dbPerm.id]?.startDate || '',
                                endDate: next[dbPerm.id]?.endDate || '',
                                isDeleted: false
                              };
                            }
                            return next;
                          });
                        };

                        const handleDateChange = (field, value) => {
                          if (!dbPerm) return;
                          setLocalOverrides(prev => {
                            const next = { ...prev };
                            next[dbPerm.id] = {
                              ...next[dbPerm.id],
                              [field]: value
                            };
                            return next;
                          });
                        };

                        return (
                          <tr key={iIdx} className="border-b border-slate-100 hover:bg-slate-50/60">
                            <td className="px-5 py-3.5 text-[13px] font-bold text-slate-800">{item.name}</td>
                            <td className="px-5 py-3.5 text-[11px] font-mono font-bold text-slate-400">{item.code}</td>
                            {!selectedOverrideUser ? (
                              roles.map((role) => {
                                const mappedRole = role === 'Company Admin' ? 'Admin' : role;
                                const right = item.rights[mappedRole] || 'N';
                                let badgeStyle = 'bg-slate-100 text-slate-400 border-slate-200';
                                if (right === 'F') badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold';
                                if (right === 'R') badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                                return (
                                  <td key={role} className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[11px] ${badgeStyle}`}>
                                      {right}
                                    </span>
                                  </td>
                                );
                              })
                            ) : (
                              <>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${isDefaultAllowed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {isDefaultAllowed ? 'Allowed' : 'Revoked'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-[11px] font-bold">
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange('default')}
                                          className={`px-2.5 py-1 rounded-md transition ${status === 'default' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                          Default
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange('allow')}
                                          className={`px-2.5 py-1 rounded-md transition ${status === 'allow' ? 'bg-emerald-600 text-white shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                          Allow
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange('revoke')}
                                          className={`px-2.5 py-1 rounded-md transition ${status === 'revoke' ? 'bg-red-600 text-white shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                          Revoke
                                        </button>
                                      </div>

                                      {status !== 'default' && activeOverride?.status && (
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${activeOverride.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            activeOverride.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-100' :
                                              activeOverride.status === 'REVOKED' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                activeOverride.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100 font-extrabold animate-pulse' :
                                                  'bg-slate-100 text-slate-500 border-slate-200'
                                          }`}>
                                          {activeOverride.status}
                                        </span>
                                      )}
                                    </div>

                                    {status !== 'default' && (
                                      <input
                                        type="text"
                                        placeholder="Justification reason..."
                                        value={activeOverride?.reason || ''}
                                        onChange={e => {
                                          if (!dbPerm) return;
                                          setLocalOverrides(prev => {
                                            const next = { ...prev };
                                            next[dbPerm.id] = {
                                              ...next[dbPerm.id],
                                              reason: e.target.value
                                            };
                                            return next;
                                          });
                                        }}
                                        className="w-full max-w-[220px] h-7 px-2 rounded border border-slate-200 text-[11px] outline-none focus:border-emerald-500 bg-white"
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  {status !== 'default' ? (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-3 text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-slate-400 font-bold text-[9px] uppercase">Start:</span>
                                          <input
                                            type="date"
                                            value={activeOverride?.startDate || ''}
                                            onChange={e => handleDateChange('startDate', e.target.value)}
                                            className="h-8 rounded border border-slate-200 px-2 outline-none focus:border-emerald-500 bg-white"
                                          />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-slate-400 font-bold text-[9px] uppercase">Expiry:</span>
                                          <input
                                            type="date"
                                            value={activeOverride?.endDate || ''}
                                            onChange={e => handleDateChange('endDate', e.target.value)}
                                            className="h-8 rounded border border-slate-200 px-2 outline-none focus:border-emerald-500 bg-white"
                                          />
                                        </div>
                                      </div>
                                      {activeOverride?.approvedByName && (
                                        <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                                          Approved by: <span className="text-slate-600 font-bold">{activeOverride.approvedByName}</span>
                                        </div>
                                      )}
                                      {activeOverride?.approvalStatus === 'PENDING' && (
                                        <div className="mt-1 flex items-center gap-1.5">
                                          {activeOverride.requestedBy === user?.id ? (
                                            <span className="text-[9px] text-amber-600 font-bold italic" title="You requested this override. Another administrator must approve it under the 4-Eyes policy.">
                                              Waiting for Approval (4-Eyes)
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => approveOverride(selectedOverrideUser.id, dbPerm.id)}
                                              className="px-2 py-0.5 rounded bg-amber-600 text-white font-extrabold text-[9px] hover:bg-amber-700 transition"
                                            >
                                              Approve Override
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic font-medium">Inherits default range</span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex items-start gap-2.5">
              <Info size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Roles are linked dynamically to standard FBR auditing compliance guidelines. Changing a team member's workspace role automatically maps their sidebar view access according to this permissions ledger matrix.
              </p>
            </div>
          </section>
        )}

        {/* --- TAB 3: FISCAL PERIODS --- */}
        {activeTab === 'periods' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <Calendar size={17} className="text-emerald-600" />
                    Accounting Periods Manager
                  </h2>
                  <span className="text-[11px] font-bold text-slate-400">{periods.length} Periods Defined</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Period Name</th>
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Start Date</th>
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">End Date</th>
                        <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Posting Status</th>
                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-[13px] font-bold">
                            No accounting periods seeded yet.
                          </td>
                        </tr>
                      ) : (
                        periods.map((p) => {
                          const isClosed = p.status === 'CLOSED';
                          return (
                            <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                              <td className="px-5 py-4 text-[13px] font-bold text-slate-900">{p.period_name}</td>
                              <td className="px-5 py-4 text-[12px] text-slate-500">{new Date(p.start_date).toLocaleDateString()}</td>
                              <td className="px-5 py-4 text-[12px] text-slate-500">{new Date(p.end_date).toLocaleDateString()}</td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isClosed ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                  {isClosed ? <Lock size={10} /> : <Unlock size={10} />}
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={() => handleTogglePeriod(p.id, p.status)}
                                  disabled={!canAdmin || saving}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-bold shadow-sm transition ${isClosed ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100'}`}
                                >
                                  {isClosed ? <Unlock size={11} /> : <Lock size={11} />}
                                  {isClosed ? 'Unlock Period' : 'Lock Period'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Quick Actions sidebar */}
            <div className="space-y-5">
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <Lock size={17} className="text-emerald-600" />
                    Period Lock Control
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    Locking an accounting period prevents any user (including accountants) from writing, modifying, or reversing ledger vouchers during that date range.
                  </p>
                  {periods.length === 0 && (
                    <button
                      onClick={generateDefaultPeriods}
                      disabled={!canAdmin || saving}
                      className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <RefreshCw size={15} /> Seed Standard 12 Months
                    </button>
                  )}
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 flex gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      Ensure all pending vouchers and tax adjustments are finalized before shutting down a period. Locked status is absolute.
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* --- TAB 4: DATA WIZARDS --- */}
        {activeTab === 'data' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Backup & Restore */}
            <div className="xl:col-span-2 space-y-5">
              {/* Backup card */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <FileDown size={18} className="text-emerald-600" />
                    Export Company Data Backup
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    Download a secure JSON extract of the company state. You can restore this file to return to the current point.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Backup Category">
                      <select
                        value={backupType}
                        onChange={(e) => setBackupType(e.target.value)}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-emerald-500"
                      >
                        <option value="full">Full Database Backup (Recommended)</option>
                        <option value="accounting">Accounting Ledger Only</option>
                        <option value="inventory">Inventory & Stock Logs Only</option>
                        <option value="settings">System Configurations Only</option>
                      </select>
                    </Field>
                    <div className="flex items-end">
                      <button
                        onClick={downloadBackup}
                        className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700"
                      >
                        <FileDown size={15} /> Download Backup file
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Restore card */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <FileUp size={18} className="text-emerald-600" />
                    Restore Company Backup
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    Upload a valid `.xlsx` or `.json` backup file to restore company state. Restore point will be downloaded automatically as safety rollback before apply.
                  </p>

                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50/30 hover:bg-slate-50 hover:border-emerald-400 transition relative">
                    <input
                      type="file"
                      accept=".json,.xlsx"
                      onChange={handleBackupUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileUp size={30} className="text-slate-400 mb-2" />
                    <p className="text-[12px] font-bold text-slate-700">
                      {restoreFile ? restoreFile.name : 'Click or Drag & Drop Backup Excel or JSON file'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Accepts valid SARFIS Excel (.xlsx) or JSON (.json) backup formats</p>
                  </div>

                  {restorePreview && (
                    <Motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                    >
                      <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <Info size={14} className="text-emerald-600" />
                        Backup Preview Details
                      </h3>
                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-[12px] font-medium text-slate-600">
                        <div><span className="font-bold text-slate-400">Type:</span> <span className="uppercase text-emerald-600 font-extrabold">{restorePreview.backupType}</span></div>
                        <div><span className="font-bold text-slate-400">Source Company:</span> <span className="text-slate-900 font-bold">{restorePreview.originalCompany}</span></div>
                        <div className="col-span-2"><span className="font-bold text-slate-400">Created:</span> <span className="text-slate-800">{new Date(restorePreview.timestamp).toLocaleString()}</span></div>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Record Count Statistics:</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded border bg-white p-2">
                            <div className="text-[14px] font-black text-slate-800">{restorePreview.stats.accounts}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase">Accounts</div>
                          </div>
                          <div className="rounded border bg-white p-2">
                            <div className="text-[14px] font-black text-slate-800">{restorePreview.stats.journalEntries}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase">Journals</div>
                          </div>
                          <div className="rounded border bg-white p-2">
                            <div className="text-[14px] font-black text-slate-800">{restorePreview.stats.vouchers}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase">Vouchers</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 space-y-3">
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex gap-2">
                          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-red-800 leading-relaxed font-bold">
                            Warning: Applying this backup will completely clear and replace all selected data tables. This cannot be undone.
                          </p>
                        </div>

                        <Field label='Type "RESTORE" to Confirm'>
                          <Input value={restoreConfirmInput} onChange={setRestoreConfirmInput} placeholder="Type RESTORE in uppercase" />
                        </Field>

                        <button
                          onClick={executeRestore}
                          disabled={saving || restoreConfirmInput !== 'RESTORE'}
                          className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 disabled:opacity-50"
                        >
                          <FileUp size={15} /> Confirm & Execute Restore
                        </button>
                      </div>
                    </Motion.div>
                  )}
                </div>
              </section>
            </div>

            {/* DANGER AREA: Purging */}
            <div className="space-y-5">
              <section className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-red-100 bg-red-50/50">
                  <h2 className="text-[15px] font-black text-red-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    Ledger Purge Utility
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    Permanently wipe all transactional logs (vouchers, stock movements, journal entries) and reset GL balances. Master definitions like accounts, products, and clients will remain intact.
                  </p>

                  <div className="rounded-lg bg-red-50/70 border border-red-100 p-3 space-y-2">
                    <h3 className="text-[11px] font-black text-red-900 uppercase">Actions Breakdown:</h3>
                    <ul className="text-[10px] text-red-800 list-disc pl-4 space-y-1 font-medium">
                      <li>Drop all Vouchers & Journal Entries</li>
                      <li>Drop all Inventory stock log entries</li>
                      <li>Reset customer/vendor unpaid balances to zero</li>
                      <li>Reset Chart of Accounts static cache to zero</li>
                    </ul>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Field label="Your Admin Password">
                      <Input type="password" value={purgePassword} onChange={setPurgePassword} placeholder="Enter your login password" />
                    </Field>
                    <Field label="Confirm Company Name">
                      <Input value={purgeConfirmName} onChange={setPurgeConfirmName} placeholder={activeCompanyName} />
                    </Field>

                    {/* Confirmation Slider */}
                    <div className="flex items-center justify-between border rounded-lg p-2.5 bg-slate-50">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Unlock Safety Switch</span>
                      <button
                        type="button"
                        onClick={() => setPurgeSlider(!purgeSlider)}
                        className={`w-12 h-6 rounded-full transition relative border ${purgeSlider ? 'bg-red-600 border-red-700' : 'bg-slate-200 border-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition shadow-sm ${purgeSlider ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={executePurge}
                      disabled={saving || !purgeSlider || !purgePassword || purgeConfirmName !== activeCompanyName}
                      className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      <Trash2 size={15} /> Execute Dangerous Purge
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* --- TAB 5: ACTIVE SESSIONS --- */}
        {activeTab === 'sessions' && (() => {
          const filteredSessions = sessions.filter(s => {
            const nameMatch = s.name?.toLowerCase().includes(sessionSearch.toLowerCase());
            const emailMatch = s.email?.toLowerCase().includes(sessionSearch.toLowerCase());
            if (sessionSearch && !nameMatch && !emailMatch) return false;

            if (sessionFilter === 'active' && !s.is_active) return false;
            if (sessionFilter === 'terminated' && s.is_active) return false;

            return true;
          });

          return (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                    <Activity size={18} className="text-emerald-600" />
                    Active User Sessions Monitor
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">Track current logged-in connections and terminate active tokens instantly.</p>
                </div>
                <button
                  onClick={loadData}
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:bg-slate-50 bg-white shadow-sm transition"
                  title="Refresh sessions list"
                >
                  <RefreshCw size={14} className="text-slate-500" />
                </button>
              </div>

              {/* Filters toolbar */}
              <div className="p-4 bg-slate-50/20 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                  />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <select
                    value={sessionFilter}
                    onChange={(e) => setSessionFilter(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="terminated">Terminated Only</option>
                  </select>

                  <button
                    onClick={terminateOtherSessions}
                    disabled={!canAdmin || saving || sessions.filter(s => !s.is_current && s.is_active).length === 0}
                    className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-extrabold transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:hover:bg-red-600"
                  >
                    <LogOut size={13} />
                    Terminate Others
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">User Details</th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">IP Address</th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Client / Browser OS</th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Login Timestamp</th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Last Activity</th>
                      <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Status</th>
                      <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-[13px] font-medium">
                          No matching user sessions found.
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map((s) => {
                        const isActiveSession = s.is_active;
                        return (
                          <tr key={s.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition ${s.is_current ? 'bg-emerald-50/20' : ''}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-bold text-slate-900">{s.name}</p>
                                {s.is_current && (
                                  <span className="inline-flex items-center px-1.5 py-0.25 rounded text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium">{s.email}</p>
                            </td>
                            <td className="px-5 py-4 text-[12px] font-mono text-slate-600">{s.ip_address || '127.0.0.1'}</td>
                            <td className="px-5 py-4 text-[12px] text-slate-600 font-semibold">{formatUserAgent(s.device)}</td>
                            <td className="px-5 py-4 text-[12px] text-slate-500">{new Date(s.login_time).toLocaleString()}</td>
                            <td className="px-5 py-4 text-[12px] text-slate-500">{new Date(s.last_activity).toLocaleString()}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isActiveSession ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isActiveSession ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                {isActiveSession ? 'Active' : 'Terminated'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              {s.is_current ? (
                                <span className="text-[11px] text-slate-400 font-bold italic px-3 py-1.5">
                                  Current Session
                                </span>
                              ) : (
                                <button
                                  onClick={() => terminateSession(s.id)}
                                  disabled={!canAdmin || saving || !isActiveSession}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-30 transition"
                                >
                                  <X size={12} /> Force Kill
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex items-start gap-2.5">
                <KeyRound size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Active sessions track signed tokens on a rolling database checklist. Terminating a connection sets the row status to inactive, prompting immediate session expiration and redirecting the user back to the login gateway on their next request.
                </p>
              </div>
            </section>
          );
        })()}
      </div>

      {/* User Overrides Modal */}
      <AnimatePresence>
        {overrideModalOpen && selectedOverrideUser && userPermissionDetails && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-[15px] text-slate-900 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    Permission Overrides Matrix
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Customize access rights for <span className="font-bold text-slate-800">{selectedOverrideUser.name}</span> ({selectedOverrideUser.email}).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setOverrideModalOpen(false);
                    setSelectedOverrideUser(null);
                    setUserPermissionDetails(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Scrollable Matrix Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4 border border-slate-100 rounded-lg p-4 bg-slate-50/50 text-[12px]">
                  <div>
                    <span className="text-slate-400 font-bold block">User Role:</span>
                    <span className="font-black text-slate-800 uppercase mt-0.5 block">{userPermissionDetails.role}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 font-bold block">System Overrides Logic:</span>
                    <span className="text-slate-500 font-medium leading-relaxed block mt-0.5">
                      Explicit grants/revocations will override role defaults. Range limits will restrict active duration.
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {PERMISSION_ROWS.map((group, gIdx) => (
                    <div key={gIdx} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-black uppercase tracking-widest text-emerald-700">
                        {group.group}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.items.map((item, iIdx) => {
                          const dbPerm = userPermissionDetails.allPermissions.find(p => p.code === item.code);
                          if (!dbPerm) return null;

                          const isDefaultAllowed = userPermissionDetails.rolePermissionIds.includes(dbPerm.id);
                          const activeOverride = localOverrides[dbPerm.id];

                          let status = 'default';
                          if (activeOverride && !activeOverride.isDeleted) {
                            status = activeOverride.isAllowed ? 'allow' : 'revoke';
                          }

                          const handleStatusChange = (newStatus) => {
                            setLocalOverrides(prev => {
                              const next = { ...prev };
                              if (newStatus === 'default') {
                                next[dbPerm.id] = { ...next[dbPerm.id], isDeleted: true };
                              } else {
                                next[dbPerm.id] = {
                                  isAllowed: newStatus === 'allow',
                                  startDate: next[dbPerm.id]?.startDate || '',
                                  endDate: next[dbPerm.id]?.endDate || '',
                                  reason: next[dbPerm.id]?.reason || '',
                                  isDeleted: false
                                };
                              }
                              return next;
                            });
                          };

                          const handleDateChange = (field, value) => {
                            setLocalOverrides(prev => {
                              const next = { ...prev };
                              next[dbPerm.id] = {
                                ...next[dbPerm.id],
                                [field]: value
                              };
                              return next;
                            });
                          };

                          return (
                            <div key={iIdx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/30">
                              <div className="min-w-[220px]">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-bold text-slate-800">{item.name}</p>
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${isDefaultAllowed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    Role: {isDefaultAllowed ? 'Allow' : 'Revoke'}
                                  </span>
                                </div>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{item.code}</p>
                              </div>

                              <div className="flex flex-col gap-1.5 shrink-0">
                                <div className="flex items-center gap-2">
                                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-[11px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange('default')}
                                      className={`px-2.5 py-1 rounded-md transition ${status === 'default' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                      Role Default
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange('allow')}
                                      className={`px-2.5 py-1 rounded-md transition ${status === 'allow' ? 'bg-emerald-600 text-white shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                      Allow
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange('revoke')}
                                      className={`px-2.5 py-1 rounded-md transition ${status === 'revoke' ? 'bg-red-600 text-white shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                      Revoke
                                    </button>
                                  </div>

                                  {status !== 'default' && activeOverride?.status && (
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${activeOverride.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        activeOverride.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-100' :
                                          activeOverride.status === 'REVOKED' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            activeOverride.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100 font-extrabold animate-pulse' :
                                              'bg-slate-100 text-slate-500 border-slate-200'
                                      }`}>
                                      {activeOverride.status}
                                    </span>
                                  )}
                                </div>

                                {status !== 'default' && (
                                  <input
                                    type="text"
                                    placeholder="Justification reason..."
                                    value={activeOverride?.reason || ''}
                                    onChange={e => {
                                      setLocalOverrides(prev => {
                                        const next = { ...prev };
                                        next[dbPerm.id] = {
                                          ...next[dbPerm.id],
                                          reason: e.target.value
                                        };
                                        return next;
                                      });
                                    }}
                                    className="w-full max-w-[240px] h-7 px-2 rounded border border-slate-200 text-[11px] outline-none focus:border-emerald-500 bg-white"
                                  />
                                )}
                              </div>

                              <div className="min-w-[200px] flex justify-end">
                                {status !== 'default' ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <div>
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Start Date</span>
                                        <input
                                          type="date"
                                          value={activeOverride?.startDate || ''}
                                          onChange={e => handleDateChange('startDate', e.target.value)}
                                          className="h-8 rounded border border-slate-200 px-2 outline-none focus:border-emerald-500 bg-white text-[11px]"
                                        />
                                      </div>
                                      <div>
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Expiry Date</span>
                                        <input
                                          type="date"
                                          value={activeOverride?.endDate || ''}
                                          onChange={e => handleDateChange('endDate', e.target.value)}
                                          className="h-8 rounded border border-slate-200 px-2 outline-none focus:border-emerald-500 bg-white text-[11px]"
                                        />
                                      </div>
                                    </div>
                                    {activeOverride?.approvedByName && (
                                      <div className="text-[9px] text-slate-400 font-medium mt-1 text-right">
                                        Approved by: <span className="text-slate-600 font-bold">{activeOverride.approvedByName}</span>
                                      </div>
                                    )}
                                    {activeOverride?.approvalStatus === 'PENDING' && (
                                      <div className="mt-1 flex items-center justify-end gap-1.5">
                                        {activeOverride.requestedBy === user?.id ? (
                                          <span className="text-[9px] text-amber-600 font-bold italic" title="You requested this override. Another administrator must approve it under the 4-Eyes policy.">
                                            Waiting for Approval (4-Eyes)
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => approveOverride(selectedOverrideUser.id, dbPerm.id)}
                                            className="px-2 py-0.5 rounded bg-amber-600 text-white font-extrabold text-[9px] hover:bg-amber-700 transition"
                                          >
                                            Approve Override
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic font-medium">Inherits default range</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setOverrideModalOpen(false);
                    setSelectedOverrideUser(null);
                    setUserPermissionDetails(null);
                  }}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveOverrides}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-[13px] font-bold text-white transition shadow-sm"
                >
                  Save Overrides Matrix
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </WorkspaceLayout>
  );
}
