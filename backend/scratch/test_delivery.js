const db = require('../src/config/db');
const distService = require('../src/services/distribution.service');

async function run() {
  try {
    // Testing with User 1's data for Company 1
    // Product 8 (Laptops), Client 4 (Global University), Wh 7 (Central Hub), Acc 2 (AR)
    const result = await distService.createDeliveryOrder({
      companyId: 1,
      clientId: 4,
      sectorId: 4,
      warehouseId: 7,
      items: [
        { product_id: 8, quantity: 12, unit_price: 2499.00, unit_cost: 1800.00 }
      ],
      deliveryDate: new Date(),
      notes: "Test delivery via script",
      arAccountId: 2,
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
