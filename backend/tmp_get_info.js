const db = require('./src/config/db');
async function run() {
  try {
    const company = await db('companies').first();
    const user = await db('users').first();
    console.log(JSON.stringify({ company, user }, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
