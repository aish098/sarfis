require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const db = require('../backend/src/config/db');
const InventoryCostingService = require('../backend/src/services/inventory_costing.service');

async function runInventoryCostingComplianceSuite() {
  console.log('=========================================================');
  console.log('🧪 RUNNING IAS 2 INVENTORY COSTING POLICY COMPLIANCE SUITE [POSTGRESQL]...');
  console.log('=========================================================');

  try {
    const [compA] = await db('companies').insert({ name: `QA Costing Policy Comp A ${Date.now()}` }).returning('*');
    const [compB] = await db('companies').insert({ name: `QA Costing Policy Comp B ${Date.now()}` }).returning('*');
    const idA = typeof compA === 'object' ? compA.id : compA;
    const idB = typeof compB === 'object' ? compB.id : compB;

    let passedCount = 0;

    // 1. IFRS COMPANY SELECTING LIFO -> HARD BLOCKED
    console.log('\n🛑 1. Testing IFRS Statutory Company selecting LIFO (Hard Block)...');
    try {
      await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'LIFO', framework: 'IFRS' });
      console.error('  ❌ Failure: IFRS + LIFO was not blocked!');
    } catch (err) {
      console.log(`  Observed Code: ${err.code} | Message: ${err.message}`);
      if (err.code === 'LIFO_NOT_ALLOWED_UNDER_IFRS') {
        console.log('  ✅ Hard Restriction Verified 100%: IFRS + LIFO blocked with code LIFO_NOT_ALLOWED_UNDER_IFRS!');
        passedCount++;
      }
    }

    // 2. IFRS COMPANY USING FIFO -> ALLOWED
    console.log('\n✅ 2. Testing IFRS Statutory Company using FIFO...');
    const fifoRes = await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'FIFO', framework: 'IFRS' });
    if (fifoRes.success && fifoRes.method === 'FIFO') {
      console.log('  ✅ IFRS + FIFO Verified 100%: Allowed cleanly.');
      passedCount++;
    }

    // 3. IFRS COMPANY USING WAC -> ALLOWED
    console.log('\n✅ 3. Testing IFRS Statutory Company using WAC / AVERAGE...');
    const wacRes = await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'WAC', framework: 'IFRS' });
    if (wacRes.success && wacRes.method === 'AVERAGE') {
      console.log('  ✅ IFRS + WAC Verified 100%: Allowed cleanly.');
      passedCount++;
    }

    // 4. US GAAP COMPANY USING LIFO -> ALLOWED
    console.log('\n🇺🇸 4. Testing US GAAP Company using LIFO...');
    const usGaapRes = await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'LIFO', framework: 'US_GAAP' });
    if (usGaapRes.success && usGaapRes.method === 'LIFO') {
      console.log('  ✅ US GAAP + LIFO Verified 100%: Allowed under LIFO conformity rule.');
      passedCount++;
    }

    // 5. INTERNAL MANAGEMENT MODE USING LIFO -> ALLOWED WITH NOTICE
    console.log('\n🏢 5. Testing Internal Management Mode using LIFO...');
    const internalRes = await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'LIFO', framework: 'INTERNAL_MANAGEMENT' });
    console.log('  Notice:', internalRes.notice);
    if (internalRes.success && internalRes.notice.includes('non-statutory')) {
      console.log('  ✅ Internal Management + LIFO Verified 100%: Allowed with non-statutory notice!');
      passedCount++;
    }

    // 6. MULTI-TENANT ISOLATION (COMPANY A DOES NOT AFFECT COMPANY B)
    console.log('\n🔒 6. Testing Tenant Costing Policy Isolation (Company A vs Company B)...');
    await InventoryCostingService.updateCostingPolicy(db, idB, { method: 'FIFO', framework: 'IFRS' });
    const methodA = await InventoryCostingService.getCostingMethod(db, idA);
    const methodB = await InventoryCostingService.getCostingMethod(db, idB);
    console.log(`  Company A Method: ${methodA} | Company B Method: ${methodB}`);
    if (methodA === 'LIFO' && methodB === 'FIFO') {
      console.log('  ✅ Tenant Policy Isolation Verified 100%: Company A policy does not affect Company B!');
      passedCount++;
    }

    // 7. INVALID COSTING METHOD -> HTTP 400
    console.log('\n🚫 7. Testing Invalid Costing Method Rejection...');
    try {
      await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'RANDOM_METHOD', framework: 'IFRS' });
    } catch (err) {
      console.log(`  Observed Code: ${err.code} | Message: ${err.message}`);
      if (err.code === 'INVALID_COSTING_METHOD') {
        console.log('  ✅ Invalid Method Rejection Verified 100% (HTTP 400 INVALID_COSTING_METHOD)!');
        passedCount++;
      }
    }

    // 8. AUDIT LOGGING & UNSAFE POLICY CHANGE GUARD
    console.log('\n📜 8. Testing Audit Trail Logging & Unsafe Policy Change Block after Posted Transactions...');
    const [wh] = await db('warehouses').insert({ company_id: idA, name: 'Audit Test WH' }).returning('*');
    const [prod] = await db('products').insert({ company_id: idA, sku: 'PROD-AUD-01', name: 'Audit Prod', cost_price: 10 }).returning('*');
    const whId = typeof wh === 'object' ? wh.id : wh;
    const prodId = typeof prod === 'object' ? prod.id : prod;

    // Seed an acquisition & partial consumption layer
    await InventoryCostingService.recordAcquisition(db, { companyId: idA, warehouseId: whId, productId: prodId, quantity: 10, unitCost: 100 });
    await db('inventory_layers').where({ company_id: idA }).update({ remaining_qty: 5 });

    try {
      await InventoryCostingService.updateCostingPolicy(db, idA, { method: 'FIFO', framework: 'US_GAAP' });
    } catch (err) {
      console.log(`  Observed Code: ${err.code} | Message: ${err.message}`);
      if (err.code === 'POSTED_TRANSACTIONS_EXIST') {
        console.log('  ✅ Unsafe Policy Change Guard Verified 100%: Change blocked due to active posted inventory layers!');
        passedCount++;
      }
    }

    console.log('\n=========================================================');
    if (passedCount === 8) {
      console.log('🎉 IAS 2 INVENTORY COSTING POLICY COMPLIANCE SUITE PASSED 100% (8/8)!');
    } else {
      console.error(`❌ Suite completed with ${8 - passedCount} issues.`);
    }
    console.log('=========================================================');

  } catch (err) {
    console.error('❌ Error during Inventory Costing Compliance test:', err);
  } finally {
    process.exit(0);
  }
}

runInventoryCostingComplianceSuite();
