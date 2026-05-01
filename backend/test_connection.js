const db = require('./src/config/db');

async function test() {
  try {
    const companies = await db('companies').select('id', 'name').limit(1);
    console.log('Connected! Companies:', companies);
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

test();
