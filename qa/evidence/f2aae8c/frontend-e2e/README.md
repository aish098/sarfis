# Real Browser E2E Test Evidence Directory

* **Application Commit Under Test**: `f2aae8ca8bfcebae9757d5dc048eff8c27392c3c` (`f2aae8c`)
* **Staging Target URL**: `http://localhost:5173`
* **Execution Date**: `2026-07-26`

## Executed Workflows & Evidence Scope:
1. **Authentication & Session Lifecycle**: Login, Logout, Session Expiration, Password Reset & Company Switching.
2. **Navigation & Role-Based Menus**: Cockpit layout, Admin vs. Viewer role-based menu filtering.
3. **Data Entry & State Persistence**: Form input, page refresh persistence (Zustand + LocalStorage).
4. **Voucher Approval & Auto-Posting**: Multi-stage approval routing, CFO escalation threshold, GL voucher posting.
5. **Sales & Purchasing Workflows**: Purchase Requisition $\rightarrow$ PO $\rightarrow$ GRN $\rightarrow$ Vendor Invoice 3-way match, Sales Order $\rightarrow$ Delivery Note $\rightarrow$ AR Invoicing.
6. **Inventory & Stock Management**: WAC recalculation, FIFO batch consumption, stock movement ledger.
7. **Payroll Processing**: Payroll run generation, gross-to-net calculation, loan recovery, GL posting.
8. **Fixed Assets & Depreciation**: Asset card registration, monthly straight-line depreciation posting, asset disposal.
9. **Budgeting & Cost Controls**: Annual budget allocation, overspend blocking policy, inter-department transfers.
10. **Period Close & Year-End**: Unposted draft block, OPEN $\rightarrow$ CLOSED transition, Retained Earnings transfer (`3200`).
11. **Financial Reports & Analytics**: Balance Sheet, Income Statement, Cash Flow Statement, Trial Balance exports.
12. **Administrative Utilities**: JSON backup download, restore dialog, session revocation.
13. **Error Handling & Dialogs**: Standardized business error alerts (`ACC-400`, `ACC-403`), confirmation modals.
