const db = require('../src/config/db');

async function run() {
  const periods = await db('accounting_periods')
    .where({ company_id: 2 })
    .orderBy('start_date', 'asc');
  
  console.log('=== FISCAL PERIODS FOR COMPANY ID 2 ===');
  periods.forEach(p => {
    console.log(`Period: ${p.code} | Start: ${p.start_date.toISOString().split('T')[0]} | End: ${p.end_date.toISOString().split('T')[0]} | Status: ${p.status}`);
  });
  
  process.exit(0);
}

run();
