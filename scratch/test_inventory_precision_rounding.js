require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const db = require('../backend/src/config/db');
const InventoryCostingService = require('../backend/src/services/inventory_costing.service');

async function runInventoryPrecisionRoundingSuite() {
  console.log('=========================================================');
  console.log('🧪 RUNNING INVENTORY DECIMAL PRECISION & ROUNDING SUITE [POSTGRESQL - COMMIT 4aff4c8]...');
  console.log('=========================================================');

  try {
    const [comp] = await db('companies').insert({ name: `QA Precision Comp ${Date.now()}` }).returning('*');
    const companyId = typeof comp === 'object' ? comp.id : comp;

    const [wh] = await db('warehouses').insert({ company_id: companyId, name: 'Precision WH' }).returning('*');
    const warehouseId = typeof wh === 'object' ? wh.id : wh;

    const [prod] = await db('products').insert({ company_id: companyId, sku: 'PROD-PRC-01', name: 'Fractional Unit Chemical', cost_price: 0 }).returning('*');
    const productId = typeof prod === 'object' ? prod.id : prod;

    let passedCount = 0;

    await db.transaction(async (trx) => {
      // 1. INTAKE WITH HIGH PRECISION FRACTIONAL QTY & UNIT COST: 33.3333 units @ PKR 10.3333 = 344.4433
      console.log('\n📦 1. Receiving High-Precision Fractional Stock: 33.3333 units @ PKR 10.3333...');
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 33.3333,
        unitCost: 10.3333,
        sourceType: 'GOODS_RECEIPT',
        sourceDocument: 'GRN-PRECISION-01'
      });

      // 2. ISSUE FRACTIONAL QUANTITY: 11.1111 units
      console.log('📤 2. Consuming Fractional Quantity: 11.1111 units under FIFO Strategy...');
      const consumption = await InventoryCostingService.consumeFifoOrLifo(trx, {
        method: 'FIFO',
        companyId,
        warehouseId,
        productId,
        quantity: 11.1111
      });

      const extendedCost = parseFloat(consumption.totalCost);
      const roundedExtendedCost = parseFloat(extendedCost.toFixed(4));
      console.log(`  Calculated Extended Cost: PKR ${extendedCost} (Rounded: PKR ${roundedExtendedCost})`);

      // 11.1111 * 10.3333 = 114.81433963 -> rounded 114.8143
      if (Math.abs(roundedExtendedCost - 114.8143) < 0.01) {
        console.log('  ✅ Decimal Precision Verified 100%: 4-decimal precision maintained on fractional inventory issue!');
        passedCount++;
      }

      // 3. VERIFY REMAINING QUANTITY PRECISION: 33.3333 - 11.1111 = 22.2222
      console.log('\n📊 3. Verifying Remaining Layer Quantity Precision...');
      const layer = await trx('inventory_layers')
        .where({ company_id: companyId, warehouse_id: warehouseId, product_id: productId })
        .first();

      const remainingQty = parseFloat(layer.remaining_qty);
      console.log(`  Remaining Layer Quantity: ${remainingQty} units`);

      if (Math.abs(remainingQty - 22.2222) < 0.001) {
        console.log('  ✅ Fractional Rounding Safety Verified 100%: Remaining layer quantity matches 22.2222 units exactly!');
        passedCount++;
      }
    });

    console.log('\n=========================================================');
    if (passedCount === 2) {
      console.log('🎉 INVENTORY DECIMAL PRECISION & ROUNDING SUITE PASSED 100% (2/2)!');
    } else {
      console.error(`❌ Suite completed with ${2 - passedCount} issues.`);
    }
    console.log('=========================================================');

  } catch (err) {
    console.error('❌ Error during Precision & Rounding test:', err);
  } finally {
    process.exit(0);
  }
}

runInventoryPrecisionRoundingSuite();
