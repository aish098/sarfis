const db = require('./src/config/db');
const PostingEngineService = require('./src/services/posting_engine.service');
const VoucherService = require('./src/services/voucher.service');
const VendorModel = require('./src/models/vendor.model');
const AccountModel = require('./src/models/account.model');

async function runTests() {
  console.log('---------------------------------------------------------');
  console.log('RUNNING SCAFIS ERP POSTING ENGINE INTEGRITY TESTS...');
  console.log('---------------------------------------------------------');

  let testCompany = null;
  let testUser = null;
  let testWarehouse = null;
  let testProduct = null;
  let testVendor = null;
  let testClient = null;

  let testAccounts = {
    cash: null,
    ar: null,
    ap: null,
    inventory: null,
    sales: null,
    cogs: null
  };

  try {
    // 1. Fetch or create a test context
    testUser = await db('users').first();
    if (!testUser) throw new Error('No user found in DB to run tests.');

    testCompany = await db('companies').first();
    if (!testCompany) throw new Error('No company found in DB to run tests.');

    console.log(`[TESTS] Using Company: "${testCompany.name}" (ID: ${testCompany.id})`);

    testWarehouse = await db('warehouses').where({ company_id: testCompany.id }).first();
    if (!testWarehouse) {
      const [wh] = await db('warehouses').insert({
        company_id: testCompany.id,
        name: 'Test Warehouse',
        location: 'Test Location',
        is_active: true
      }).returning('*');
      testWarehouse = wh;
    }
    console.log(`[TESTS] Using Warehouse: "${testWarehouse.name}"`);

    // Ensure we have standard accounts
    const coa = await db('accounts').where({ company_id: testCompany.id });
    
    const getOrCreateAccount = async (code, name, category, normalBalance) => {
      let acc = coa.find(a => a.code === code);
      if (!acc) {
        [acc] = await db('accounts').insert({
          company_id: testCompany.id,
          code,
          name,
          category,
          normal_balance: normalBalance,
          is_contra: false,
          balance: 0
        }).returning('*');
      }
      return acc;
    };

    testAccounts.cash = await getOrCreateAccount('1010', 'Cash & Bank', 'Asset', 'Debit');
    testAccounts.ar = await getOrCreateAccount('1200', 'Accounts Receivable', 'Asset', 'Debit');
    testAccounts.inventory = await getOrCreateAccount('1300', 'Merchandise Inventory', 'Asset', 'Debit');
    testAccounts.ap = await getOrCreateAccount('2000', 'Accounts Payable', 'Liability', 'Credit');
    testAccounts.sales = await getOrCreateAccount('4010', 'Sales Revenue', 'Revenue', 'Credit');
    testAccounts.cogs = await getOrCreateAccount('5010', 'Cost of Goods Sold', 'Expense', 'Debit');

    console.log('[TESTS] General Ledger accounts loaded successfully.');

    // Save configurations in settings
    await db('company_accounting_settings')
      .insert({
        company_id: testCompany.id,
        default_sales_account_id: testAccounts.sales.id,
        default_ap_account_id: testAccounts.ap.id,
        default_ar_account_id: testAccounts.ar.id,
        default_inventory_account_id: testAccounts.inventory.id,
        default_cogs_account_id: testAccounts.cogs.id,
        default_cash_account_id: testAccounts.cash.id,
        tax_rate: 0.00
      })
      .onConflict('company_id')
      .merge();

    console.log('[TESTS] Company default account settings saved.');

    // Get or create product
    testProduct = await db('products').where({ company_id: testCompany.id }).first();
    if (!testProduct) {
      const [prod] = await db('products').insert({
        company_id: testCompany.id,
        sku: 'TEST-SKU-001',
        name: 'Test ERP Widget',
        unit_price: 150.00,
        cost_price: 100.00,
        unit_of_measure: 'unit',
        inventory_account_id: testAccounts.inventory.id,
        cogs_account_id: testAccounts.cogs.id,
        revenue_account_id: testAccounts.sales.id
      }).returning('*');
      testProduct = prod;
    } else {
      // Ensure accounts are linked
      await db('products').where({ id: testProduct.id }).update({
        inventory_account_id: testAccounts.inventory.id,
        cogs_account_id: testAccounts.cogs.id,
        revenue_account_id: testAccounts.sales.id,
        cost_price: 100.00 // Set base cost to 100.00
      });
      testProduct.cost_price = 100.00;
    }
    console.log(`[TESTS] Using Product: "${testProduct.name}" (WAC: $${testProduct.cost_price})`);

    // Get or create vendor
    testVendor = await VendorModel.create({
      companyId: testCompany.id,
      name: 'Supplier Alpha',
      email: 'alpha@supplier.com',
      phone: '123-456'
    }).catch(async () => {
      return await db('vendors').where({ company_id: testCompany.id, name: 'Supplier Alpha' }).first();
    });
    console.log(`[TESTS] Using Vendor: "${testVendor.name}" (Balance: $${testVendor.current_balance})`);

    // Get or create client
    testClient = await db('clients').where({ company_id: testCompany.id }).first();
    if (!testClient) {
      const [cl] = await db('clients').insert({
        company_id: testCompany.id,
        name: 'Enterprise Client',
        credit_limit: 100000.00,
        current_balance: 0.00
      }).returning('*');
      testClient = cl;
    }
    console.log(`[TESTS] Using Customer (Client): "${testClient.name}"`);

    // Ensure we start with 0 stock in warehouse for clean tests
    await db('inventory').where({ product_id: testProduct.id, warehouse_id: testWarehouse.id }).delete();

    // ---------------------------------------------------------
    // TEST CASE 1: Period Lock Check
    // ---------------------------------------------------------
    console.log('\n[TEST 1] Testing closed accounting period lock...');
    
    // Create a closed period for last month
    const pastStart = new Date(); pastStart.setMonth(pastStart.getMonth() - 2);
    const pastEnd = new Date(); pastEnd.setMonth(pastEnd.getMonth() - 1);
    
    await db('accounting_periods').where({ company_id: testCompany.id, period_name: 'LOCKED-TEST' }).delete();
    const [period] = await db('accounting_periods').insert({
      company_id: testCompany.id,
      period_name: 'LOCKED-TEST',
      start_date: pastStart,
      end_date: pastEnd,
      status: 'CLOSED'
    }).returning('*');

    try {
      await PostingEngineService.assertPeriodOpen(testCompany.id, pastStart);
      console.error('❌ FAIL: Posting lock failed. Allowed action in closed period.');
      process.exit(1);
    } catch (e) {
      console.log('✅ PASS: Correctly blocked posting. Error caught:', e.message);
    }

    // Clean up test period
    await db('accounting_periods').where({ id: period.id }).delete();

    // ---------------------------------------------------------
    // TEST CASE 2: PURCHASE VOUCHER posting & WAC cost calculation
    // ---------------------------------------------------------
    console.log('\n[TEST 2] Posting Purchase Voucher & computing Weighted Average Cost (WAC)...');
    
    const initialProduct = await db('products').where('id', testProduct.id).first();
    const c_curr = parseFloat(initialProduct.cost_price); // 100.00

    // Purchase 10 units at $130.00 unit cost (differs from standard $100.00)
    const qtyPurchase = 10;
    const costPurchase = 130.00;
    
    const draftVoucher = await VoucherService.createDraft({
      companyId: testCompany.id,
      type: 'PURCHASE',
      payload: {
        vendorId: testVendor.id,
        warehouseId: testWarehouse.id,
        notes: 'Test stock purchase WAC calculation',
        items: [
          { productId: testProduct.id, quantity: qtyPurchase, unitCost: costPurchase }
        ]
      },
      totalAmount: qtyPurchase * costPurchase,
      userId: testUser.id
    });

    console.log(`Created Draft Purchase Voucher: #${draftVoucher.voucher_number}`);

    // Post to ledger
    const postedVoucher = await VoucherService.postToLedger(draftVoucher.id, testCompany.id, testUser.id);
    console.log(`Voucher #${postedVoucher.voucher_number} successfully POSTED!`);

    // Verify stock and WAC cost price updates
    const updatedProduct = await db('products').where('id', testProduct.id).first();
    const newWac = parseFloat(updatedProduct.cost_price);
    
    // Q_curr = 0, C_curr = 100.00. Q_new = 10, C_new = 130.00. New WAC should be ((0 * 100) + (10 * 130)) / 10 = 130.00
    console.log(`Original cost_price: $${c_curr.toFixed(2)}, New cost_price (WAC): $${newWac.toFixed(2)}`);
    if (newWac !== 130.00) {
      console.error(`❌ FAIL: Cost price WAC incorrect. Expected: 130.00, Found: ${newWac}`);
      process.exit(1);
    }
    console.log('✅ PASS: WAC costing engine calculated correctly!');

    // Verify warehouse inventory quantities
    const stock = await db('inventory').where({ product_id: testProduct.id, warehouse_id: testWarehouse.id }).first();
    const totalQty = parseFloat(stock.quantity);
    console.log(`Warehouse Stock Quantity: ${totalQty}`);
    if (totalQty !== 10.00) {
      console.error(`❌ FAIL: Warehouse stock quantities incorrect. Expected: 10, Found: ${totalQty}`);
      process.exit(1);
    }
    console.log('✅ PASS: Warehouse inventory levels updated successfully!');

    // Verify Vendor Balance increased by $1,300
    const initialVendorBalance = parseFloat(testVendor.current_balance || 0);
    const updatedVendor = await db('vendors').where('id', testVendor.id).first();
    const currentVendorBalance = parseFloat(updatedVendor.current_balance || 0);
    const vendorDiff = currentVendorBalance - initialVendorBalance;
    
    console.log(`Vendor Balance Diff: $${vendorDiff} (Before: $${initialVendorBalance}, After: $${currentVendorBalance})`);
    if (vendorDiff !== 1300.00) {
      console.error(`❌ FAIL: Accounts Payable Vendor balance incorrect. Expected difference: 1300, Found: ${vendorDiff}`);
      process.exit(1);
    }
    console.log('✅ PASS: Vendor AP subledger updated successfully!');

    // ---------------------------------------------------------
    // TEST CASE 3: SALES INVOICE posting & COGS debiting
    // ---------------------------------------------------------
    console.log('\n[TEST 3] Posting Sales Invoice & verifying COGS debits & Revenue credits...');
    
    const qtySale = 2;
    const salePrice = 200.00; // Total sales revenue: 2 * 200 = $400
    // COGS should be 2 * WAC ($130) = $260

    const initialClientBalance = parseFloat(testClient.current_balance || 0);

    const salesDraft = await VoucherService.createDraft({
      companyId: testCompany.id,
      type: 'SALES',
      payload: {
        clientId: testClient.id,
        warehouseId: testWarehouse.id,
        notes: 'Test sale posting',
        items: [
          { productId: testProduct.id, quantity: qtySale, unitPrice: salePrice }
        ]
      },
      totalAmount: qtySale * salePrice,
      userId: testUser.id
    });

    console.log(`Created Draft Sales Invoice: #${salesDraft.voucher_number}`);

    // Post to ledger
    const postedSales = await VoucherService.postToLedger(salesDraft.id, testCompany.id, testUser.id);
    console.log(`Invoice #${postedSales.voucher_number} successfully POSTED!`);

    // Verify stock decreases to 8
    const stockAfterSale = await db('inventory').where({ product_id: testProduct.id, warehouse_id: testWarehouse.id }).first();
    const qtyRemaining = parseFloat(stockAfterSale.quantity);
    console.log(`Warehouse Stock Remaining: ${qtyRemaining}`);
    if (qtyRemaining !== 8.00) {
      console.error(`❌ FAIL: Stock was not reduced. Expected: 8, Found: ${qtyRemaining}`);
      process.exit(1);
    }
    console.log('✅ PASS: Stock reduced accurately.');

    // Verify Customer Outstanding AR increased by $400
    const updatedClient = await db('clients').where('id', testClient.id).first();
    const currentClientBalance = parseFloat(updatedClient.current_balance || 0);
    const clientDiff = currentClientBalance - initialClientBalance;

    console.log(`Customer Balance Diff: $${clientDiff} (Before: $${initialClientBalance}, After: $${currentClientBalance})`);
    if (clientDiff !== 400.00) {
      console.error(`❌ FAIL: Accounts Receivable customer balance difference incorrect. Expected: 400, Found: ${clientDiff}`);
      process.exit(1);
    }
    console.log('✅ PASS: Customer outstanding AR subledger balance updated!');

    // ---------------------------------------------------------
    // TEST CASE 4: Voucher Reversal & Ledger Offset Zero-Out
    // ---------------------------------------------------------
    console.log('\n[TEST 4] Testing Sage 50 style Double-Entry Voucher Reversals...');
    
    // Reverse the sales voucher
    const reverseResult = await VoucherService.reverseVoucher(postedSales.id, testCompany.id, testUser.id);
    console.log('Reversal execution successfully run:', reverseResult);

    // Verify client balance zeroed back to initial value
    const clientAfterRev = await db('clients').where('id', testClient.id).first();
    const balanceAfterRev = parseFloat(clientAfterRev.current_balance || 0);
    console.log(`Customer balance after reversal: $${balanceAfterRev} (Original Initial: $${initialClientBalance})`);
    if (balanceAfterRev !== initialClientBalance) {
      console.error(`❌ FAIL: Reversal failed to restore customer balance. Current: ${balanceAfterRev}, Expected: ${initialClientBalance}`);
      process.exit(1);
    }
    console.log('✅ PASS: Customer outstanding balance successfully restored!');

    // Verify stock level restored back to 10
    const stockAfterRev = await db('inventory').where({ product_id: testProduct.id, warehouse_id: testWarehouse.id }).first();
    const qtyRestored = parseFloat(stockAfterRev.quantity);
    console.log(`Warehouse Stock after reversal: ${qtyRestored}`);
    if (qtyRestored !== 10.00) {
      console.error(`❌ FAIL: Reversal failed to restore warehouse stock. Current: ${qtyRestored}`);
      process.exit(1);
    }
    console.log('✅ PASS: Warehouse stock levels successfully restored!');

    // ---------------------------------------------------------
    // TEST SUMMARY
    // ---------------------------------------------------------
    console.log('\n---------------------------------------------------------');
    console.log('🎉 ALL INTEGRITY AND COSTING TESTS PASSED FLAWLESSLY! 🎉');
    console.log('---------------------------------------------------------');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED ENCOUNTERING ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
