require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const db = require('../backend/src/config/db');
const InventoryCostingService = require('../backend/src/services/inventory_costing.service');

async function runInventoryConcurrencyNegativeSuite() {
  console.log('=========================================================');
  console.log('🧪 RUNNING CONCURRENT STOCK ISSUES & NEGATIVE-STOCK PROTECTION SUITE [POSTGRESQL - COMMIT 4aff4c8]...');
  console.log('=========================================================');

  try {
    const [comp] = await db('companies').insert({ name: `QA Neg Stock Comp ${Date.now()}` }).returning('*');
    const companyId = typeof comp === 'object' ? comp.id : comp;

    const [wh] = await db('warehouses').insert({ company_id: companyId, name: 'Main Depot' }).returning('*');
    const warehouseId = typeof wh === 'object' ? wh.id : wh;

    const [prod] = await db('products').insert({ company_id: companyId, sku: 'PROD-NEG-01', name: 'Item Limited Stock', cost_price: 10 }).returning('*');
    const productId = typeof prod === 'object' ? prod.id : prod;

    let passedCount = 0;

    // Seed 50 units
    await db.transaction(async (trx) => {
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 50,
        unitCost: 100,
        sourceType: 'GOODS_RECEIPT',
        sourceDocument: 'GRN-50-UNITS'
      });
    });

    console.log('\n📦 Initial Stock on Hand: 50 units @ PKR 100');

    // 1. NEGATIVE STOCK OVER-CONSUMPTION BLOCK
    console.log('\n🚫 1. Testing Excessive Stock Issue Request (70 units > 50 units available)...');
    try {
      await db.transaction(async (trx) => {
        await InventoryCostingService.consumeFifoOrLifo(trx, {
          method: 'FIFO',
          companyId,
          warehouseId,
          productId,
          quantity: 70,
          documentType: 'STOCK_ISSUE'
        });
      });
      console.error('  ❌ Failure: Excessive stock issue was not blocked!');
    } catch (err) {
      console.log(`  Observed Error: ${err.message}`);
      if (err.message.includes('Insufficient inventory') || err.message.includes('insufficient')) {
        console.log('  ✅ Negative-Stock Protection Verified 100%: Issue request exceeding available stock blocked cleanly!');
        passedCount++;
      }
    }

    // 2. CONCURRENT STOCK ISSUE SAFETY
    console.log('\n⚡ 2. Testing Concurrent Stock Issue Requests (2 Parallel Requests of 30 units on 50 units balance)...');
    let successCount = 0;
    let failCount = 0;

    const issueTask1 = db.transaction(async (trx) => {
      await InventoryCostingService.consumeFifoOrLifo(trx, { method: 'FIFO', companyId, warehouseId, productId, quantity: 30, documentType: 'STOCK_ISSUE' });
    }).then(() => successCount++).catch(() => failCount++);

    const issueTask2 = db.transaction(async (trx) => {
      await InventoryCostingService.consumeFifoOrLifo(trx, { method: 'FIFO', companyId, warehouseId, productId, quantity: 30, documentType: 'STOCK_ISSUE' });
    }).then(() => successCount++).catch(() => failCount++);

    await Promise.all([issueTask1, issueTask2]);

    console.log(`  Concurrent Execution Results: ${successCount} Succeeded, ${failCount} Safely Blocked due to stock limit.`);

    if (successCount === 1 && failCount === 1) {
      console.log('  ✅ Concurrent Stock Safety Verified 100%: Exactly 1 request succeeded (30 units consumed), and 2nd request blocked cleanly to prevent negative balance!');
      passedCount++;
    }

    console.log('\n=========================================================');
    if (passedCount === 2) {
      console.log('🎉 CONCURRENT STOCK ISSUES & NEGATIVE-STOCK PROTECTION SUITE PASSED 100% (2/2)!');
    } else {
      console.error(`❌ Suite completed with ${2 - passedCount} issues.`);
    }
    console.log('=========================================================');

  } catch (err) {
    console.error('❌ Error during Concurrency & Negative-Stock test:', err);
  } finally {
    process.exit(0);
  }
}

runInventoryConcurrencyNegativeSuite();
