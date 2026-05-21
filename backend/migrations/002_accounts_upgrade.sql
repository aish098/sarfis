-- ============================================================
-- SCAFIS ERP EXPANSION — DATABASE MIGRATIONS
-- Upgrade Chart of Accounts to support Contra Accounts
-- ============================================================

-- 1. Rename 'type' to 'category'
ALTER TABLE accounts RENAME COLUMN type TO category;

-- 2. Add 'normal_balance' and 'is_contra'
ALTER TABLE accounts
  ADD COLUMN normal_balance VARCHAR(10) DEFAULT 'Debit',
  ADD COLUMN is_contra BOOLEAN DEFAULT FALSE;

-- 3. Set standard normal balances based on GAAP for existing non-contra accounts
UPDATE accounts
SET normal_balance = CASE
  WHEN category IN ('Asset', 'Expense') THEN 'Debit'
  WHEN category IN ('Liability', 'Equity', 'Revenue', 'Income') THEN 'Credit'
  ELSE 'Debit'
END,
is_contra = FALSE;

-- 4. Automatically identify and correct known Contra Asset accounts if they exist
UPDATE accounts
SET is_contra = TRUE,
    normal_balance = 'Credit'
WHERE category = 'Asset' 
  AND (
    LOWER(name) LIKE '%allowance%' OR
    LOWER(name) LIKE '%accumulated depreciation%' OR
    LOWER(name) LIKE '%accumulated amortization%'
  );

-- 5. Automatically identify and correct known Contra Revenue accounts if they exist
UPDATE accounts
SET is_contra = TRUE,
    normal_balance = 'Debit'
WHERE category IN ('Revenue', 'Income') 
  AND (
    LOWER(name) LIKE '%discount%' OR
    LOWER(name) LIKE '%returns%' OR
    LOWER(name) LIKE '%allowances%'
  );

-- 6. Automatically identify and correct known Contra Equity accounts if they exist
UPDATE accounts
SET is_contra = TRUE,
    normal_balance = 'Debit'
WHERE category = 'Equity' 
  AND (
    LOWER(name) LIKE '%drawings%' OR
    LOWER(name) LIKE '%dividends%' OR
    LOWER(name) LIKE '%treasury stock%'
  );

-- 7. Identify Contra Liability accounts (like Discount on Bonds Payable)
UPDATE accounts
SET is_contra = TRUE,
    normal_balance = 'Debit'
WHERE category = 'Liability'
  AND (
    LOWER(name) LIKE '%discount%'
  );
