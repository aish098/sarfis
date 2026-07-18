const db = require('../src/config/db');
const InventoryCostingService = require('../src/services/inventory_costing.service');
const SettingsModel = require('../src/models/settings.model');

async function runCostingTest() {
  console.log('=========================================================');
  console.log('    SARFIS ERP UAT - INVENTORY COSTING METHODS TESTS    ');
  console.log('=========================================================');

  const companyId = 1;
  const warehouseId = 1; // Default
  const userId = 1;

  try {
    // 1. Cleanup
    await db('inventory_layer_consumptions').delete();
    await db('inventory_layers').delete();
    await db('stock_logs').delete();
    await db('inventory').delete();
    await db('products').where({ sku: 'TEST-COSTING-PROD' }).delete();

    // 2. Create product
    const [productId] = await db('products').insert({
      company_id: companyId,
      sku: 'TEST-COSTING-PROD',
      name: 'UAT Costing Steel Pipe',
      unit_price: 100,
      cost_price: 10,
      unit_of_measure: 'unit',
      is_active: true
    }).returning('id');

    const cleanProdId = typeof productId === 'object' ? productId.id : productId;

    // Helper to simulate purchases
    async function addPurchase(qty, unitCost, docNum) {
      await db.transaction(async (trx) => {
        // Record layer
        await InventoryCostingService.recordAcquisition(trx, {
          companyId,
          warehouseId,
          productId: cleanProdId,
          quantity: qty,
          unitCost,
          sourceDocument: docNum,
          sourceType: 'voucher',
          userId
        });
        
        // Recalculate and update average cost on product for WAC purposes
        const stockSummary = await trx('inventory')
          .where('product_id', cleanProdId)
          .sum('quantity as total_qty')
          .first();
        const q_curr = parseFloat(stockSummary?.total_qty || 0);
        const product = await trx('products').where({ id: cleanProdId }).first();
        const c_curr = parseFloat(product.cost_price || 0);

        let newWAC = unitCost;
        if (q_curr + qty > 0) {
          newWAC = ((q_curr * c_curr) + (qty * unitCost)) / (q_curr + qty);
        }
        await trx('products').where({ id: cleanProdId }).update({ cost_price: newWAC });
        await trx('inventory').insert({
          warehouse_id: warehouseId,
          product_id: cleanProdId,
          quantity: qty
        }).onConflict(['warehouse_id', 'product_id']).merge({
          quantity: db.raw('inventory.quantity + ?', [qty])
        });
      });
    }

    // ==========================================
    // TEST CASE 1: FIFO Costing Calculation
    // ==========================================
    console.log('\n--- Test Scenario 1: FIFO ---');
    // Set policy to FIFO
    await db('company_accounting_settings')
      .where({ company_id: companyId })
      .update({ inventory_costing_method: 'FIFO' });

    // Clean layers
    await db('inventory_layers').delete();

    // Purchases:
    // A: 100 units @ $10.00
    // B: 50 units @ $12.00
    // C: 80 units @ $15.00
    await addPurchase(100, 10.00, 'PO-A');
    await addPurchase(50, 12.00, 'PO-B');
    await addPurchase(80, 15.00, 'PO-C');

    // Consume 120 units under FIFO
    await db.transaction(async (trx) => {
      // Mock stock log
      const [log] = await trx('stock_logs').insert({
        product_id: cleanProdId,
        warehouse_id: warehouseId,
        type: 'SALE',
        quantity_change: -120,
        quantity_after: 110,
        unit_cost: 0
      }).returning('*');
      const logId = typeof log === 'object' ? log.id : log;

      const result = await InventoryCostingService.consumeIssue(trx, {
        companyId,
        warehouseId,
        productId: cleanProdId,
        quantity: 120,
        documentType: 'voucher',
        documentNumber: 'SI-001',
        stockLogId: logId,
        userId
      });

      console.log(`COGS Calculated: $${result.totalCOGS} (Expected: $1240.00)`);
      console.log(`Blended Cost: $${result.blendedUnitCost}`);
      console.log('Consumptions:', result.consumptions);

      if (result.totalCOGS === 1240.00) {
        console.log('✅ FIFO Test Passed!');
      } else {
        console.error('❌ FIFO Test Failed!');
        process.exit(1);
      }
    });

    // ==========================================
    // TEST CASE 2: LIFO Costing Calculation
    // ==========================================
    console.log('\n--- Test Scenario 2: LIFO ---');
    // Reset layers and settings
    await db('inventory_layer_consumptions').delete();
    await db('inventory_layers').delete();
    await db('stock_logs').delete();

    // Set policy to LIFO
    await db('company_accounting_settings')
      .where({ company_id: companyId })
      .update({ inventory_costing_method: 'LIFO' });

    // Re-purchase
    await addPurchase(100, 10.00, 'PO-A');
    await addPurchase(50, 12.00, 'PO-B');
    await addPurchase(80, 15.00, 'PO-C');

    // Consume 120 units under LIFO
    await db.transaction(async (trx) => {
      const [log] = await trx('stock_logs').insert({
        product_id: cleanProdId,
        warehouse_id: warehouseId,
        type: 'SALE',
        quantity_change: -120,
        quantity_after: 110,
        unit_cost: 0
      }).returning('*');
      const logId = typeof log === 'object' ? log.id : log;

      const result = await InventoryCostingService.consumeIssue(trx, {
        companyId,
        warehouseId,
        productId: cleanProdId,
        quantity: 120,
        documentType: 'voucher',
        documentNumber: 'SI-002',
        stockLogId: logId,
        userId
      });

      // Expected LIFO consumption:
      // 80 units @ $15 = $1200
      // 40 units @ $12 = $480
      // Total = $1680.00
      console.log(`COGS Calculated: $${result.totalCOGS} (Expected: $1680.00)`);
      console.log(`Blended Cost: $${result.blendedUnitCost}`);
      console.log('Consumptions:', result.consumptions);

      if (result.totalCOGS === 1680.00) {
        console.log('✅ LIFO Test Passed!');
      } else {
        console.error('❌ LIFO Test Failed!');
        process.exit(1);
      }
    });

    // ==========================================
    // TEST CASE 3: Transaction Lock policy check
    // ==========================================
    console.log('\n--- Test Scenario 3: Transaction Settings Lock ---');
    try {
      // 1. Clear stock logs, set setting JSON to AVERAGE
      await db('stock_logs').delete();
      await SettingsModel.upsertSettings(companyId, { inventoryCostingMethod: 'AVERAGE' });

      // 2. Insert a transaction log to activate the lock
      await db('stock_logs').insert({
        product_id: cleanProdId,
        warehouse_id: warehouseId,
        type: 'SALE',
        quantity_change: -1,
        quantity_after: 0,
        unit_cost: 10
      });

      // 3. Try to change settings to FIFO (should fail)
      await SettingsModel.upsertSettings(companyId, { inventoryCostingMethod: 'FIFO' });
      console.error('❌ Policy Lock Failed! Expected throw error on upsertSettings, but it succeeded.');
      process.exit(1);
    } catch (lockError) {
      console.log(`✅ Lock enforcement caught expected error: "${lockError.message}"`);
      console.log('✅ Transaction settings lock verified successfully!');
    }

    console.log('\n=========================================================');
    console.log('         ALL INVENTORY COSTING TESTS PASSED              ');
    console.log('=========================================================');
    process.exit(0);

  } catch (error) {
    console.error('Test execution failed with error:', error);
    process.exit(1);
  }
}

runCostingTest();
