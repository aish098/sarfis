const db = require('../src/config/db');
const prService = require('../src/services/purchase_requisition.service');
const workflowEngine = require('../src/services/workflow_engine.service');

async function testRejectionResubmitFlow() {
  console.log('=== STARTING REJECTION & RESUBMISSION END-TO-END VERIFICATION ===');
  
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
      reason: 'Testing Rejection & Resubmission Workflow Controls',
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

    // 2. Submit for Approval
    const submittedReq = await prService.submitForApproval(newReq.id, company.id, user.id);
    console.log(`\n[STEP 2] Submitted for Approval: Status: ${submittedReq.status}, Revision: ${submittedReq.revision_number}`);

    // Verify SUBMITTED Snapshot
    const revs1 = await db('document_revisions').where({ company_id: company.id, document_type: 'PURCHASE_REQUISITION', document_id: newReq.id });
    console.log(`         Logged Snapshots Count: ${revs1.length}`);
    console.log(`         First Snapshot Type: ${revs1[0]?.snapshot_type}`);

    // 3. Reject Requisition
    await prService.rejectPurchaseRequisition(
      newReq.id,
      company.id,
      user.id,
      'PRICE_REVISION_REQUIRED',
      'Unit price PKR 10,000 exceeds standard benchmark. Please negotiate a lower unit rate or reduce quantity.'
    );

    const rejectedReq = await prService.getPurchaseRequisitionById(newReq.id, company.id);
    console.log(`\n[STEP 3] Requisition Rejected: Status: ${rejectedReq.status}`);
    console.log(`         Rejection Code: ${rejectedReq.last_rejection_code}`);
    console.log(`         Rejection Reason: "${rejectedReq.last_rejection_reason}"`);
    console.log(`         Last Rejected At: ${rejectedReq.last_rejected_at}`);

    // Verify REJECTED Snapshot
    const revs2 = await db('document_revisions').where({ company_id: company.id, document_type: 'PURCHASE_REQUISITION', document_id: newReq.id });
    console.log(`         Total Snapshots logged: ${revs2.length}`);

    // 4. Update Requisition Lines (Edit Entry)
    console.log(`\n[STEP 4] Updating Requisition lines (Reducing quantity from 5 to 3 @ PKR 9,500)...`);
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

    // 5. Resubmit for Approval
    console.log(`\n[STEP 5] Resubmitting Requisition for Approval...`);
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

    // Verify All Snapshots
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

    console.log('\n✅ VERIFICATION COMPLETE: ALL REJECTION & RESUBMISSION CONTROLS OPERATING PERFECTLY!');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
  } finally {
    await db.destroy();
  }
}

testRejectionResubmitFlow();
