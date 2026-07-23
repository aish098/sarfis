const db = require('../src/config/db');
const prService = require('../src/services/purchase_requisition.service');

async function testRejectionResubmitFlow() {
  console.log('=== STARTING PRODUCTION-GRADE REJECTION & RESUBMISSION VERIFICATION ===');
  
  try {
    const company = await db('companies').first();
    const user = await db('users').first();
    const product = await db('products').where({ company_id: company.id }).first();

    if (!company || !user || !product) {
      throw new Error('Missing seed data (company, user, or product).');
    }

    console.log(`[TEST] Active Company: ${company.name} (#${company.id})`);
    console.log(`[TEST] User: ${user.name} (#${user.id})`);
    console.log(`[TEST] Product: ${product.name} (#${product.id})`);

    // 1. Create a new Purchase Requisition
    const newReq = await prService.createPurchaseRequisition({
      companyId: company.id,
      requestedBy: user.id,
      department: 'Finance',
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'HIGH',
      reason: 'Testing Production Rejection & Resubmission Controls',
      items: [
        {
          productId: product.id,
          quantity: 5,
          unitPurchasePrice: 10000,
          description: 'High performance testing laptops'
        }
      ]
    });

    console.log(`\n[STEP 1] Created Requisition: ${newReq.requisition_number} (ID: ${newReq.id})`);
    console.log(`         Status: ${newReq.status}, Est Total: PKR ${newReq.estimated_total}, Revision: ${newReq.revision_number}, Version: ${newReq.version}`);
    if (newReq.version !== 1) throw new Error(`Expected initial version to be 1, got ${newReq.version}`);

    // 2. Submit for Approval
    const submittedReq = await prService.submitForApproval(newReq.id, company.id, user.id);
    console.log(`\n[STEP 2] Submitted for Approval: Status: ${submittedReq.status}, Revision: ${submittedReq.revision_number}, Version: ${submittedReq.version}`);

    // Check Cycle 1
    const cycles1 = await db('workflow_instances as wi')
      .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
      .where({ 'wi.company_id': company.id, 'wd.document_type_code': 'PURCHASE_REQUISITION', 'wi.document_id': newReq.id })
      .select('wi.*');

    console.log(`         Workflow Instances Count: ${cycles1.length}`);
    console.log(`         Cycle 1 Number: ${cycles1[0]?.cycle_number}`);
    if (cycles1[0]?.cycle_number !== 1) throw new Error('Expected cycle_number to be 1');

    // 3. Reject Requisition via Workflow Engine
    const workflowEngine = require('../src/services/workflow_engine.service');
    await workflowEngine.reviewStage(
      company.id,
      cycles1[0].id,
      'REJECT',
      'Unit price PKR 10,000 exceeds standard benchmark. Please negotiate a lower unit rate or reduce quantity.',
      user.id,
      'Manager',
      ['approval.view']
    );

    const rejectedReq = await prService.getPurchaseRequisitionById(newReq.id, company.id);
    console.log(`\n[STEP 3] Requisition Rejected: Status: ${rejectedReq.status}, Version: ${rejectedReq.version}`);
    console.log(`         Rejection Code: ${rejectedReq.last_rejection_code}`);
    console.log(`         Rejection Reason: "${rejectedReq.last_rejection_reason}"`);

    // 4. Test Concurrency Stale Edit Rejection (HTTP 409)
    console.log(`\n[STEP 4A] Testing Stale Edit Concurrency Rejection (expectedVersion = 99)...`);
    try {
      await prService.updatePurchaseRequisition(newReq.id, company.id, {
        expectedVersion: 99,
        items: [{ productId: product.id, quantity: 3, unitPurchasePrice: 9500 }]
      });
      throw new Error('STALE_EDIT_FAILED: Server allowed update with stale expectedVersion!');
    } catch (err) {
      if (err.statusCode === 409) {
        console.log(`         ✅ PASS: Received HTTP 409 Conflict for stale edit ("${err.message}")`);
      } else {
        throw err;
      }
    }

    // 4B. Valid Update Requisition Lines (Edit Entry)
    console.log(`\n[STEP 4B] Updating Requisition lines (Reducing quantity from 5 to 3 @ PKR 9,500 with expectedVersion = ${rejectedReq.version})...`);
    const updatedReq = await prService.updatePurchaseRequisition(newReq.id, company.id, {
      expectedVersion: rejectedReq.version,
      items: [
        {
          productId: product.id,
          quantity: 3,
          unitPurchasePrice: 9500,
          description: 'Revised order count & negotiated price'
        }
      ]
    });

    console.log(`         Updated Est Total: PKR ${updatedReq.estimated_total}`);
    console.log(`         Version Incremented to: ${updatedReq.version} (Revision remains: ${updatedReq.revision_number})`);
    if (updatedReq.version !== rejectedReq.version + 1) {
      throw new Error(`Expected version to increment from ${rejectedReq.version} to ${rejectedReq.version + 1}, got ${updatedReq.version}`);
    }

    // 5. Resubmit for Approval
    console.log(`\n[STEP 5] Resubmitting Requisition for Approval (expectedVersion = ${updatedReq.version})...`);
    const resubmittedReq = await prService.resubmitForApproval(
      newReq.id,
      company.id,
      user.id,
      'Negotiated unit price down to PKR 9,500 and reduced quantity to 3 laptops.',
      updatedReq.version
    );

    console.log(`         Resubmitted Status: ${resubmittedReq.status}`);
    console.log(`         New Revision Number: ${resubmittedReq.revision_number}`);
    console.log(`         New Version: ${resubmittedReq.version}`);

    // Check Cycle 2
    const cycles2 = await db('workflow_instances as wi')
      .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
      .where({ 'wi.company_id': company.id, 'wd.document_type_code': 'PURCHASE_REQUISITION', 'wi.document_id': newReq.id })
      .select('wi.*')
      .orderBy('wi.cycle_number', 'asc');

    console.log(`         Workflow Instances Count: ${cycles2.length}`);
    console.log(`         Cycles logged: ${cycles2.map(c => `Cycle #${c.cycle_number} (${c.status})`).join(', ')}`);
    if (cycles2.length !== 2) throw new Error(`Expected 2 workflow cycles, found ${cycles2.length}`);
    if (cycles2[0].status !== 'REJECTED') throw new Error('Expected Cycle 1 to remain REJECTED');

    // 6. Test Duplicate Resubmission Prevention (HTTP 409)
    console.log(`\n[STEP 6] Testing Duplicate Resubmission Prevention...`);
    try {
      await prService.resubmitForApproval(
        newReq.id,
        company.id,
        user.id,
        'Duplicate resubmit attempt',
        resubmittedReq.version
      );
      throw new Error('DUPLICATE_RESUBMIT_FAILED: Server allowed duplicate resubmission!');
    } catch (err) {
      if (err.statusCode === 409) {
        console.log(`         ✅ PASS: Received HTTP 409 Conflict for duplicate resubmission ("${err.message}")`);
      } else {
        throw err;
      }
    }

    // 7. Verify Snapshots Audit Trail
    const allRevs = await db('document_revisions')
      .where({ company_id: company.id, document_type: 'PURCHASE_REQUISITION', document_id: newReq.id })
      .orderBy('id', 'asc');
    
    console.log(`\n[SNAPSHOT AUDIT TRAIL] Total Logged Snapshots: ${allRevs.length}`);
    allRevs.forEach((r, idx) => {
      console.log(`   ${idx + 1}. Rev ${r.revision_number} (${r.snapshot_type}) - ${r.previous_status} -> ${r.new_status} | Hash: ${r.content_hash.slice(0, 16)}...`);
    });

    // Verify Notification Outbox
    const outboxEvents = await db('notification_outbox')
      .where({ company_id: company.id, aggregate_type: 'PURCHASE_REQUISITION', aggregate_id: newReq.id });
    console.log(`\n[NOTIFICATION OUTBOX] Total Enqueued Events: ${outboxEvents.length}`);
    outboxEvents.forEach(e => console.log(`   - Event: ${e.event_type} | Status: ${e.status}`));

    console.log('\n================================================================');
    console.log('🎉 VERIFICATION SUCCESS: ALL PRODUCTION HARDENING CHECKS PASSED!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
  } finally {
    await db.destroy();
  }
}

testRejectionResubmitFlow();
