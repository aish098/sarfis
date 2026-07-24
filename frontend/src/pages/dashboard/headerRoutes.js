/** Route → breadcrumb labels for dashboard header */
export const ROUTE_CRUMBS = [
  {match: '/dashboard/vouchers', section: 'Transactions', title: 'ERP Vouchers'},
  { match: '/dashboard/accounts', section: 'Accounting', title: 'Chart of Accounts' },
  { match: '/dashboard/journal', section: 'Transactions', title: 'Manual Journals' },
  { match: '/dashboard/ledger', section: 'Accounting', title: 'General Ledger' },
  { match: '/dashboard/reports', section: 'Reports', title: 'Financial Reports' },
  { match: '/dashboard/analytics', section: 'Intelligence', title: 'Analytics & Planning' },
  { match: '/dashboard/risk', section: 'Intelligence', title: 'Credit Risk & Governance' },
  { match: '/dashboard/payroll', section: 'HR & Operations', title: 'Payroll & HR' },
  { match: '/dashboard/fixed-assets', section: 'Accounting', title: 'Asset Management' },
  { match: '/dashboard/email-center', section: 'Administration', title: 'Enterprise Email Hub' },
  { match: '/dashboard/inventory', section: 'Operations', title: 'Inventory' },
  { match: '/dashboard/warehouses', section: 'Operations', title: 'Warehouses' },
  { match: '/dashboard/distribution', section: 'Operations', title: 'Distribution & Clients' },
  { match: '/dashboard/vendors', section: 'Transactions', title: 'Vendor Directory' },
  { match: '/dashboard/admin/approvals', section: 'Administration', title: 'Approval Inbox' },
  { match: '/dashboard/admin', section: 'Administration', title: 'Admin & Roles' },
  { match: '/dashboard/settings', section: 'System', title: 'Settings' },
  { match: '/dashboard', section: null, title: 'Executive Dashboard' },
];

export function resolveBreadcrumb(pathname) {
  const sorted = [...ROUTE_CRUMBS].sort((a, b) => b.match.length - a.match.length);
  const hit = sorted.find((r) =>
    r.match === '/dashboard'
      ? pathname === '/dashboard' || pathname === '/dashboard/'
      : pathname === r.match || pathname.startsWith(`${r.match}/`)
  );
  return hit || { section: 'ACCOUNTELLENCE', title: 'Dashboard' };
}
