import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Ticket, Users, Activity, Lock, Unlock, Plus, RefreshCw,
  Search, Filter, CheckCircle2, XCircle, AlertTriangle, FileText, Key, Server, Cpu, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';

const SAAS_API_BASE = import.meta.env.PROD ? '/api/saas-control/api' : 'http://localhost:3000/api';

export default function SaaSAdminDashboard() {
  const [token, setToken] = useState(localStorage.getItem('saas_admin_token') || '');
  const [loginEmail, setLoginEmail] = useState('admin@saas.com');
  const [loginPassword, setLoginPassword] = useState('AdminPass123!');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, coupons, audit, health
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [healthInfo, setHealthInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 20,
    expiry_date: '2026-12-31T23:59:59',
    usage_limit: 100
  });

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Auto load data when token changes
  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token, activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.post(`${SAAS_API_BASE}/auth/login`, {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword
      });
      const { accessToken, mustChangePassword } = res.data.data;
      setToken(accessToken);
      localStorage.setItem('saas_admin_token', accessToken);
      setMustChangePassword(mustChangePassword);
      setSuccessMsg('Logged in successfully!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await axios.post(
        `${SAAS_API_BASE}/auth/change-initial-password`,
        { currentPassword: loginPassword, newPassword },
        getHeaders()
      );
      setSuccessMsg('Password updated successfully! Authenticating with new credentials...');
      setLoginPassword(newPassword);
      setMustChangePassword(false);

      // Auto-relogin with new password
      const reloginRes = await axios.post(`${SAAS_API_BASE}/auth/login`, {
        email: loginEmail,
        password: newPassword
      });
      const { accessToken } = reloginRes.data.data;
      setToken(accessToken);
      localStorage.setItem('saas_admin_token', accessToken);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Password change failed.');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'overview' || activeTab === 'users') {
        const statsRes = await axios.get(`${SAAS_API_BASE}/dashboard/stats`, getHeaders());
        setStats(statsRes.data.data);
      }
      if (activeTab === 'users') {
        const usersRes = await axios.get(`${SAAS_API_BASE}/users?limit=50`, getHeaders());
        setUsers(usersRes.data.data);
      }
      if (activeTab === 'coupons') {
        const couponsRes = await axios.get(`${SAAS_API_BASE}/coupons`, getHeaders());
        setCoupons(couponsRes.data.data);
      }
      if (activeTab === 'audit') {
        const auditRes = await axios.get(`${SAAS_API_BASE}/audit-logs?limit=50`, getHeaders());
        setAuditLogs(auditRes.data.data);
      }
      if (activeTab === 'health') {
        const healthRes = await axios.get(`${SAAS_API_BASE.replace('/api', '')}/health`, getHeaders());
        setHealthInfo(healthRes.data);
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.errorCode === 'MUST_CHANGE_PASSWORD') {
        setMustChangePassword(true);
      } else if (err.response?.status === 401) {
        setToken('');
        localStorage.removeItem('saas_admin_token');
      } else {
        setErrorMsg(err.response?.data?.message || 'Failed to fetch data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const isBlocking = selectedUser.status !== 'BLOCKED';
      await axios.put(
        `${SAAS_API_BASE}/users/${selectedUser.id}/block`,
        { status: isBlocking, reason: blockReason },
        getHeaders()
      );
      setSuccessMsg(`User ${selectedUser.name} has been ${isBlocking ? 'blocked' : 'unblocked'}.`);
      setShowBlockModal(false);
      setBlockReason('');
      loadDashboardData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${SAAS_API_BASE}/coupons/generate`, couponForm, getHeaders());
      setSuccessMsg(`Coupon '${couponForm.code}' created successfully!`);
      setShowCouponModal(false);
      loadDashboardData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Coupon creation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Render Login / Change Password Screen
  if (!token || mustChangePassword) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">SARFIS SaaS Control Panel</h2>
              <p className="text-xs text-slate-400">Production-Hardened Admin Gateway</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {mustChangePassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <Key size={16} />
                <span>Security Policy: Initial password rotation is required.</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
              >
                {loading ? 'Rotating Password...' : 'Rotate Password & Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
              >
                {loading ? 'Authenticating...' : 'Sign In to SaaS Admin'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SaaS Admin Control Center</h1>
            <p className="text-xs text-slate-400">Enterprise Tenant & Security Management API</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-2 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setToken('');
              localStorage.removeItem('saas_admin_token');
            }}
            className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-3">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'coupons', label: 'Coupons & Promos', icon: Ticket },
          { id: 'audit', label: 'Security Audit Logs', icon: FileText },
          { id: 'health', label: 'System Health', icon: Server }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:underline">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Total Users</span>
                <Users size={18} className="text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats.users?.total || 0}</div>
              <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
                <span>Active: {stats.users?.active || 0}</span>
                <span className="text-slate-500">|</span>
                <span className="text-red-400">Blocked: {stats.users?.blocked || 0}</span>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Active Coupons</span>
                <Ticket size={18} className="text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats.coupons?.active || 0}</div>
              <div className="text-[11px] text-slate-400 mt-2">Total Coupons: {stats.coupons?.total || 0}</div>
            </div>

            <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Companies / Tenants</span>
                <Activity size={18} className="text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats.companies?.total || 0}</div>
              <div className="text-[11px] text-slate-400 mt-2">Active Tenants: {stats.companies?.active || 0}</div>
            </div>

            <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Security Audit Events</span>
                <FileText size={18} className="text-purple-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats.recent_audit_count || 0}</div>
              <div className="text-[11px] text-purple-400 mt-2">SHA-256 Hash Chained</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: USERS */}
      {activeTab === 'users' && (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-indigo-400" />
              <span>SaaS User Registry ({users.length})</span>
            </h3>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Company</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-700/30 transition">
                  <td className="p-3">
                    <div className="font-semibold text-white">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700 text-slate-300">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{u.company_name || 'N/A'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      u.status === 'BLOCKED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setShowBlockModal(true);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ml-auto transition ${
                        u.status === 'BLOCKED'
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {u.status === 'BLOCKED' ? <Unlock size={12} /> : <Lock size={12} />}
                      <span>{u.status === 'BLOCKED' ? 'Unblock' : 'Block User'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: COUPONS */}
      {activeTab === 'coupons' && (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Ticket size={16} className="text-emerald-400" />
              <span>Promotional Coupons</span>
            </h3>
            <button
              onClick={() => setShowCouponModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus size={14} />
              <span>Generate Coupon</span>
            </button>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Used / Limit</th>
                <th className="p-3">Expiry</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-700/30 transition">
                  <td className="p-3 font-mono font-bold text-emerald-400">{c.code}</td>
                  <td className="p-3 text-slate-200">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`} ({c.discount_type})
                  </td>
                  <td className="p-3 text-slate-300">{c.used_count} / {c.usage_limit}</td>
                  <td className="p-3 text-slate-400">{new Date(c.expiry_date).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.effective_status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {c.effective_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-purple-400" />
              <span>Immutable Audit Trail (SHA-256 Chained)</span>
            </h3>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3">Action</th>
                <th className="p-3">Admin</th>
                <th className="p-3">Target</th>
                <th className="p-3">SHA-256 Hash Chain Link</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/30 transition">
                  <td className="p-3 font-semibold text-purple-300">{log.action}</td>
                  <td className="p-3 text-slate-300">{log.admin_email || 'System'}</td>
                  <td className="p-3 text-slate-400">{log.target_type} ({log.target_id || 'N/A'})</td>
                  <td className="p-3 font-mono text-[10px] text-slate-400">
                    {log.record_hash ? `${log.record_hash.substring(0, 16)}...` : 'N/A'}
                  </td>
                  <td className="p-3 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: HEALTH */}
      {activeTab === 'health' && healthInfo && (
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server size={16} className="text-indigo-400" />
            <span>Server Diagnostics & Probes</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="text-xs text-slate-400">Overall Status</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{healthInfo.status}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="text-xs text-slate-400">Database Connection</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">{healthInfo.database}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="text-xs text-slate-400">Process Uptime</div>
              <div className="text-2xl font-bold text-white mt-1">{healthInfo.uptime_seconds} seconds</div>
            </div>
          </div>

          {healthInfo.memory && (
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl flex items-center gap-3">
              <Cpu size={24} className="text-indigo-400" />
              <div>
                <div className="text-xs font-semibold text-white">Node.js Memory Metrics</div>
                <div className="text-xs text-slate-400">
                  Heap Used: {healthInfo.memory.heap_used_mb} MB | RSS: {healthInfo.memory.rss_mb} MB
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BLOCK / UNBLOCK MODAL */}
      {showBlockModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-2">
              {selectedUser.status === 'BLOCKED' ? 'Unblock Account' : 'Block User Account'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Target User: <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.email})
            </p>

            {selectedUser.status !== 'BLOCKED' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1">Reason for Blocking</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="e.g. Violation of security guidelines"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleBlock}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE COUPON MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-4">Generate Promotional Coupon</h3>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase"
                  placeholder="SUMMER2026"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Discount Type</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    value={couponForm.discount_type}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_value: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium"
                >
                  Generate Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
