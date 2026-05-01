const db = require('../src/config/db');
async function run() {
  try {
    const t = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(t.rows.map(r => r.table_name));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
