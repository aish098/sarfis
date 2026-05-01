const db = require('../src/config/db');
async function run() {
  try {
    const a = await db('accounts').where({ company_id: 1 }).limit(5);
    console.log(JSON.stringify(a, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
