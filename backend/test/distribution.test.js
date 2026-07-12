const request = require('supertest');
const jwt = require('jsonwebtoken');
const assert = require('assert');
const app = require('../src/app');
const db = require('../src/config/db');

describe('Distribution API Integration Tests', () => {
  let token;
  let client_id;
  let warehouse_id;
  let product_id;
  let ar_account_id;

  before(async () => {
    // Generate valid admin test token
    token = jwt.sign(
      { 
        id: 1, 
        email: 'admin@sarfis.com', 
        role: 'ADMIN', 
        company_id: 1,
        permissions: ['user.manage']
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    // Get a valid client
    const client = await db('clients').where({ company_id: 1 }).first();
    if (client) {
      client_id = client.id;
    } else {
      const [inserted] = await db('clients').insert({
        company_id: 1,
        name: 'Test Client',
        credit_limit: 50000.00,
        current_balance: 0.00
      }).returning('id');
      client_id = typeof inserted === 'object' ? inserted.id : inserted;
    }

    // Get a valid warehouse
    const warehouse = await db('warehouses').where({ company_id: 1 }).first();
    if (warehouse) {
      warehouse_id = warehouse.id;
    } else {
      const [inserted] = await db('warehouses').insert({
        company_id: 1,
        name: 'Test Warehouse',
        location: 'Test Location'
      }).returning('id');
      warehouse_id = typeof inserted === 'object' ? inserted.id : inserted;
    }

    // Get a valid product
    const product = await db('products').where({ company_id: 1 }).first();
    if (product) {
      product_id = product.id;
    } else {
      const [inserted] = await db('products').insert({
        company_id: 1,
        sku: 'TESTPROD',
        name: 'Test Product',
        unit_price: 150.00,
        cost_price: 100.00,
        quantity: 500.00
      }).returning('id');
      product_id = typeof inserted === 'object' ? inserted.id : inserted;
    }

    // Get a valid AR asset account
    const account = await db('accounts').where({ company_id: 1, category: 'Asset' }).first();
    if (account) {
      ar_account_id = account.id;
    } else {
      const [inserted] = await db('accounts').insert({
        company_id: 1,
        code: '1200',
        name: 'Accounts Receivable',
        category: 'Asset',
        type: 'Detail',
        parent_id: null,
        balance: 0.00
      }).returning('id');
      ar_account_id = typeof inserted === 'object' ? inserted.id : inserted;
    }

    // Ensure inventory record exists with sufficient stock
    const stock = await db('inventory').where({ product_id, warehouse_id }).first();
    if (stock) {
      await db('inventory').where({ product_id, warehouse_id }).update({ quantity: 100.00 });
    } else {
      await db('inventory').insert({
        product_id,
        warehouse_id,
        quantity: 100.00
      });
    }
  });

  describe('Post and GET deliveries with discount/offer details', () => {
    it('creates a new delivery order with discount and offer and moves it through status transitions', async () => {
      const payload = {
        clientId: client_id,
        warehouseId: warehouse_id,
        arAccountId: ar_account_id,
        deliveryDate: new Date().toISOString().split('T')[0],
        notes: 'Test note for delivery',
        items: [
          {
            product_id: product_id,
            quantity: 5,
            unit_price: 100.00,
            unit_cost: 60.00,
            discount: 10.00,
            offer: 'Buy 5 get $10 off'
          }
        ]
      };

      const res = await request(app)
        .post('/api/deliveries/1')
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .send(payload)
        .expect(201);

      assert.ok(res.body.id, 'Should return created order ID');
      const orderId = res.body.id;

      // Verify the saved details from DB
      const detailRes = await request(app)
        .get(`/api/deliveries/1/${orderId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .expect(200);

      assert.strictEqual(detailRes.body.id, orderId);
      assert.strictEqual(parseFloat(detailRes.body.total_amount), 490.00); // 5 * 100 - 10
      assert.ok(detailRes.body.items && detailRes.body.items.length === 1);
      assert.strictEqual(parseFloat(detailRes.body.items[0].discount), 10.00);
      assert.strictEqual(detailRes.body.items[0].offer, 'Buy 5 get $10 off');

      // Test status transition (CONFIRMED)
      await request(app)
        .patch(`/api/deliveries/1/${orderId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .send({ status: 'CONFIRMED' })
        .expect(200);

      const statusRes1 = await db('deliveries').where({ id: orderId }).first();
      assert.strictEqual(statusRes1.status, 'CONFIRMED');

      // Test status transition (DISPATCHED)
      await request(app)
        .patch(`/api/deliveries/1/${orderId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .send({ status: 'DISPATCHED' })
        .expect(200);

      const statusRes2 = await db('deliveries').where({ id: orderId }).first();
      assert.strictEqual(statusRes2.status, 'DISPATCHED');
    });
  });
});
