const db = require('../src/config/db');

async function main() {
  const companyUsers = await db('company_users').select('*');
  console.log('Company Users:');
  console.log(companyUsers);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
