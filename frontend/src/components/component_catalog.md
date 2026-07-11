# SARFIS ERP Component Catalog

This catalog outlines the standard visual design components of the SARFIS Platform & BI Framework, facilitating consistent development across all ERP modules.

---

## 🎨 UI Primitives (`components/ui/`)

### 1. `StatusBadge`
Renders colored workflow status indicators.
* **Props**:
  * `status`: (string) e.g., 'PAID', 'PENDING', 'PROCESSING', 'FAILED', 'CLOSED', 'APPROVED'.
* **Example**:
  ```jsx
  <StatusBadge status="PAID" />
  ```

### 2. `RightDrawer`
Universal side-slide drawer panel.
* **Props**:
  * `isOpen`: (boolean) Controls drawer visibility.
  * `onClose`: (function) Triggered on closing the drawer.
  * `title`: (string) Drawer header title.
  * `subtitle`: (string) Secondary header detail.
  * `tabs`: (array) `{ id, label }` selectors.
  * `activeTab`: (string) Currently open tab.
  * `onTabChange`: (function) Tab selector callback.
* **Example**:
  ```jsx
  <RightDrawer isOpen={true} title="John Doe" onClose={() => {}}>
    <p>Content panel details...</p>
  </RightDrawer>
  ```

### 3. `Timeline`
Activity feed and tracking logger.
* **Props**:
  * `items`: (array) `{ title, desc, date }` objects.
* **Example**:
  ```jsx
  <Timeline items={[{ title: 'Generate Run', date: '09:10' }]} />
  ```

### 4. `WizardFlow`
Visual step stepper flow.
* **Props**:
  * `steps`: (array) `{ label, desc }` objects.
  * `activeStep`: (number) Currently active stage index.
* **Example**:
  ```jsx
  <WizardFlow steps={[{ label: 'Step 1' }]} activeStep={0} />
  ```

### 5. `DataTable`
Paging data table carrying mobile layout adaptation.
* **Props**:
  * `columns`: (array) `{ key, label, render }` configs.
  * `data`: (array) Raw data records.
  * `pageSize`: (number) Total rows per page.
* **Example**:
  ```jsx
  <DataTable columns={[{ key: 'name', label: 'Name' }]} data={[{ name: 'John' }]} />
  ```

---

## 📊 Business Intelligence (`components/analytics/`)

### 1. `AnalyticsCard`
Wrapper container for report graphs and summary statistics.
* **Props**:
  * `title`: (string) Main graph title.
  * `kpis`: (array) Stats items `{ label, value, change, isPositive }`.
  * `insights`: (array) Text observations list.
* **Example**:
  ```jsx
  <AnalyticsCard title="Financial Performance" kpis={[{ label: 'Gross Profit', value: 'PKR 12M' }]}>
    <p>Chart Node...</p>
  </AnalyticsCard>
  ```
