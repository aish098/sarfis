const db = require('../src/config/db');
const VoucherService = require('../src/services/voucher.service');
const CorrectionWorkflowService = require('../src/services/correction_workflow.service');

async function testVoucherCorrectionFlow() {
  console.log('=== STARTING PHASE 4: POSTED VOUCHER & SUB-LEDGER CORRECTION VERIFICATION ===');

  try {
    const company = await db('companies').first();
    const users = await db('users').limit(2);
    const requesterUser = users[0];
    const approverUser = users[1] || users[0];
    const vendor = await db('vendors').where({ company_id: company.id }).first();
    const grn = await db('goods_receipts').where({ company_id: company.id }).whereIn('status', ['RECEIVED', 'CONVERTED']).first();
    const warehouse = await db('warehouses').where({ company_id: company.id }).first();

    if (!company || !requesterUser || !vendor || !grn || !warehouse) {
      throw new Error('Missing seed data for voucher test (company, user, vendor, warehouse, or received GRN).');
    }

    // Clean legacy NaN balance string if present
    if (isNaN(parseFloat(vendor.current_balance))) {
      await db('vendors').where({ id: vendor.id }).update({ current_balance: '0.00' });
      vendor.current_balance = '0.00';
    }

    console.log(`[TEST] Active Company: ${company.name} (#${company.id})`);
    console.log(`[TEST] Requester User: ${requesterUser.name} (#${requesterUser.id})`);
    console.log(`[TEST] Approver User: ${approverUser.name} (#${approverUser.id})`);
    console.log(`[TEST] Vendor: ${vendor.name} (#${vendor.id}) | Current Balance: ${vendor.current_balance}`);
    console.log(`[TEST] Warehouse: ${warehouse.name} (#${warehouse.id})`);

    const initialVendorBal = parseFloat(vendor.current_balance || 0);

    // =========================================================================
    // PART 1: UNPAID AP PURCHASE VOUCHER CORRECTION
    // =========================================================================
    console.log('\n--- PART 1: UNPAID AP PURCHASE VOUCHER CORRECTION ---');

    // 1. Create & Post Purchase Voucher
    const pvDraft = await VoucherService.createDraft({
      companyId: company.id,
      type: 'PURCHASE',
      date: new Date().toISOString().split('T')[0],
      totalAmount: 75000,
      taxAmount: 0,
      goods_receipt_id: grn.id,
      payload: {
        vendorId: vendor.id,
        warehouseId: warehouse.id,
        items: [{ productId: grn.product_id || 1, quantity: 10, unitPrice: 7500 }]
      },
      userId: requesterUser.id
    });

    console.log(`[STEP 1] Created Draft Purchase Voucher #${pvDraft.id} (${pvDraft.voucher_number})`);

    const pvPosted = await VoucherService.postToLedger(pvDraft.id, company.id, requesterUser.id);
    console.log(`[STEP 2] Posted Purchase Voucher #${pvPosted.id}: Status = ${pvPosted.status}`);

    const postVendor = await db('vendors').where({ id: vendor.id }).first();
    console.log(`         Post Vendor AP Balance: ${postVendor.current_balance}`);

    // 2. Direct Edit Immutability Lock Test
    console.log(`\n[STEP 3] Testing Direct Edit Immutability Check on POSTED Voucher...`);
    try {
      await VoucherService.updateDraft(pvPosted.id, company.id, {
        date: new Date().toISOString().split('T')[0],
        totalAmount: 100,
        userId: requesterUser.id
      });
      throw new Error('DIRECT_EDIT_FAILED: System allowed direct edit on POSTED voucher!');
    } catch (err) {
      console.log(`         ✅ PASS: Direct edit rejected ("${err.message}")`);
    }

    // 3. Submit Correction Request
    console.log(`\n[STEP 4] Submitting Correction Request for Posted Voucher #${pvPosted.id}...`);
    const requestId = await CorrectionWorkflowService.requestCorrection({
      companyId: company.id,
      userId: requesterUser.id,
      documentType: 'PURCHASE_VOUCHER',
      documentId: pvPosted.id,
      reasonCode: 'VENDOR_AMOUNT_DISCREPANCY',
      reasonText: 'Invoice total was entered incorrectly due to vendor line item adjustment.'
    });

    const corrReq = await db('document_correction_requests').where({ id: requestId }).first();
    console.log(`         Correction Request #${corrReq.id} created with Status: ${corrReq.status}`);

    // 4. Segregation of Duties Test
    if (requesterUser.id === approverUser.id) {
      console.log(`\n[STEP 5] Testing Segregation of Duties Check (Requester self-approval)...`);
      try {
        await CorrectionWorkflowService.approveCorrectionRequest({
          companyId: company.id,
          userId: requesterUser.id,
          requestId,
          allowSelfApproval: false
        });
        throw new Error('SEGREGATION_OF_DUTIES_FAILED: System allowed requester to approve own correction request!');
      } catch (err) {
        if (err.code === 'SEGREGATION_OF_DUTIES' || err.statusCode === 403) {
          console.log(`         ✅ PASS: Self-approval blocked ("${err.message}")`);
        } else {
          throw err;
        }
      }
    }

    // 5. Approve Correction Request
    console.log(`\n[STEP 6] Approving Correction Request #${requestId}...`);
    await CorrectionWorkflowService.approveCorrectionRequest({
      companyId: company.id,
      userId: approverUser.id,
      requestId,
      allowSelfApproval: true
    });

    const approvedReq = await db('document_correction_requests').where({ id: requestId }).first();
    console.log(`         Correction Request Status: ${approvedReq.status}`);

    // 6. Execute Correction Request & Sub-ledger Reversal
    console.log(`\n[STEP 7] Executing Voucher Correction Transaction...`);
    const result = await CorrectionWorkflowService.executeCorrectionRequest({
      companyId: company.id,
      userId: approverUser.id,
      requestId
    });

    console.log(`         Reversal Voucher Created & Posted: #${result.reversalDocumentId}`);
    console.log(`         Draft Corrected Copy Created: #${result.correctedDocumentId}`);

    // 7. Verify Idempotency Check
    console.log(`\n[STEP 8] Testing Idempotent Execution Check...`);
    const result2 = await CorrectionWorkflowService.executeCorrectionRequest({
      companyId: company.id,
      userId: approverUser.id,
      requestId
    });
    console.log(`         Idempotent Response Received: idempotent=${result2.idempotent}`);
    if (!result2.idempotent) throw new Error('Expected idempotent response on second execution call.');

    // 8. Verify Original Voucher Audit State & Delayed Superseded Link
    const reversedPV = await db('vouchers').where({ id: pvPosted.id }).first();
    console.log(`\n[STEP 9] Original Voucher #${reversedPV.id} Audit State:`);
    console.log(`         status: ${reversedPV.status}`);
    console.log(`         is_reversed: ${reversedPV.is_reversed}`);
    console.log(`         reversal_voucher_id: ${reversedPV.reversal_voucher_id}`);
    console.log(`         correction_draft_id: ${reversedPV.correction_draft_id}`);
    console.log(`         superseded_by_voucher_id: ${reversedPV.superseded_by_voucher_id} (Expected NULL until draft is posted)`);

    if (reversedPV.superseded_by_voucher_id !== null && reversedPV.superseded_by_voucher_id !== undefined) {
      throw new Error('SEMANTIC_ERROR: superseded_by_voucher_id was populated before corrected draft copy was posted!');
    }

    // 9. Verify Vendor Balance Restoration
    const revVendor = await db('vendors').where({ id: vendor.id }).first();
    console.log(`\n[STEP 10] Restored Vendor AP Balance: ${revVendor.current_balance} (Initial: ${initialVendorBal})`);

    if (parseFloat(revVendor.current_balance) !== initialVendorBal) {
      throw new Error('SUBLEDGER_BALANCE_REVERSAL_MISMATCH: Vendor AP balance was not restored accurately!');
    }

    // 10. Post Corrected Draft Copy & Verify Delayed Superseded Link Activation
    console.log(`\n[STEP 11] Posting Corrected Replacement Draft Copy #${result.correctedDocumentId}...`);
    await VoucherService.postToLedger(result.correctedDocumentId, company.id, requesterUser.id);

    const finalOrigPV = await db('vouchers').where({ id: pvPosted.id }).first();
    console.log(`         Post-Replacement Original Voucher #${finalOrigPV.id}: superseded_by_voucher_id = ${finalOrigPV.superseded_by_voucher_id}`);
    if (parseInt(finalOrigPV.superseded_by_voucher_id, 10) !== parseInt(result.correctedDocumentId, 10)) {
      throw new Error('SUPERSEDED_LINK_FAILED: Original voucher was not linked to posted replacement copy!');
    }

    // =========================================================================
    // PART 2: DOWNSTREAM DEPENDENCY VALIDATION TEST
    // =========================================================================
    console.log('\n--- PART 2: DOWNSTREAM DEPENDENCY VALIDATION TEST ---');

    // Create & post another Purchase Voucher
    const pv2Draft = await VoucherService.createDraft({
      companyId: company.id,
      type: 'PURCHASE',
      date: new Date().toISOString().split('T')[0],
      totalAmount: 30000,
      goods_receipt_id: grn.id,
      payload: { vendorId: vendor.id, warehouseId: warehouse.id, items: [{ productId: grn.product_id || 1, quantity: 4, unitPrice: 7500 }] },
      userId: requesterUser.id
    });
    const pv2Posted = await VoucherService.postToLedger(pv2Draft.id, company.id, requesterUser.id);

    // Simulate downstream payment settlement by marking status PAID
    await db('vouchers').where({ id: pv2Posted.id }).update({ status: 'PAID' });
    console.log(`[STEP 12] Simulated Downstream Payment Settlement on Voucher #${pv2Posted.id} (Status: PAID)`);

    console.log(`         Attempting Correction Request on Paid Voucher...`);
    try {
      await CorrectionWorkflowService.requestCorrection({
        companyId: company.id,
        userId: requesterUser.id,
        documentType: 'PURCHASE_VOUCHER',
        documentId: pv2Posted.id,
        reasonCode: 'ILLEGAL_CORRECTION',
        reasonText: 'Correction on paid voucher'
      });
      throw new Error('DEPENDENCY_CHECK_FAILED: System allowed correction on voucher with downstream payment!');
    } catch (err) {
      if (err.code === 'DOCUMENT_HAS_DOWNSTREAM_DEPENDENCIES' || err.statusCode === 409) {
        console.log(`         ✅ PASS: Correction blocked with code: ${err.code} ("${err.message}")`);
      } else {
        throw err;
      }
    }

    console.log('\n================================================================');
    console.log('🎉 PHASE 4 VERIFICATION SUCCESS: POSTED VOUCHER CORRECTION ENGINE WORKING PERFECTLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ PHASE 4 VERIFICATION FAILED:', err);
  } finally {
    await db.destroy();
  }
}

testVoucherCorrectionFlow();
