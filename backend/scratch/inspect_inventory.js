const db = require('../src/config/db');

async function checkProductAccounts() {
  try {
    const list = await db('products').select('id', 'name', 'sku', 'inventory_account_id');
    console.log("Products and their inventory accounts:");
    console.log(list);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkProductAccounts();
