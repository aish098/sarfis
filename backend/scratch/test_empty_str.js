const db = require('../src/config/db');
const distService = require('../src/services/distribution.service');

async function run() {
  try {
    // Scenario: Empty strings (what the frontend select might send)
    const result = await distService.createDeliveryOrder({
      companyId: 1,
      clientId: "4",
      sectorId: "", 
      warehouseId: "7",
      items: [
        { product_id: "8", quantity: "12", unit_price: "2499.00", unit_cost: "1800.00" }
      ],
      deliveryDate: "2026-04-21",
      notes: "Test failure",
      arAccountId: "2",
      userId: 1
    });
    console.log("Success:", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Failure:", err.message);
    process.exit(1);
  }
}
run();
