import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, FilePlus, BookMarked,
  BarChart2, TrendingUp, Target, Settings, LogOut,
  Home, ChevronLeft, ChevronRight, Zap, Building2, Activity,
  Package, Truck, ShieldCheck, Briefcase, Mail, CheckSquare, Sliders,
  Calendar, FileText
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/dashboard/admin/approvals', icon: CheckSquare, label: 'Approvals Inbox', permission: 'approval.view' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { to: '/dashboard/accounts', icon: BookOpen, label: 'Chart of Accounts', permission: 'ledger.view' },
      { to: '/dashboard/vouchers', icon: FilePlus, label: 'ERP Vouchers', permission: 'voucher.view' },
      { to: '/dashboard/purchase-orders', icon: FileText, label: 'Purchase Orders', permission: 'voucher.view' },
      { to: '/dashboard/vendors', icon: Building2, label: 'Vendor Directory', permission: 'vendor.manage' },
      { to: '/dashboard/journal', icon: Activity, label: 'Manual Journals', permission: 'journal.view' },
      { to: '/dashboard/ledger', icon: BookMarked, label: 'General Ledger', permission: 'ledger.view' },
      { to: '/dashboard/finance/close-wizard', icon: Target, label: 'Month-End Close', permission: 'period.manage' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/dashboard/reports', icon: BarChart2, label: 'Financial Reports', permission: 'report.view' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/dashboard/analytics', icon: TrendingUp, label: 'Analytics & Planning', permission: 'analytics.view', moduleKey: 'budgetingEnabled' },
      { to: '/dashboard/risk', icon: Zap, label: 'Credit Risk & Governance', permission: 'risk.view', moduleKey: 'riskEnabled' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/dashboard/inventory',    icon: Package,    label: 'Inventory', permission: 'inventory.view', moduleKey: 'inventoryEnabled' },
      { to: '/dashboard/warehouses',   icon: Building2,  label: 'Warehouses', permission: 'warehouse.manage', moduleKey: 'warehousingEnabled' },
      { to: '/dashboard/distribution', icon: Truck,      label: 'Distribution', permission: 'analytics.view', moduleKey: 'inventoryEnabled' },
      { to: '/dashboard/order-tracking', icon: Truck,     label: 'Order Tracking', permission: 'analytics.view', moduleKey: 'inventoryEnabled' },
      { to: '/dashboard/fixed-assets', icon: Briefcase,  label: 'Asset Management', permission: 'ledger.view', moduleKey: 'fixedAssetsEnabled' },
      { to: '/dashboard/payroll',      icon: Activity,   label: 'Payroll & HR', permission: 'ledger.view', moduleKey: 'payrollEnabled' },
    ],
  },
];

const BOTTOM_ITEMS = [
  { to: '/', icon: Home, label: 'Back to Home' },
  { to: '/dashboard/email-center', icon: Mail, label: 'Email Center', permission: 'settings.manage' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings', permission: 'settings.manage' },
];

export default function Sidebar({ collapsed, isMobile, onToggle }) {
  const navigate = useNavigate();
  const { logout, activeCompany, user, permissions, settings } = useAuthStore();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isEmployee = activeCompany?.user_role === 'Employee';

  useEffect(() => {
    if (!isEmployee || !activeCompany?.id) return;
    const fetchUnread = async () => {
      try {
        const res = await api.get(`/communications/employee/${activeCompany.id}`);
        const unreadCount = res.data.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadMessages(unreadCount);
      } catch (err) {
        console.error('Failed to fetch unread employee messages count', err);
      }
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000);
    return () => clearInterval(timer);
  }, [isEmployee, activeCompany?.id]);

  const isSuperAdmin = user?.role === 'Super Admin';
  const hasPermission = (perm) => {
    if (!perm) return true;
    if (isSuperAdmin) return true;
    return permissions?.includes(perm);
  };

  const isModuleEnabled = (moduleKey) => {
    if (!moduleKey) return true;
    const val = settings[moduleKey];
    if (val === undefined) {
      if (moduleKey === 'payrollEnabled') return false;
      return true; // default to true
    }
    return !!val;
  };

  const filteredSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => hasPermission(item.permission) && isModuleEnabled(item.moduleKey))
  })).filter(section => section.items.length > 0);

  const employeeNavSections = [
    {
      label: 'Employee Workspace',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/dashboard/payroll', icon: Briefcase, label: 'Payroll' },
        { to: '/dashboard/leave', icon: Calendar, label: 'Leave' },
        { to: '/dashboard/documents', icon: FileText, label: 'Documents' },
        { to: '/dashboard/messages', icon: Mail, label: 'Messages', badge: unreadMessages }
      ]
    }
  ];

  const navSections = isEmployee ? employeeNavSections : (hasPermission('user.manage')
    ? [
        ...filteredSections,
        {
          label: 'Administration',
          items: [
            { to: '/dashboard/admin', icon: ShieldCheck, label: 'Admin & Roles' },
            { to: '/dashboard/admin/workflows', icon: Settings, label: 'Workflow Config' },
          ],
        },
      ]
    : filteredSections);

  const bottomItems = isEmployee
    ? [{ to: '/', icon: Home, label: 'Back to Home' }]
    : BOTTOM_ITEMS.filter(item => hasPermission(item.permission));

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3) !important;
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5) !important;
        }
      `}</style>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && !collapsed && (
          <Motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      <Motion.aside
        animate={
          isMobile
            ? { x: collapsed ? -248 : 0, width: 248 }
            : { x: 0, width: collapsed ? 68 : 248 }
        }
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-0 left-0 h-screen flex flex-col z-50 overflow-hidden"
        style={{ background: 'var(--blue-900)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Logo */}
        <div className="flex items-center h-[60px] px-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl.startsWith('http') ? settings.logoUrl : `${import.meta.env.PROD ? window.location.origin : 'http://localhost:5001'}${settings.logoUrl}`}
                alt="Logo"
                className="w-8 h-8 object-contain rounded-lg flex-shrink-0 bg-white p-0.5"
              />
            ) : (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary, #10b981) 0%, #06b6d4 100%)' }}>
                <Zap size={14} className="text-white fill-white" />
              </div>
            )}
            <AnimatePresence>
              {!collapsed && (
                <Motion.span
                  initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-display font-800 text-white text-[17px] tracking-tight overflow-hidden whitespace-nowrap"
                  style={{ fontWeight: 800 }}
                >
                  SARFIS
                </Motion.span>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={onToggle}
            className="ml-auto flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Company switcher */}
        {!collapsed && (
          <Motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mx-3 my-3 px-3 py-2.5 rounded-lg flex items-center gap-2.5 cursor-pointer transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.2)' }}>
              <Building2 size={13} className="text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {activeCompany?.name || "Ayesha Khan's Workspace"}
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Active workspace</div>
            </div>
          </Motion.div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-5 pt-4 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>
                  {section.label}
                </div>
              )}
              {collapsed && <div className="h-3" />}
              {section.items.map((item) => (
                <SidebarItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </div>

        <div className="border-t pb-3 pt-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {bottomItems.map((item) => (
            <SidebarItem key={item.to} item={item} collapsed={collapsed} />
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg text-[13.5px] font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.45)', width: 'calc(100% - 16px)', margin: '2px 8px' }}
          >
            <LogOut size={16} className="flex-shrink-0 text-rose-400" />
            {!collapsed && <span className="whitespace-nowrap">Sign out</span>}
          </button>
        </div>
      </Motion.aside>
    </>
  );
}

function SidebarItem({ item, collapsed }) {
  const content = (
    <Motion.div whileHover={{ x: collapsed ? 0 : 2 }} className="relative">
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          `sidebar-nav-item ${isActive ? 'active' : ''}`
        }
        title={collapsed ? item.label : undefined}
      >
        <div className="flex items-center gap-3 w-full">
          <item.icon size={17} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <Motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap text-[13.5px] flex items-center justify-between w-full"
              >
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="bg-red-500 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full mr-2">
                    {item.badge}
                  </span>
                )}
              </Motion.span>
            )}
          </AnimatePresence>
        </div>
      </NavLink>
    </Motion.div>
  );
  return content;
}
