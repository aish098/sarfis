const http = require('http');

const payload = JSON.stringify({
  clientId: "4",
  sectorId: "", 
  warehouseId: "7",
  deliveryDate: "2026-04-21",
  arAccountId: "2",
  notes: "Test failure",
  items: [
    { product_id: "8", quantity: "12", unit_price: "2499.00", unit_cost: "1800.00" }
  ]
});

const req = http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/deliveries/1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    'x-company-id': '1'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});

req.write(payload);
req.end();
