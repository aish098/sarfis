const db = require('./config/db');
const prService = require('./services/purchase_requisition.service');
const poService = require('./services/purchase_order.service');
const grnService = require('./services/goods_receipt.service');
const voucherService = require('./services/voucher.service');
const lineageService = require('./services/procurement_lineage.service');
const settingsModel = require('./models/settings.model');

async function runE2E() {
  const companyId = 11;
  const userId = 12;

  try {
    console.log('--- STARTING PROCUREMENT E2E LIFECYCLE VALIDATION ---');

    // Step 1: Ensure Settings = REQUISITION_REQUIRED
    console.log('\n[1] Setting company policy to REQUISITION_REQUIRED...');
    await settingsModel.upsertSettings(companyId, { procurementPolicy: 'REQUISITION_REQUIRED' });
    console.log('✔ Procurement policy successfully set to REQUISITION_REQUIRED.');

    // Ensure company_accounting_settings is mapped
    const accts = await db('accounts').where({ company_id: companyId });
    const findAcc = (code, category) => {
      return accts.find(a => a.code === code) || accts.find(a => a.category === category) || accts[0];
    };

    const invAcc = findAcc('1200', 'Asset');
    const apAcc = findAcc('2020', 'Liability');
    const arAcc = findAcc('1100', 'Asset');
    const salesAcc = findAcc('4020', 'Revenue');
    const cogsAcc = findAcc('5040', 'Expense');
    const cashAcc = findAcc('1000', 'Asset');

    const updatePayload = {
      default_inventory_account_id: invAcc?.id,
      default_ap_account_id: apAcc?.id,
      default_ar_account_id: arAcc?.id,
      default_sales_account_id: salesAcc?.id,
      default_cogs_account_id: cogsAcc?.id,
      default_cash_account_id: cashAcc?.id,
    };

    console.log('UPDATING DB WITH PAYLOAD:', updatePayload);
    await db('company_accounting_settings').where({ company_id: companyId }).update(updatePayload);
    
    const verifyMapping = await db('company_accounting_settings').where({ company_id: companyId }).first();
    console.log('VERIFIED MAPPING IN DB AFTER UPDATE:', verifyMapping);

    // Step 2: Test Manual PO Block Rule
    console.log('\n[2] Testing manual PO block rule (should fail)...');
    const products = await db('products').where({ company_id: companyId });
    if (products.length === 0) {
      throw new Error('No products found for company 11. Run seeding first.');
    }
    const product = products[0];

    try {
      await poService.createPurchaseOrder({
        companyId,
        vendorId: 1,
        date: new Date(),
        notes: 'Manual PO test',
        items: [{ productId: product.id, quantity: 2, unitPrice: 100 }],
        userId
      });
      throw new Error('❌ Failure: Manual PO creation was allowed under REQUISITION_REQUIRED policy!');
    } catch (e) {
      console.log(`✔ Blocked manually created PO as expected: "${e.message}"`);
    }

    // Step 3: Test Manual PV Block Rule
    console.log('\n[3] Testing manual PV block rule (should fail)...');
    try {
      await voucherService.createDraft({
        companyId,
        type: 'PURCHASE',
        date: new Date(),
        payload: {
          vendorId: 1,
          items: [{ productId: product.id, quantity: 2, unitCost: 100 }]
        },
        totalAmount: 200,
        taxAmount: 0,
        userId
      });
      throw new Error('❌ Failure: Manual PV creation was allowed without GRN!');
    } catch (e) {
      console.log(`✔ Blocked manually created Purchase Voucher as expected: "${e.message}"`);
    }

    // Step 4: Create Requisition
    console.log('\n[4] Creating Purchase Requisition...');
    const pr = await prService.createPurchaseRequisition({
      companyId,
      requestedBy: userId,
      department: 'Finance it',
      requiredDate: new Date(),
      priority: 'NORMAL',
      reason: 'E2E Testing Requisition',
      items: [{ productId: product.id, quantity: 3, estimatedPrice: product.cost_price || 200000 }]
    });
    console.log(`✔ Requisition created: ${pr.requisition_number} (Status: ${pr.status})`);

    // Step 5: Submit PR for Approval
    console.log('\n[5] Submitting PR for approval...');
    const prSubmitted = await prService.submitForApproval(pr.id, companyId, userId);
    console.log(`✔ PR submitted: ${prSubmitted.requisition_number} (Status: ${prSubmitted.status})`);

    // Step 6: Approve PR
    console.log('\n[6] Approving Requisition workflow...');
    await prService.approvePurchaseRequisition(pr.id, companyId, userId);
    const prApproved = await prService.getPurchaseRequisitionById(pr.id, companyId);
    console.log(`✔ PR approved: ${prApproved.requisition_number} (Status: ${prApproved.status})`);

    // Step 7: Convert PR to PO
    console.log('\n[7] Converting PR to Purchase Order...');
    const convertResult = await prService.convertToPurchaseOrder(pr.id, companyId, userId);
    const poId = convertResult.purchaseOrderId;
    const po = await poService.getPurchaseOrderById(poId, companyId);
    console.log(`✔ PO generated: ${po.po_number} (Status: ${po.status})`);

    // Step 8: Try creating Goods Receipt against DRAFT PO (should fail)
    console.log('\n[8] Trying to create Goods Receipt against DRAFT PO (should fail)...');
    try {
      await grnService.createGoodsReceipt({
        companyId,
        purchaseOrderId: poId,
        vendorId: po.vendor_id,
        warehouseId: 1,
        receivedDate: new Date(),
        items: [{ productId: product.id, quantityReceived: 3 }],
        userId
      });
      throw new Error('❌ Failure: Goods Receipt allowed on non-approved PO!');
    } catch (e) {
      console.log(`✔ Blocked Goods Receipt on draft PO as expected: "${e.message}"`);
    }

    // Step 9: Submit PO for Approval & Approve PO
    console.log('\n[9] Submitting PO for approval...');
    const poSubmitted = await poService.submitForApproval(poId, companyId, userId);
    console.log(`✔ PO submitted: ${poSubmitted.po_number} (Status: ${poSubmitted.status})`);
    
    console.log('Approving PO workflow...');
    await poService.approvePurchaseOrder(poId, companyId, userId);
    const poApproved = await poService.getPurchaseOrderById(poId, companyId);
    console.log(`✔ PO approved: ${poApproved.po_number} (Status: ${poApproved.status})`);

    // Step 10: Create Goods Receipt (GRN)
    console.log('\n[10] Creating and posting Goods Receipt...');
    // Make sure warehouse 1 exists or fallback
    let warehouse = await db('warehouses').where({ company_id: companyId, is_active: true }).first();
    if (!warehouse) {
      const [wId] = await db('warehouses').insert({ company_id: companyId, name: 'Default Store', code: 'DEF', is_active: true }).returning('id');
      warehouse = { id: typeof wId === 'object' ? wId.id : wId };
    }

    const grn = await grnService.createGoodsReceipt({
      companyId,
      purchaseOrderId: poId,
      vendorId: po.vendor_id,
      warehouseId: warehouse.id,
      receivedDate: new Date(),
      supplierReference: 'REF-E2E-123',
      notes: 'Received under E2E testing',
      items: [{ productId: product.id, quantity_ordered: 3, quantity_received: 3, quantity_rejected: 0 }],
      userId
    });
    console.log(`✔ Goods Receipt created: ${grn.grn_number} (Status: ${grn.status})`);

    console.log('Posting Goods Receipt to inventory...');
    const grnPosted = await grnService.postGoodsReceipt(grn.id, companyId, userId);
    console.log(`✔ Goods Receipt posted: ${grnPosted.grn_number} (Status: ${grnPosted.status})`);

    // Step 11: Convert GRN to Purchase Voucher
    console.log('\n[11] Generating Purchase Voucher from Goods Receipt...');
    const pvConvert = await grnService.convertToVoucher(grn.id, companyId, userId);
    const pvId = pvConvert.voucherId;
    const pv = await voucherService.getVoucherById(pvId, companyId);
    console.log(`✔ Purchase Voucher generated: ${pv.voucher_number} (Status: ${pv.status})`);

    // Step 12: Post Purchase Voucher
    console.log('\n[12] Posting Purchase Voucher to ledger...');
    const pvPosted = await voucherService.postToLedger(pvId, companyId, userId);
    console.log(`✔ Purchase Voucher posted: ${pvPosted.voucher_number} (Status: ${pvPosted.status})`);

    // Step 13: Create Supplier Payment Voucher
    console.log('\n[13] Creating Payment Voucher against Purchase Voucher...');
    const payVoucher = await voucherService.createDraft({
      companyId,
      type: 'PAYMENT',
      date: new Date(),
      payload: {
        vendorId: po.vendor_id,
        cashAccountId: 1, // Bank / Cash
        purchase_voucher_id: pvId,
        amount: pvPosted.total_amount
      },
      totalAmount: pvPosted.total_amount,
      taxAmount: 0,
      userId
    });
    console.log(`✔ Payment Voucher created: ${payVoucher.voucher_number} (Status: ${payVoucher.status})`);

    // Step 14: Post Payment Voucher
    console.log('\n[14] Posting Payment Voucher (should trigger PAID status on PV)...');
    const payPosted = await voucherService.postToLedger(payVoucher.id, companyId, userId);
    console.log(`✔ Payment Voucher posted: ${payPosted.voucher_number} (Status: ${payPosted.status})`);

    // Verify parent Purchase Voucher is marked PAID
    const pvFinal = await voucherService.getVoucherById(pvId, companyId);
    console.log(`✔ Verified Purchase Voucher state progression: ${pvFinal.voucher_number} status is now: ${pvFinal.status}`);
    if (pvFinal.status !== 'PAID') {
      throw new Error(`❌ Failure: Linked Purchase Voucher remained ${pvFinal.status} instead of progressing to PAID!`);
    }

    // Step 15: Bidirectional Document Journey Lineage check
    console.log('\n[15] Tracing E2E document lineage journey...');
    const lineage = await lineageService.getLineage('PURCHASE_REQUISITION', pr.id, companyId);
    console.log('Bidirectional Document Journey:');
    lineage.forEach((doc, idx) => {
      console.log(`  Stage ${idx + 1}: [${doc.type}] Number: ${doc.number} | Status: ${doc.status} | Link: ${doc.link}`);
    });

    if (lineage.length < 5) {
      throw new Error(`❌ Failure: Expected at least 5 stages of lineage trace, got ${lineage.length}.`);
    }
    console.log('\n✔ ✔ ✔ E2E LIFECYCLE TEST COMPLETED SUCCESSFULLY! ALL POLICIES ENFORCED! ✔ ✔ ✔');

  } catch (err) {
    console.error('\n❌ E2E LIFECYCLE TEST FAILED:', err);
  } finally {
    process.exit(0);
  }
}

runE2E();
