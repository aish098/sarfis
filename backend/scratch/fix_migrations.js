const db = require('../src/config/db');

async function fix() {
  try {
    const migrations = await db('knex_migrations').select('*');
    console.log('Current Registered Migrations in DB:', migrations);
    
    // We have:
    // 20260401000000_core_tables.js (already exists in DB physically, needs to be marked completed)
    // 20260501000000_create_budgets_table.js (physically exists? Let's check)
    // 20260502053700_add_ar_account_to_deliveries.js (physically exists? Let's check)
    // 20260527000000_upgrade_accounts_schema.js (physically exists? Let's check)
    
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = tables.rows.map(r => r.table_name);
    console.log('Tables physically present in Database:', tableNames);

    // Let's check if budgets table exists
    const hasBudgets = tableNames.includes('budgets');
    console.log('Budgets table exists:', hasBudgets);

    // Check if deliveries.ar_account_id exists
    let hasArAccountCol = false;
    if (tableNames.includes('deliveries')) {
      const cols = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'deliveries' AND column_name = 'ar_account_id'
      `);
      hasArAccountCol = cols.rows.length > 0;
    }
    console.log('deliveries.ar_account_id column exists:', hasArAccountCol);

    // Check if accounts.category exists (which was renamed from type in upgrade_accounts_schema)
    let hasCategoryCol = false;
    if (tableNames.includes('accounts')) {
      const cols = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'category'
      `);
      hasCategoryCol = cols.rows.length > 0;
    }
    console.log('accounts.category column exists:', hasCategoryCol);

    // Let's populate the knex_migrations table properly so we don't try to re-run them
    const pendingNames = [
      '20260401000000_core_tables.js',
      '20260420212000_erp_tables.js', // We saw it is completed, but let's make sure
    ];

    if (hasBudgets) {
      pendingNames.push('20260501000000_create_budgets_table.js');
    }
    if (hasArAccountCol) {
      pendingNames.push('20260502053700_add_ar_account_to_deliveries.js');
    }
    if (hasCategoryCol) {
      pendingNames.push('20260527000000_upgrade_accounts_schema.js');
    }

    for (const name of pendingNames) {
      const exists = migrations.find(m => m.name === name);
      if (!exists) {
        console.log(`Inserting migration log for ${name}`);
        await db('knex_migrations').insert({
          name: name,
          batch: 1,
          migration_time: new Date()
        });
      }
    }

    console.log('Finished correcting migration logs!');
  } catch (err) {
    console.error('Error during migration fix:', err);
  } finally {
    process.exit();
  }
}

fix();
