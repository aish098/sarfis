const db = require('./src/config/db');
const AccountModel = require('./src/models/account.model');

async function testUpdate() {
  try {
    const company = await db('companies').first();
    const account = await db('accounts').where({ company_id: company.id }).first();
    
    console.log("Updating account:", account.id, account.name);

    const updated = await AccountModel.update(account.id, company.id, {
      name: account.name + ' Updated',
      category: account.category,
      code: account.code,
      normal_balance: 'Credit',
      is_contra: true
    });

    console.log("Updated account:", updated);
    process.exit(0);
  } catch(err) {
    console.error("Error during update:", err);
    process.exit(1);
  }
}

testUpdate();
