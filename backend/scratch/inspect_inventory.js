const db = require('../src/config/db');

async function getAccountIds() {
  try {
    for (const cid of [1, 11]) {
      console.log(`\n=== ACCOUNT DETAILS FOR COMPANY ${cid} ===`);
      const inv = await db('accounts').where({ company_id: cid, code: '1200' }).first();
      const re = await db('accounts').where({ company_id: cid, code: '3210' }).first();
      console.log(`Inventory (1200) ID: ${inv ? inv.id : 'N/A'}, Balance: ${inv ? inv.balance : 0}`);
      console.log(`Retained Earnings (3210) ID: ${re ? re.id : 'N/A'}, Balance: ${re ? re.balance : 0}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

getAccountIds();
