const db = require('../src/config/db');
async function run() {
  try {
    // Attempting to insert NaN into a numeric column
    await db('deliveries').insert({
      company_id: 1,
      client_id: 4,
      warehouse_id: 7,
      delivery_number: 'TEST-NAN',
      total_amount: NaN, // THIS SHOULD FAIL
      delivery_date: new Date()
    });
    console.log("Success??");
    process.exit(0);
  } catch (err) {
    console.error("Failure:", err.message);
    process.exit(1);
  }
}
run();
