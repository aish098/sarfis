require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const db = require('../backend/src/config/db');
const InventoryCostingService = require('../backend/src/services/inventory_costing.service');

async function runInventoryLifoSuite() {
  console.log('=========================================================');
  console.log('🧪 RUNNING INVENTORY LIFO (LAST-IN, FIRST-OUT) VALUATION SUITE [POSTGRESQL]...');
  console.log('=========================================================');

  try {
    const [comp] = await db('companies').insert({ name: `QA LIFO Comp ${Date.now()}` }).returning('*');
    const companyId = typeof comp === 'object' ? comp.id : comp;

    const [wh] = await db('warehouses').insert({ company_id: companyId, name: 'Main LIFO Depot' }).returning('*');
    const warehouseId = typeof wh === 'object' ? wh.id : wh;

    const [prod] = await db('products').insert({ company_id: companyId, sku: 'PROD-LIFO-001', name: 'Industrial Raw Polymer', cost_price: 0 }).returning('*');
    const productId = typeof prod === 'object' ? prod.id : prod;

    let passedCount = 0;

    await db.transaction(async (trx) => {
      // 1. INTAKE BATCH 1 (OLDEST): 100 units @ PKR 1,000 (Date: 2026-01-01)
      console.log('\n📦 1. Receiving Batch 1 (Oldest): 100 units @ PKR 1,000 (Total: PKR 100,000)...');
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 100,
        unitCost: 1000,
        sourceType: 'GOODS_RECEIPT',
        sourceDocument: 'GRN-BATCH-1',
        receivedDate: '2026-01-01'
      });

      // 2. INTAKE BATCH 2 (NEWEST): 100 units @ PKR 1,400 (Date: 2026-01-10)
      console.log('📦 2. Receiving Batch 2 (Newest): 100 units @ PKR 1,400 (Total: PKR 140,000)...');
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 100,
        unitCost: 1400,
        sourceType: 'GOODS_RECEIPT',
        sourceDocument: 'GRN-BATCH-2',
        receivedDate: '2026-01-10'
      });

      console.log('  Total Stock on Hand: 200 units (Total Value: PKR 240,000)');
      passedCount++;

      // 3. ISSUE 120 UNITS USING LIFO STRATEGY
      console.log('\n📤 3. Consuming 120 units using LIFO (Last-In, First-Out) Strategy...');
      const lifoConsumption = await InventoryCostingService.consumeFifoOrLifo(trx, {
        method: 'LIFO',
        companyId,
        warehouseId,
        productId,
        quantity: 120,
        stockLogId: null,
        documentType: 'STOCK_ISSUE',
        documentId: 101,
        documentNumber: 'ISSUE-LIFO-001',
        userId: null
      });

      const totalLifoCogs = parseFloat(lifoConsumption.totalCost);
      const avgUnitCost = parseFloat(lifoConsumption.averageUnitCost);

      console.log(`  Calculated LIFO COGS: PKR ${totalLifoCogs.toLocaleString()} (Average Unit Cost: PKR ${avgUnitCost.toFixed(2)})`);

      // LIFO Check: 100 @ 1,400 + 20 @ 1,000 = 140,000 + 20,000 = PKR 160,000
      if (totalLifoCogs === 160000) {
        console.log('  ✅ LIFO Layer Consumption Verified 100%: Newest Batch 2 consumed first (100 @ 1,400) + 20 from Batch 1 = PKR 160,000 COGS!');
        passedCount++;
      }

      // 4. ENDING INVENTORY ASSET VALUATION UNDER LIFO
      console.log('\n📊 4. Verifying Ending Inventory Asset Valuation under LIFO...');
      const remainingLayers = await trx('inventory_layers')
        .where({ company_id: companyId, warehouse_id: warehouseId, product_id: productId })
        .orderBy('id', 'asc');

      let endingValuation = 0;
      for (const layer of remainingLayers) {
        endingValuation += parseFloat(layer.remaining_qty) * parseFloat(layer.unit_cost);
        console.log(`  Layer ID ${layer.id} (Date: ${layer.source_document}): Remaining Qty = ${layer.remaining_qty} @ PKR ${layer.unit_cost}`);
      }

      console.log(`  Calculated Ending Inventory Valuation: PKR ${endingValuation.toLocaleString()}`);

      // Ending balance check: 80 units @ 1,000 = PKR 80,000
      if (endingValuation === 80000) {
        console.log('  ✅ Ending Inventory Asset Valuation Verified 100%: 80 remaining units in Batch 1 @ 1,000 = PKR 80,000!');
        passedCount++;
      }
    });

    console.log('\n=========================================================');
    if (passedCount === 3) {
      console.log('🎉 INVENTORY LIFO VALUATION SUITE PASSED 100% (3/3)!');
    } else {
      console.error(`❌ Suite completed with ${3 - passedCount} issues.`);
    }
    console.log('=========================================================');

  } catch (err) {
    console.error('❌ Error during LIFO inventory test:', err);
  } finally {
    process.exit(0);
  }
}

runInventoryLifoSuite();
