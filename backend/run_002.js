const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', '002_accounts_upgrade.sql'), 'utf8');
    await db.raw(sql);
    console.log('Migration 002 applied successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
