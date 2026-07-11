const db = require('../src/config/db');

async function run() {
  const assets = await db('assets').select('asset_code', 'asset_name');
  console.log('=== SEEDED FIXED ASSETS ===');
  assets.forEach(a => {
    console.log(`Code: ${a.asset_code} | Name: ${a.asset_name}`);
  });
  process.exit(0);
}

run();
