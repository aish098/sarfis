import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  AlertTriangle, Building2, CheckCircle2, Crown, RefreshCw,
  Save, ShieldCheck, Trash2, UserPlus, Users,
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const ROLE_NOTES = {
  'Company Admin': 'Full control over users, settings, roles, and company data.',
  Accountant: 'Can manage accounting, vouchers, ledger, reports, and financial settings.',
  Manager: 'Can approve and manage operational workflows.',
  'Inventory Manager': 'Can manage stock, warehouses, inventory movement, and products.',
  'Purchasing Agent': 'Can manage vendors and purchasing workflows.',
  Viewer: 'Read-only access to dashboards and reports.',
};

const roleTone = {
  'Company Admin': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Accountant: 'bg-blue-50 text-blue-700 border-blue-100',
  Manager: 'bg-violet-50 text-violet-700 border-violet-100',
  'Inventory Manager': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  'Purchasing Agent': 'bg-amber-50 text-amber-700 border-amber-100',
  Viewer: 'bg-slate-50 text-slate-600 border-slate-200',
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md border text-[11px] font-bold ${roleTone[role] || roleTone.Viewer}`}>
      {role || 'Viewer'}
    </span>
  );
}

function AdminCard({ title, subtitle, icon, children, action }) {
  const CardIcon = icon;
  return (
    <Motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CardIcon size={17} />
          </div>
          <div>
            <h2 className="text-[15px] font-black text-slate-900">{title}</h2>
            {subtitle && <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Motion.section>
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

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
    />
  );
}

export default function AdminPage() {
  const { activeCompany, user, fetchUserCompanies } = useAuthStore();
  const activeCompanyId = activeCompany?.id;
  const activeCompanyName = activeCompany?.name || '';
  const effectiveRole = activeCompany?.user_role || user?.role || 'Member';
  const adminRoles = ['Company Admin', 'Super Admin', 'Admin', 'Owner', 'CEO'];
  const canAdmin = adminRoles.includes(effectiveRole) || adminRoles.includes(user?.role);
  const [members, setMembers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState(Object.keys(ROLE_NOTES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [invite, setInvite] = useState({ name: '', email: '', password: '', role: 'Viewer' });
  const [companyName, setCompanyName] = useState('');
  const [rename, setRename] = useState('');

  const requestConfig = useMemo(
    () => activeCompanyId ? { headers: { 'x-company-id': String(activeCompanyId) } } : undefined,
    [activeCompanyId]
  );

  const load = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get(`/admin/overview?companyId=${activeCompanyId}`, requestConfig);
      setMembers(res.data.members || []);
      setCompanies(res.data.companies || []);
      setRoles(res.data.roles || Object.keys(ROLE_NOTES));
      setRename(activeCompanyName);
    } catch (err) {
      const text = err.response?.status === 403
        ? 'Admin access required. Only Company Admins can manage users and company roles.'
        : err.response?.data?.message || 'Failed to load admin data.';
      setMessage({ type: 'error', text });
    }
    setLoading(false);
  }, [activeCompanyId, activeCompanyName, requestConfig]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const addMember = async (e) => {
    e.preventDefault();
    if (!canAdmin || !activeCompanyId) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.post(`/admin/companies/${activeCompanyId}/members`, invite, requestConfig);
      setInvite({ name: '', email: '', password: '', role: 'Viewer' });
      setMessage({ type: 'success', text: 'User access updated.' });
      await load();
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
      setMessage({ type: 'success', text: `${member.name || member.email} is now ${role}.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update role.' });
    }
    setSaving(false);
  };

  const removeMember = async (member) => {
    if (!canAdmin || !activeCompanyId) return;
    if (!window.confirm(`Remove ${member.name || member.email} from this company?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.delete(`/admin/companies/${activeCompanyId}/members/${member.id}`, requestConfig);
      setMessage({ type: 'success', text: 'User access removed.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove user.' });
    }
    setSaving(false);
  };

  const createCompany = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/admin/companies', { name: companyName.trim() }, requestConfig);
      setCompanyName('');
      await fetchUserCompanies();
      setMessage({ type: 'success', text: 'Company created and chart of accounts seeded.' });
      await load();
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
      setMessage({ type: 'success', text: 'Company name updated.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update company.' });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-full p-5 lg:p-7 pb-16" style={{ background: '#faf9f8' }}>
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600 mb-1">Role Based Access</p>
          <h1 className="font-display text-[25px] font-black text-slate-900 leading-tight">Administration</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage users, company access, and operational roles for {activeCompany?.name || 'your workspace'}.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <RoleBadge role={effectiveRole} />
            <span className={`inline-flex px-2.5 py-1 rounded-md border text-[11px] font-bold ${canAdmin ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
              {canAdmin ? 'Admin tools enabled' : 'Read-only admin view'}
            </span>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-5 rounded-lg border px-4 py-3 text-[13px] font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {!canAdmin && (
        <div className="mb-5 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Your role is {effectiveRole}. Ask a Company Admin to change roles or add users.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <AdminCard
            title="Company Users"
            subtitle="Assign QuickBooks-style access levels by company"
            icon={Users}
            action={<span className="text-[11px] font-bold text-slate-400">{members.length} users</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">User</th>
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Role</th>
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Access Meaning</th>
                    <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-[13px]">Loading users...</td></tr>
                  ) : members.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-[13px]">No users found.</td></tr>
                  ) : members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="text-[13px] font-bold text-slate-900">{member.name || 'Unnamed user'}</p>
                        <p className="text-[11px] text-slate-500">{member.email}</p>
                      </td>
                      <td className="px-5 py-4 min-w-[190px]">
                        {canAdmin ? (
                          <select
                            value={member.company_role}
                            onChange={(e) => updateRole(member, e.target.value)}
                            disabled={saving || member.id === user?.id}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                        ) : (
                          <RoleBadge role={member.company_role} />
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12px] text-slate-500 max-w-[280px]">
                        {ROLE_NOTES[member.company_role] || 'Custom company access.'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => removeMember(member)}
                          disabled={!canAdmin || saving || member.id === user?.id}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                          title="Remove access"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>

          <AdminCard title="Role Library" subtitle="Access levels available in SARFIS" icon={ShieldCheck}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
              {roles.map((role) => (
                <div key={role} className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                  <RoleBadge role={role} />
                  <p className="text-[12px] text-slate-500 mt-3">{ROLE_NOTES[role] || 'Custom system access.'}</p>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>

        <div className="space-y-5">
          <AdminCard title="Add User" subtitle="Create or attach a user to this company" icon={UserPlus}>
            <form onSubmit={addMember} className="p-5 space-y-4">
              <Field label="Name">
                <Input value={invite.name} onChange={(value) => setInvite((f) => ({ ...f, name: value }))} placeholder="Ayesha Khan" />
              </Field>
              <Field label="Email">
                <Input type="email" value={invite.email} onChange={(value) => setInvite((f) => ({ ...f, email: value }))} placeholder="name@company.com" />
              </Field>
              <Field label="Temporary Password">
                <Input type="password" value={invite.password} onChange={(value) => setInvite((f) => ({ ...f, password: value }))} placeholder="Optional, defaults to ChangeMe123!" />
              </Field>
              <Field label="Role">
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
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={15} /> Add User
              </button>
            </form>
          </AdminCard>

          <AdminCard title="Companies" subtitle="Create or rename company workspaces" icon={Building2}>
            <div className="p-5 space-y-4">
              <form onSubmit={createCompany} className="space-y-3">
                <Field label="New Company">
                  <Input value={companyName} onChange={setCompanyName} placeholder="New workspace name" />
                </Field>
                <button
                  disabled={saving || !companyName.trim()}
                  className="w-full h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Create Company
                </button>
              </form>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <Field label="Rename Active Company">
                  <Input value={rename} onChange={setRename} placeholder="Company name" />
                </Field>
                <button
                  type="button"
                  onClick={renameCompany}
                  disabled={!canAdmin || saving || !rename.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save size={15} /> Rename
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Accessible Companies</p>
                <div className="space-y-2 max-h-[220px] overflow-y-auto hide-scrollbar">
                  {companies.map((company) => (
                    <div key={company.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 truncate">{company.name}</p>
                        <p className="text-[10px] text-slate-400">ID {company.id}</p>
                      </div>
                      {company.owner_id === user?.id && <Crown size={14} className="text-amber-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
