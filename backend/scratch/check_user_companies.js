const db = require('../src/config/db');

async function run() {
  console.log('=== DIAGNOSTICS: USER COMPANIES ===');
  try {
    const user = await db('users').where({ id: 2 }).first();
    console.log('\nUser info:', user);

    const userCompanies = await db('user_companies').where({ user_id: 2 });
    console.log('\nUser Companies Access:', userCompanies);

    const allCompanies = await db('companies').select('*');
    console.log('\nAll Companies:', allCompanies);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
