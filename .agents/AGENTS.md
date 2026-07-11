# Project-Scoped Rules for SARFIS Development

All future code modifications and reviews in this repository must adhere strictly to these UX-first principles.

---

## 💡 Core Design Philosophy
**User-friendly first, enterprise second, technical third.**
Every feature must remain intuitive for non-technical managers while keeping advanced tracing/log data readily available under disclosure triggers.

---

## 🎨 Layout & Interaction Standards

### 1. Task-Oriented Navigation
Organize the interface around business actions, not technical descriptors:
* **Yes**: `Payroll Processing`, `Pay Employees`, `Close Month`, `Reconcile Bank`.
* **No**: `Payroll Engine`, `Ledger Services`, `Formula Trace`.

### 2. Progressive Disclosure
* Keep the initial interface clear and focused (e.g. Employee Card showing basic profile, net salary, and status badge).
* Hide advanced details (formula trees, journal entry JSONs, raw API records) inside collapsible details drawers/modals that open upon user action.

### 3. One Primary Action Per Page
* Every page must have one clear call-to-action (e.g. Dashboard → *Review status*, Employees → *Manage profiles*, Payments → *Release payments*). Avoid multiple competing colored primary buttons.

### 4. Click Efficiency (3-Click Rule)
* Keep user paths short. If a standard operational sequence requires more than 3 clicks, consolidate the layout using direct navigation drawers or search index targets.

### 5. Smart Defaults
* Pre-select the current period, active company, default ledger accounts, and standard reports filters automatically so the user can proceed without manual adjustments.

### 6. Standard Color Semantics
Maintain a consistent color hierarchy across the entire ERP:
* 🟢 **Green**: Success / Completed
* 🟦 **Blue**: Active / In Progress
* 🟨 **Yellow**: Pending Attention
* 🟧 **Orange**: Warning
* 🟥 **Red**: Error / Blocked
* ⚪ **Gray**: Closed / Archived

### 7. Card-First Interfaces
* Prefer scannable, mobile-friendly cards over dense, multi-column tables on responsive screen ranges.

### 8. Contextual Buttons
* Render only relevant buttons matching the selected record's lifecycle state (e.g. selecting an Approved run reveals only Post/Close buttons, hiding Simulation/Approve triggers).

### 9. Consistent Structure
Every workspace should structure sections uniformly:
`Header ➔ Breadcrumbs ➔ Search/Filters ➔ Summary cards ➔ Content ➔ Drawer panel ➔ Timeline`

### 10. Direct Drill-Down
* Connect related data points through links (e.g. clicking a posted journal voucher opens the General Ledger view, rather than requiring the user to navigate and search manually).

### 11. Human-Friendly Terminology
* Avoid system jargon. Use `Calculation Details` instead of `JSON Formula Trace`, `Post to General Ledger` instead of `Posting Engine`, and `Bank Reconciliation` instead of `Reconciliation Queue`.
