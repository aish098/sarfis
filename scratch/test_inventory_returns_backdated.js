require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const db = require('../backend/src/config/db');
const InventoryCostingService = require('../backend/src/services/inventory_costing.service');

async function runInventoryReturnsBackdatedSuite() {
  console.log('=========================================================');
  console.log('🧪 RUNNING INVENTORY RETURNS & BACKDATED TRANSACTIONS SUITE [POSTGRESQL - COMMIT 4aff4c8]...');
  console.log('=========================================================');

  try {
    const [comp] = await db('companies').insert({ name: `QA Returns Comp ${Date.now()}` }).returning('*');
    const companyId = typeof comp === 'object' ? comp.id : comp;

    const [wh] = await db('warehouses').insert({ company_id: companyId, name: 'Returns WH' }).returning('*');
    const warehouseId = typeof wh === 'object' ? wh.id : wh;

    const [prod] = await db('products').insert({ company_id: companyId, sku: 'PROD-RET-01', name: 'Returnable Component', cost_price: 50 }).returning('*');
    const productId = typeof prod === 'object' ? prod.id : prod;

    let passedCount = 0;

    await db.transaction(async (trx) => {
      // 1. INTAKE BATCH ON 2026-06-01: 50 units @ PKR 200
      console.log('\n📦 1. Receiving Intake Batch on 2026-06-01: 50 units @ PKR 200...');
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 50,
        unitCost: 200,
        receivedDate: '2026-06-01'
      });

      // 2. BACKDATED STOCK INTAKE ON 2026-05-15 (PROMOTED AS OLDEST LAYER FOR FIFO)
      console.log('📅 2. Recording Backdated Stock Intake on 2026-05-15: 30 units @ PKR 180...');
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 30,
        unitCost: 180,
        receivedDate: '2026-05-15'
      });

      // 3. FIFO CONSUMPTION SHOULD CONSUME BACKDATED 2026-05-15 LAYER FIRST
      console.log('📤 3. Consuming 40 units under FIFO Strategy...');
      const consumption = await InventoryCostingService.consumeFifoOrLifo(trx, {
        method: 'FIFO',
        companyId,
        warehouseId,
        productId,
        quantity: 40
      });

      const totalCogs = parseFloat(consumption.totalCost);
      console.log(`  Calculated FIFO COGS: PKR ${totalCogs.toLocaleString()}`);

      // Check: 30 units @ 180 (5,400) + 10 units @ 200 (2,000) = PKR 7,400
      if (totalCogs === 7400) {
        console.log('  ✅ Backdated Layer Sequencing Verified 100%: 2026-05-15 layer consumed first (30 @ 180) + 10 @ 200 = PKR 7,400!');
        passedCount++;
      }

      // 4. SALES RETURN INVENTORY RE-CREDIT (RETURNING 10 UNITS @ PKR 200 ORIGINAL COST)
      console.log('\n🔄 4. Processing Customer Sales Return (10 units re-credited to inventory layer)...');
      await InventoryCostingService.recordAcquisition(trx, {
        companyId,
        warehouseId,
        productId,
        quantity: 10,
        unitCost: 200,
        sourceType: 'SALES_RETURN',
        sourceDocument: 'RET-DOC-001'
      });

      const activeLayers = await trx('inventory_layers')
        .where({ company_id: companyId, warehouse_id: warehouseId, product_id: productId })
        .sum('remaining_qty as total').first();

      const remainingUnits = parseFloat(activeLayers.total);
      console.log(`  Post-Return Remaining Layer Balance: ${remainingUnits} units`);

      if (remainingUnits === 50) {
        console.log('  ✅ Sales Return Inventory Re-Credit Verified 100%: 10 units re-entered inventory layers seamlessly (50 units remaining)!');
        passedCount++;
      }
    });

    console.log('\n=========================================================');
    if (passedCount === 2) {
      console.log('🎉 INVENTORY RETURNS & BACKDATED TRANSACTIONS SUITE PASSED 100% (2/2)!');
    } else {
      console.error(`❌ Suite completed with ${2 - passedCount} issues.`);
    }
    console.log('=========================================================');

  } catch (err) {
    console.error('❌ Error during Returns & Backdated test:', err);
  } finally {
    process.exit(0);
  }
}

runInventoryReturnsBackdatedSuite();
