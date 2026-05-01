const db = require('../src/config/db');
async function run() {
  try {
    const clients = await db('clients').select('*');
    const products = await db('products').select('*');
    const warehouses = await db('warehouses').select('*');
    const inventory = await db('inventory').select('*');
    console.log(JSON.stringify({ clients, products, warehouses, inventory }, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
