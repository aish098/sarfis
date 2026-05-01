-- ============================================================
-- SCAFIS ERP EXPANSION — DATABASE MIGRATIONS
-- Run these in order after your existing accounting tables
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. WAREHOUSES
-- ─────────────────────────────────────────────
CREATE TABLE warehouses (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  location      VARCHAR(300),
  description   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_warehouses_company ON warehouses(company_id);

-- ─────────────────────────────────────────────
-- 2. SECTORS (Industry / Business Segments)
-- ─────────────────────────────────────────────
CREATE TABLE sectors (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sectors_company ON sectors(company_id);

-- ─────────────────────────────────────────────
-- 3. CLIENTS
-- ─────────────────────────────────────────────
CREATE TABLE clients (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sector_id       INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(200),
  phone           VARCHAR(50),
  address         TEXT,
  credit_limit    DECIMAL(15, 2) DEFAULT 0.00,
  current_balance DECIMAL(15, 2) DEFAULT 0.00,  -- outstanding AR
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_company ON clients(company_id);
CREATE INDEX idx_clients_sector  ON clients(sector_id);

-- ─────────────────────────────────────────────
-- 4. PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE products (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku                   VARCHAR(100) NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  unit_price            DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  cost_price            DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  unit_of_measure       VARCHAR(50) DEFAULT 'unit',
  reorder_level         INTEGER DEFAULT 0,       -- alert threshold
  is_active             BOOLEAN DEFAULT TRUE,
  -- Link to COA (optional but recommended)
  inventory_account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  cogs_account_id       INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  revenue_account_id    INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_sku     ON products(company_id, sku);

-- ─────────────────────────────────────────────
-- 5. INVENTORY (Per product per warehouse)
-- ─────────────────────────────────────────────
CREATE TABLE inventory (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity      DECIMAL(15, 4) DEFAULT 0.0000,
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id)
);

CREATE INDEX idx_inventory_product   ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);

-- ─────────────────────────────────────────────
-- 6. STOCK LOGS (Immutable audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE stock_logs (
  id               SERIAL PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  warehouse_id     INTEGER NOT NULL REFERENCES warehouses(id),
  type             VARCHAR(30) NOT NULL CHECK (type IN (
                     'PURCHASE', 'SALE', 'ADJUSTMENT',
                     'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN'
                   )),
  quantity_change  DECIMAL(15, 4) NOT NULL,  -- positive = in, negative = out
  quantity_after   DECIMAL(15, 4) NOT NULL,
  unit_cost        DECIMAL(15, 2),
  reference_id     INTEGER,                  -- journal_entry id
  reference_type   VARCHAR(50),              -- 'journal_entry' | 'delivery' | 'adjustment'
  notes            TEXT,
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stock_logs_product   ON stock_logs(product_id);
CREATE INDEX idx_stock_logs_warehouse ON stock_logs(warehouse_id);
CREATE INDEX idx_stock_logs_type      ON stock_logs(type);
CREATE INDEX idx_stock_logs_created   ON stock_logs(created_at DESC);

-- ─────────────────────────────────────────────
-- 7. DELIVERIES (Sales orders / Distribution)
-- ─────────────────────────────────────────────
CREATE TABLE deliveries (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id         INTEGER NOT NULL REFERENCES clients(id),
  sector_id         INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
  warehouse_id      INTEGER NOT NULL REFERENCES warehouses(id),
  delivery_number   VARCHAR(50) NOT NULL,
  delivery_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  status            VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','CONFIRMED','DISPATCHED','DELIVERED','CANCELLED')),
  total_amount      DECIMAL(15, 2) DEFAULT 0.00,
  total_cost        DECIMAL(15, 2) DEFAULT 0.00,
  journal_entry_id  INTEGER REFERENCES journal_entries(id),
  notes             TEXT,
  created_by        INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, delivery_number)
);

CREATE INDEX idx_deliveries_company  ON deliveries(company_id);
CREATE INDEX idx_deliveries_client   ON deliveries(client_id);
CREATE INDEX idx_deliveries_sector   ON deliveries(sector_id);
CREATE INDEX idx_deliveries_status   ON deliveries(status);
CREATE INDEX idx_deliveries_date     ON deliveries(delivery_date DESC);

-- ─────────────────────────────────────────────
-- 8. DELIVERY ITEMS (Line items per delivery)
-- ─────────────────────────────────────────────
CREATE TABLE delivery_items (
  id            SERIAL PRIMARY KEY,
  delivery_id   INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  quantity      DECIMAL(15, 4) NOT NULL,
  unit_price    DECIMAL(15, 2) NOT NULL,
  unit_cost     DECIMAL(15, 2) NOT NULL,
  line_total    DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  line_cost     DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);

CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_product  ON delivery_items(product_id);

-- ─────────────────────────────────────────────
-- HELPFUL VIEWS
-- ─────────────────────────────────────────────

-- Current stock by product (summed across warehouses)
CREATE VIEW v_stock_summary AS
SELECT
  p.id           AS product_id,
  p.company_id,
  p.sku,
  p.name         AS product_name,
  p.unit_price,
  p.cost_price,
  p.reorder_level,
  COALESCE(SUM(i.quantity), 0) AS total_qty,
  CASE WHEN COALESCE(SUM(i.quantity), 0) <= p.reorder_level
       THEN TRUE ELSE FALSE END AS low_stock
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
GROUP BY p.id, p.company_id, p.sku, p.name, p.unit_price, p.cost_price, p.reorder_level;

-- Sector-wise revenue view
CREATE VIEW v_sector_revenue AS
SELECT
  s.id          AS sector_id,
  s.company_id,
  s.name        AS sector_name,
  COUNT(d.id)   AS delivery_count,
  COALESCE(SUM(d.total_amount), 0) AS total_revenue,
  COALESCE(SUM(d.total_cost), 0)   AS total_cost,
  COALESCE(SUM(d.total_amount) - SUM(d.total_cost), 0) AS gross_profit
FROM sectors s
LEFT JOIN deliveries d ON d.sector_id = s.id AND d.status = 'DELIVERED'
GROUP BY s.id, s.company_id, s.name;

-- Client outstanding balance view
CREATE VIEW v_client_balance AS
SELECT
  c.id,
  c.company_id,
  c.name,
  c.credit_limit,
  c.current_balance,
  c.credit_limit - c.current_balance AS available_credit,
  CASE WHEN c.current_balance >= c.credit_limit THEN TRUE ELSE FALSE END AS credit_blocked
FROM clients c;
