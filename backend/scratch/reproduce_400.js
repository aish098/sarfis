const axios = require('axios');
async function run() {
  try {
    const payload = {
      clientId: "4",
      sectorId: "", // Typical frontend empty select
      warehouseId: "7",
      deliveryDate: "2026-04-21",
      arAccountId: "2",
      notes: "Test failure",
      items: [
        { product_id: "8", quantity: "12", unit_price: "2499.00", unit_cost: "1800.00" }
      ]
    };
    
    // Simulate what happens in the service if sectorId is ""
    const response = await axios.post('http://localhost:5001/api/deliveries/1', payload);
    console.log("Success:", response.data);
  } catch (err) {
    console.error("Failure:", err.response?.data || err.message);
  }
}
run();
