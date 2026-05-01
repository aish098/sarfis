const db = require('./db');

const createTables = async () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(100) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS company_users (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      UNIQUE(user_id, company_id)
    );`,
    `CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      code VARCHAR(10) NOT NULL,
      name VARCHAR(150) NOT NULL,
      type VARCHAR(20) NOT NULL, -- Asset, Liability, Equity, Income, Expense
      balance NUMERIC(14,2) DEFAULT 0,
      UNIQUE(company_id, code)
    );`,
    `CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      description TEXT,
      created_by INT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS journal_lines (
      id SERIAL PRIMARY KEY,
      entry_id INT REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INT REFERENCES accounts(id),
      debit NUMERIC(14,2) DEFAULT 0,
      credit NUMERIC(14,2) DEFAULT 0
    );`,
    `CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);`,
    `CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);`
  ];

  try {
    for (const tableQuery of tables) {
      await db.raw(tableQuery);
    }
    console.log('Accounting tables created/verified successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }
};

createTables();
