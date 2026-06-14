import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Search, Filter, Calendar, Download, RefreshCw, Eye,
  CheckCircle2, Archive, CheckSquare, Settings, KeyRound, Clock,
  ArrowRight, Trash2, ShieldAlert
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const PBI = {
  blue: '#059669',
  cyan: '#0891b2',
  navy: '#060d24',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#475569',
  dim: '#94a3b8',
  surface: '#f8fafc',
  soft: '#ecfdf5',
};

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionSaving, setActionSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [archivedFilter, setArchivedFilter] = useState('false'); // 'false' (active only) | 'true' (all) | 'only' (archived only)
  const [typeFilter, setTypeFilter] = useState(''); // '' (all) | 'approval' | 'period' | 'permission' | 'system'
  const [priorityFilter, setPriorityFilter] = useState(''); // '' (all) | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const requestConfig = useMemo(
    () => companyId ? { headers: { 'x-company-id': String(companyId) } } : undefined,
    [companyId]
  );

  const fetchNotifications = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (archivedFilter !== 'false') queryParams.append('includeArchived', archivedFilter);
      if (statusFilter === 'unread') queryParams.append('isRead', 'false');
      if (statusFilter === 'read') queryParams.append('isRead', 'true');
      if (typeFilter) queryParams.append('type', typeFilter);
      if (priorityFilter) queryParams.append('priority', priorityFilter);
      if (search) queryParams.append('search', search);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await api.get(`/notifications/${companyId}?${queryParams.toString()}`, requestConfig);
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setFeedback({ type: 'error', text: 'Failed to load notifications.' });
    } finally {
      setLoading(false);
    }
  }, [companyId, search, statusFilter, archivedFilter, typeFilter, priorityFilter, startDate, endDate, requestConfig]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    if (!companyId) return;
    try {
      await api.put(`/notifications/${companyId}/${id}/read`, {}, requestConfig);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!companyId) return;
    setActionSaving(true);
    try {
      await api.put(`/notifications/${companyId}/read-all`, {}, requestConfig);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setFeedback({ type: 'success', text: 'All notifications marked as read.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setActionSaving(false);
    }
  };

  const handleArchive = async (id) => {
    if (!companyId) return;
    try {
      await api.put(`/notifications/${companyId}/${id}/archive`, {}, requestConfig);
      // Remove from list if viewing active only
      if (archivedFilter === 'false') {
        setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_archived: true } : n)
        );
      }
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleUnarchive = async (id) => {
    if (!companyId) return;
    try {
      await api.put(`/notifications/${companyId}/${id}/unarchive`, {}, requestConfig);
      // Remove from list if viewing archived only
      if (archivedFilter === 'only') {
        setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_archived: false } : n)
        );
      }
    } catch (err) {
      console.error('Failed to unarchive:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await handleMarkAsRead(notif.id);
    }
    if (notif.entity_type === 'voucher') {
      navigate('/dashboard/vouchers');
    } else if (notif.entity_type === 'journal') {
      navigate('/dashboard/ledger');
    } else if (notif.entity_type === 'permission' || notif.entity_type === 'override') {
      navigate('/dashboard/admin?tab=permissions');
    } else if (notif.entity_type === 'period') {
      navigate('/dashboard/admin?tab=periods');
    }
  };

  const handleExportCSV = () => {
    if (notifications.length === 0) return;
    
    // Headers
    const headers = ['ID', 'Title', 'Message', 'Type', 'Priority', 'Read', 'Archived', 'Created At'];
    
    // Rows
    const rows = notifications.map(n => [
      n.id,
      `"${n.title.replace(/"/g, '""')}"`,
      `"${n.message.replace(/"/g, '""')}"`,
      n.type,
      n.priority,
      n.is_read ? 'YES' : 'NO',
      n.is_archived ? 'YES' : 'NO',
      new Date(n.created_at).toLocaleString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `notifications_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPriorityStyles = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', dot: 'bg-rose-500' };
      case 'HIGH':
        return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', dot: 'bg-orange-500' };
      case 'MEDIUM':
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-500' };
      case 'LOW':
      default:
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', dot: 'bg-blue-500' };
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approval':
        return <CheckSquare size={16} className="text-amber-600" />;
      case 'period':
        return <Calendar size={16} className="text-rose-600" />;
      case 'permission':
        return <KeyRound size={16} className="text-emerald-600" />;
      case 'system':
      default:
        return <Bell size={16} className="text-blue-600" />;
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setArchivedFilter('false');
    setTypeFilter('');
    setPriorityFilter('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="p-4 lg:p-7 pb-20 max-w-6xl mx-auto font-sans relative overflow-hidden bg-gradient-to-br from-[#F4FBF7] via-[#FAF9F8] to-[#F3FAF6] space-y-6">
      
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase">Notification Center</h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Review and audit all notifications, alerts, and transaction approval flows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 sm:mt-0 flex-wrap">
          <button
            onClick={handleMarkAllAsRead}
            disabled={actionSaving || notifications.filter(n => !n.is_read).length === 0}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-[12px] font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <CheckCircle2 size={13} className="text-slate-500" />
            Mark all read
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={notifications.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#06b6d4] hover:from-[#059669] hover:to-[#0891b2] disabled:opacity-50 text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border text-[12.5px] font-bold ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {feedback.text}
        </div>
      )}

      {/* Filter and Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-[13px] text-slate-900 flex items-center gap-2">
              <Filter size={14} className="text-emerald-500" /> Filter Criteria
            </h3>
            <button
              onClick={resetFilters}
              className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors"
            >
              Reset All
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-[12.5px] text-slate-800 outline-none focus:border-emerald-500 transition-all bg-slate-50/50"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Read Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-800 outline-none focus:border-emerald-500 bg-white"
            >
              <option value="all">All Alerts</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>
          </div>

          {/* Archived */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Archive Status</label>
            <select
              value={archivedFilter}
              onChange={e => setArchivedFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-800 outline-none focus:border-emerald-500 bg-white"
            >
              <option value="false">Active Only</option>
              <option value="true">Active & Archived</option>
              <option value="only">Archived Only</option>
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Severity Priority</label>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-800 outline-none focus:border-emerald-500 bg-white"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Alert Type</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-800 outline-none focus:border-emerald-500 bg-white"
            >
              <option value="">All Types</option>
              <option value="approval">Approvals Queue</option>
              <option value="period">Fiscal Periods</option>
              <option value="permission">User Permissions</option>
              <option value="system">System Alerts</option>
            </select>
          </div>

          {/* Date range */}
          <div className="space-y-2 pt-2 border-t">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">Date Range Filter</span>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11.5px] outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11.5px] outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Notifications list content */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <span className="text-[11.5px] font-extrabold uppercase text-slate-500">
                Matches ({notifications.length})
              </span>
              <button
                onClick={fetchNotifications}
                className="p-1.5 border rounded-lg bg-white text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
                title="Refresh alerts"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex-1 divide-y divide-slate-100">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 min-h-[350px]">
                  <RefreshCw size={24} className="animate-spin text-emerald-600 mb-2" />
                  <p className="text-[12.5px] font-medium text-slate-500">Retrieving notification records...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 min-h-[350px] text-center">
                  <CheckCircle2 size={36} className="text-emerald-500 mb-3" />
                  <h4 className="text-[14px] font-bold text-slate-800">Clear Ledger Alerts</h4>
                  <p className="text-[11.5px] text-slate-400 mt-1 max-w-xs">
                    No notifications match your current filter settings. Reset filters or fetch updates to sync.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const styles = getPriorityStyles(notif.priority);
                  return (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-slate-50/50 transition-colors relative flex items-start gap-3.5 ${
                        !notif.is_read ? 'bg-emerald-50/5' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.bg}`}>
                        {getNotificationIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[13.5px] text-slate-800 leading-tight">
                              {notif.title}
                            </h4>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${styles.bg} ${styles.text} ${styles.border}`}>
                              {notif.priority}
                            </span>
                            {notif.is_archived && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-slate-100 text-slate-500 border-slate-200">
                                Archived
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                            {new Date(notif.created_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <p className="text-[12px] text-slate-500 font-medium mt-1 leading-relaxed max-w-3xl">
                          {notif.message}
                        </p>

                        {/* Actions Row */}
                        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-slate-100 flex-wrap">
                          {notif.entity_type && (
                            <button
                              onClick={() => handleNotificationClick(notif)}
                              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#059669] hover:underline"
                            >
                              View Resource <ArrowRight size={10} />
                            </button>
                          )}
                          {!notif.is_read && (
                            <button
                              onClick={() => handleMarkAsRead(notif.id)}
                              className="text-[11px] font-bold text-slate-600 hover:text-slate-900"
                            >
                              Mark as Read
                            </button>
                          )}
                          {!notif.is_archived ? (
                            <button
                              onClick={() => handleArchive(notif.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 ml-auto"
                            >
                              <Archive size={11} /> Archive Alert
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnarchive(notif.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 ml-auto"
                            >
                              <RefreshCw size={11} /> Restore Alert
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
