const db = require('./src/config/db');
const { seedCompanyCoa } = require('./seed_coa');

async function seedAllEmptyCompanies() {
  console.log('Checking for companies with no Chart of Accounts...');
  try {
    const res = await db.query(`
      SELECT id, name FROM companies 
      WHERE id NOT IN (SELECT DISTINCT company_id FROM accounts)
    `);

    if (res.rows.length === 0) {
      console.log('All companies already have at least one account.');
      process.exit(0);
    }

    console.log(`Found ${res.rows.length} companies with no accounts. Seeding now...`);

    for (const company of res.rows) {
      await seedCompanyCoa(company.id);
      console.log(`- Seeded CoA for: ${company.name} (ID: ${company.id})`);
    }

    console.log('Finished seeding existing companies.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding existing companies failed:', err);
    process.exit(1);
  }
}

seedAllEmptyCompanies();
