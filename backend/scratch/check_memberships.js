const db = require('../src/config/db');
async function run() {
  try {
    const users = await db('users').select('id', 'email', 'role');
    const companies = await db('companies').select('id', 'name');
    const memberships = await db('company_users').select('*');
    console.log(JSON.stringify({ users, companies, memberships }, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
