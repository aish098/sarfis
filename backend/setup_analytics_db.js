const db = require('./src/config/db');

async function setup() {
  try {
    // Drop existing table if it has the old schema (optional, but safer for development)
    // await db.raw('DROP TABLE IF EXISTS budgets CASCADE;');

    await db.raw(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        sector_id VARCHAR(100), -- For sector-based budgeting
        budget_type VARCHAR(20) DEFAULT 'account', -- 'account' or 'sector'
        period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
        period_year INTEGER NOT NULL,
        budget_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
        notes TEXT,
        currency VARCHAR(10) DEFAULT 'PKR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_id, account_id, sector_id, period_month, period_year, budget_type)
      );
    `);
    console.log("Budgets table verified/created successfully with enhanced schema.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to setup budgets table:", err);
    process.exit(1);
  }
}

setup();
