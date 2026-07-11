# SARFIS ERP Development Standards (UX-First)

All code modifications and reviews in this repository must adhere strictly to these standards.

---

## 💡 Core Philosophy
**User-friendly first, enterprise second, technical third.**
Every screen should be understandable by a finance manager, HR officer, accountant, or business owner without requiring technical knowledge. Advanced information must always be available through drill-downs instead of cluttering the primary interface.

---

## 🎨 Layout & Interaction Standards

### 1. Business-Oriented Design
Every page should answer one question: **What is the user trying to accomplish?**
* **Yes**: `Process Payroll`, `Approve Voucher`, `Receive Inventory`, `Pay Supplier`, `Create Budget`.
* Avoid exposing internal implementation terminology.

### 2. Progressive Disclosure
Organize information layers logically:
* **Level 1 (Always Visible)**: Status, Amount, Date, Assigned User, Department, Primary Action.
* **Level 2 (Expandable)**: Accounting entries, Component breakdown, Approval history, Attachments.
* **Level 3 (Technical)**: API payloads, JSON traces, Formula evaluation, Audit metadata, Debug information.

### 3. One Primary Action
Each screen must have one dominant button. 
* *Example (Payments)*: Primary `Release Payments` (🟢 Green), Secondary `Export`, `Preview`, `Print`, `History` (Gray/Outline).

### 4. Click Efficiency (3-Click Rule)
Frequently used operations should never exceed three interactions.
* **Bad**: Dashboard ➔ Payroll ➔ Runs ➔ Employee ➔ Payments ➔ History.
* **Better**: Dashboard ➔ Search Employee ➔ Employee Workspace.

### 5. Smart Defaults
Automatically pre-select the current company, current fiscal year, current accounting period, current department (when applicable), default currency, default bank, and last-used filters.

### 6. Consistent Status Colors
Maintain a consistent color hierarchy across the entire ERP:
* 🟢 **Green**: Success / Completed
* 🔵 **Blue**: Active / In Progress
* 🟡 **Yellow**: Pending Attention
* 🟠 **Orange**: Warning
* 🔴 **Red**: Error / Blocked
* ⚪ **Gray**: Closed / Archived

### 7. Card-First Responsive Design
Adapt interfaces gracefully:
* **Desktop**: Cards + Tables.
* **Tablet**: Cards + Compact Tables.
* **Mobile**: Cards Only (Avoid wide horizontal scrolling tables).

### 8. Context-Aware Actions
Buttons should appear only when valid.
* *Draft Payroll*: Generate, Simulate, Submit.
* *Approved Payroll*: Post, Pay Employees.
* *Closed Payroll*: View, Export, Audit (No Edit button should appear once editing is no longer allowed).

### 9. Standard Page Structure
Every workspace should follow:
`Header ➔ Breadcrumb ➔ Global Search ➔ Filters ➔ Summary Cards ➔ Main Content ➔ Details Drawer ➔ Timeline / Audit`

### 10. Universal Drill-Down
Every record should link to related records.
* *Example*: Payroll Run ➔ Employee ➔ Payslip ➔ Journal Voucher ➔ General Ledger ➔ Bank Payment ➔ Bank Reconciliation ➔ Audit History.

### 11. Human-Friendly Language
Use business language rather than technical jargon:
* Use `Calculation Details` instead of `JSON Formula Trace`.
* Use `Post to General Ledger` instead of `Posting Engine`.
* Use `Bank Reconciliation` instead of `Reconciliation Queue`.
* Use `Payroll Rules` instead of `Rule Engine`.

### 12. Performance Standards
* Dashboard load: **< 2 seconds**
* Search results: **< 1 second**
* Drawer opening: **< 500 ms**
* Posting actions: Progress indicator required.
* Large datasets: Pagination or virtualization required.

### 13. Accessibility
Every feature must support:
* Keyboard navigation & visible focus states.
* Screen reader labels & high color contrast.
* Icons with text labels (never standalone icons).
* Minimum touch targets for mobile.

### 14. Workflow Consistency
Every operational module must follow a predictable lifecycle:
`Draft ➔ Validated ➔ Submitted ➔ Approved ➔ Posted ➔ Completed ➔ Closed ➔ Archived`

### 15. Audit-First Design
Every action must record who performed it, when, what changed, why, and which workflow approved it. Audit information should always be available via a dedicated history panel.

### 16. Error Handling
Never display raw system errors. Provide actionable business guidance.
* **Bad**: `500 Internal Server Error`
* **Good**: *“Unable to post payroll because the accounting period is closed. Open the next accounting period or contact Finance.”*

### 17. Cross-Module Consistency
All modules must share the same design language:
* Employee cards must look like supplier cards.
* Approval timelines must be identical across Payroll, Purchasing, Budgets, Inventory, and Finance.

### 18. Enterprise Scalability
Every feature must support multi-company, multi-branch, multi-currency, multi-department, multi-fiscal-year, role-based permissions, and audit logging.

---

## 🛠️ Development Validation Rule
Before merging any feature, validate:
1. Is it intuitive for first-time users?
2. Can the primary task be completed in three clicks or fewer?
3. Are advanced details hidden until requested?
4. Is terminology business-friendly?
5. Does it match the standard page layout?
6. Is it responsive on desktop, tablet, and mobile?
7. Does it respect permissions and workflow states?
8. Is it fully auditable?
9. Does it integrate correctly with related ERP modules?

If any answer is **No**, revise the implementation before considering it complete.
