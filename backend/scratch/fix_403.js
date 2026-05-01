const db = require('../src/config/db');
async function run() {
  try {
    const users = await db('users').select('id');
    const companies = await db('companies').select('id');
    
    for (const user of users) {
      for (const company of companies) {
        const exists = await db('company_users')
          .where({ user_id: user.id, company_id: company.id })
          .first();
          
        if (!exists) {
          await db('company_users').insert({
            user_id: user.id,
            company_id: company.id,
            role: 'Company Admin'
          });
          console.log(`Added user ${user.id} to company ${company.id}`);
        }
      }
    }
    console.log('All users linked to all companies.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
