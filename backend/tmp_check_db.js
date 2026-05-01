const db = require('./src/config/db');

async function check() {
  try {
    const sectors = await db('sectors').select('*');
    console.log('Sectors:', sectors);
    
    const deliveries = await db('deliveries').select('*').limit(10);
    console.log('Deliveries:', deliveries);
    
    const deliveryCount = await db('deliveries').count('* as count').first();
    console.log('Total Deliveries:', deliveryCount);

    const deliveredCount = await db('deliveries').where('status', 'DELIVERED').count('* as count').first();
    console.log('DELIVERED Deliveries:', deliveredCount);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
