const db = require('./src/config/db');
const { processPurchase, processAdjustment } = require('./src/services/inventory.service');
const inventoryModel = require('./src/models/inventory.model');

async function seed() {
  try {
    const company = await db('companies').first();
    const user = await db('users').first();

    console.log(`Using company ${company.name} and user ${user.email}`);

    // 1. Get required accounts
    const assetAcc = await db('accounts').where({ company_id: company.id, type: 'Asset' }).first();
    const cogsAcc = await db('accounts').where({ company_id: company.id, type: 'Expense' }).first();
    const revAcc = await db('accounts').where({ company_id: company.id, type: 'Revenue' }).first();
    const apAcc = await db('accounts').where({ company_id: company.id, type: 'Liability' }).first();

    if (!assetAcc || !cogsAcc || !revAcc || !apAcc) {
      throw new Error('Could not find all required account types in the database.');
    }

    // 2. Create Warehouse
    const [warehouse] = await db('warehouses').insert({
      company_id: company.id,
      name: 'Main Distribution Center',
      location: '123 Fake St, City',
    }).returning('*');

    console.log(`Created warehouse: ${warehouse.name}`);

    // 3. Create Product
    const [product] = await db('products').insert({
      company_id: company.id,
      sku: 'MAC-M5-MAX',
      name: 'MacBook Pro M3 Max 16"',
      description: 'Apple Silicon M3 Max, 36GB RAM, 1TB SSD',
      unit_of_measure: 'unit',
      cost_price: 2500.00,
      unit_price: 3499.00,
      reorder_level: 15,
      inventory_account_id: assetAcc.id,
      cogs_account_id: cogsAcc.id,
      revenue_account_id: revAcc.id,
    }).returning('*');

    console.log(`Created product: ${product.name}`);

    // 4. Record a Purchase (Adds stock + Journal Entry)
    const result = await processPurchase({
      companyId: company.id,
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: 50,
      unitCost: 2500.00,
      apAccountId: apAcc.id,
      userId: user.id,
      reference: 'PO-INITIAL-01',
      notes: 'Initial stock intake from Foxconn',
    });

    console.log(`Processed purchase: added ${result.newQuantity} units, generated journal entry ID ${result.journalEntry.id}`);

    // 5. Test manual adjustment
    const adjResult = await processAdjustment({
      companyId: company.id,
      productId: product.id,
      warehouseId: warehouse.id,
      adjustmentQty: -2,
      notes: 'Test item removal / QA defect',
      userId: user.id
    });

    console.log(`Processed manual adjustment: new quantity is ${adjResult.newQuantity}`);

    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error);
    process.exit(1);
  }
}

seed();
