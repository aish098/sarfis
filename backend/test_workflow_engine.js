require('dotenv').config();
const db = require('./src/config/db');
const WorkflowEngineService = require('./src/services/workflow_engine.service');
const JournalService = require('./src/services/journal.service');

async function runTests() {
  console.log("=========================================================");
  console.log("RUNNING UNIFIED WORKFLOW & APPROVAL ENGINE INTEGRATION TESTS...");
  console.log("=========================================================");

  const companyId = 9; // Test company
  let userId, cfoUserId, delegateUserId;

  let testDefId = null;
  let testJournalIdLow = null;
  let testJournalIdHigh = null;
  let testJournalIdDel = null;
  let testDelegationId = null;

  try {
    // Resolve dynamic users from the database to avoid ID mismatches
    const users = await db('users').limit(3);
    if (users.length < 3) throw new Error("Test requires at least three users in the database.");
    userId = users[0].id;
    cfoUserId = users[1].id;
    delegateUserId = users[2].id;
    console.log(`[SETUP] Dynamic users resolved: Submitter=${userId}, CFO=${cfoUserId}, Delegate=${delegateUserId}`);
    // 0. Seed Document Types Registry
    console.log("[SETUP] Seeding Workflow Document Types...");
    await db('workflow_document_types').insert([
      { code: 'VOUCHER', name: 'ERP Voucher Approvals', callback_service: 'voucher.service', callback_method: 'postToLedger' },
      { code: 'JOURNAL', name: 'Manual Journal Approvals', callback_service: 'journal.service', callback_method: 'postJournalEntry' }
    ]).onConflict('code').merge();
    console.log("✅ Seeded document types registry.");

    // Clean up existing definitions for company
    await db('workflow_definitions').where({ company_id: companyId, document_type_code: 'JOURNAL' }).delete();

    // Ensure open period exists for July 2026
    let openPeriod = await db('accounting_periods')
      .where({ company_id: companyId, period_name: '2026-07' })
      .first();
    if (!openPeriod) {
      await db('accounting_periods').insert({
        company_id: companyId,
        period_name: '2026-07',
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        status: 'OPEN'
      });
    }

    // Ensure User 9 has Manager role and journal.approve permission in Company 9
    let managerRole = await db('roles').where({ name: 'Manager' }).first();
    if (!managerRole) {
      const [inserted] = await db('roles').insert({ name: 'Manager' }).returning('id');
      managerRole = { id: typeof inserted === 'object' ? inserted.id : inserted };
    }
    await db('user_roles').insert({
      company_id: companyId,
      user_id: userId,
      role_id: managerRole.id
    }).onConflict(['user_id', 'company_id', 'role_id']).ignore();

    let perm = await db('permissions').where({ code: 'journal.approve' }).first();
    if (!perm) {
      const [inserted] = await db('permissions').insert({ code: 'journal.approve', module: 'journal', action: 'approve', description: 'Approve Journals' }).returning('id');
      perm = { id: typeof inserted === 'object' ? inserted.id : inserted };
    }
    await db('user_permission_overrides').insert({
      company_id: companyId,
      user_id: userId,
      permission_id: perm.id,
      is_allowed: true,
      approval_status: 'APPROVED'
    }).onConflict(['company_id', 'user_id', 'permission_id']).ignore();

    // 1. Create Workflow Definition for JOURNAL
    console.log("[SETUP] Creating Workflow Definition & Stages...");
    const [definition] = await db('workflow_definitions')
      .insert({
        company_id: companyId,
        document_type_code: 'JOURNAL',
        name: 'Manual Journal Workflow Definitions'
      })
      .returning('id');
    testDefId = typeof definition === 'object' ? definition.id : definition;

    // Create 2 stages:
    // Stage 1: Always runs. Required Role: 'Manager', permission: 'journal.approve'
    // Stage 2: Runs only if amount >= 100,000. Required Role: 'CFO', permission: 'journal.post'
    await db('workflow_stages').insert([
      {
        workflow_definition_id: testDefId,
        stage_sequence: 1,
        name: 'Manager Review',
        required_role: 'Manager',
        required_permission: 'journal.approve',
        conditions: null,
        timeout_hours: 24,
        approval_mode: 'SEQUENTIAL'
      },
      {
        workflow_definition_id: testDefId,
        stage_sequence: 2,
        name: 'CFO Final Approval',
        required_role: 'CFO',
        required_permission: 'journal.post',
        conditions: JSON.stringify([{ field: 'amount', operator: '>=', value: 100000 }]),
        timeout_hours: 12,
        approval_mode: 'SEQUENTIAL'
      }
    ]);
    console.log("✅ Workflow stages created.");

    // Fetch postable accounts for test journals
    const accounts = await db('accounts').where({ company_id: companyId, is_postable: true }).limit(2);
    if (accounts.length < 2) throw new Error("Test requires at least two postable accounts in Company 9.");
    const [acc1, acc2] = accounts;

    // 2. Test Case A: Low Amount Journal Entry (PKR 50,000)
    console.log("\n[TEST A] Submitting low amount journal (PKR 50,000)...");
    const [jLow] = await db('journal_entries')
      .insert({ company_id: companyId, entry_date: '2026-07-05', description: 'Low Amount Test', status: 'DRAFT' })
      .returning('id');
    testJournalIdLow = typeof jLow === 'object' ? jLow.id : jLow;
    await db('journal_lines').insert([
      { entry_id: testJournalIdLow, account_id: acc1.id, debit: 50000, credit: 0 },
      { entry_id: testJournalIdLow, account_id: acc2.id, debit: 0, credit: 50000 }
    ]);

    const resA = await WorkflowEngineService.submitToWorkflow(companyId, 'JOURNAL', testJournalIdLow, 50000, userId);
    console.log(`- Submission status: ${resA.status}, Instance ID: ${resA.instanceId}`);
    
    // Low amount matches only Stage 1. Let's approve Stage 1.
    console.log("[TEST A] Approving Stage 1 (Manager Review)...");
    const outcomeA = await WorkflowEngineService.reviewStage(
      companyId,
      resA.instanceId,
      'APPROVE',
      'Looks correct.',
      userId,
      'Manager',
      ['journal.approve']
    );
    console.log(`- Stage Review Outcome status: ${outcomeA.status}`);
    
    // Check if journal has been successfully posted (completed callback!)
    const postedLow = await db('journal_entries').where({ id: testJournalIdLow }).first();
    console.log(`- Final Journal Status: ${postedLow.status}`);
    if (postedLow.status !== 'POSTED') {
      throw new Error("FAIL: Low amount journal was not posted after final stage approval.");
    }
    console.log("✅ Test Case A passed (auto-posted low amount journal).");

    // 3. Test Case B: High Amount Journal Entry (PKR 150,000) - Multi-Stage Routing
    console.log("\n[TEST B] Submitting high amount journal (PKR 150,000)...");
    const [jHigh] = await db('journal_entries')
      .insert({ company_id: companyId, entry_date: '2026-07-06', description: 'High Amount Test', status: 'DRAFT' })
      .returning('id');
    testJournalIdHigh = typeof jHigh === 'object' ? jHigh.id : jHigh;
    await db('journal_lines').insert([
      { entry_id: testJournalIdHigh, account_id: acc1.id, debit: 150000, credit: 0 },
      { entry_id: testJournalIdHigh, account_id: acc2.id, debit: 0, credit: 150000 }
    ]);

    const resB = await WorkflowEngineService.submitToWorkflow(companyId, 'JOURNAL', testJournalIdHigh, 150000, userId);
    console.log(`- Submission status: ${resB.status}, Instance ID: ${resB.instanceId}`);

    // High amount matches both Stage 1 and Stage 2.
    // Approve Stage 1 first
    console.log("[TEST B] Approving Stage 1 (Manager)...");
    const outcomeB1 = await WorkflowEngineService.reviewStage(
      companyId,
      resB.instanceId,
      'APPROVE',
      'Manager approved.',
      userId,
      'Manager',
      ['journal.approve']
    );
    console.log(`- Outcome B1 status: ${outcomeB1.status}, Next Stage: ${outcomeB1.nextStage}`);
    if (outcomeB1.status !== 'PENDING' || outcomeB1.nextStage !== 'CFO Final Approval') {
      throw new Error("FAIL: High amount workflow did not route to CFO Final Approval.");
    }

    // Now approve Stage 2 (CFO)
    console.log("[TEST B] Approving Stage 2 (CFO)...");
    const outcomeB2 = await WorkflowEngineService.reviewStage(
      companyId,
      resB.instanceId,
      'APPROVE',
      'CFO approved. Final release.',
      cfoUserId,
      'CFO',
      ['journal.post']
    );
    console.log(`- Outcome B2 status: ${outcomeB2.status}`);

    // Check final status
    const postedHigh = await db('journal_entries').where({ id: testJournalIdHigh }).first();
    console.log(`- Final Journal Status: ${postedHigh.status}`);
    if (postedHigh.status !== 'POSTED') {
      throw new Error("FAIL: High amount journal was not posted after CFO approval.");
    }
    console.log("✅ Test Case B passed (multi-stage approval and routing).");

    // 4. Test Case C: Delegation Verification
    console.log("\n[TEST C] Setting up approval delegation (Manager -> Assistant)...");
    const today = new Date().toISOString().split('T')[0];
    const [delegation] = await db('workflow_delegations')
      .insert({
        company_id: companyId,
        from_user_id: userId, // Manager
        to_user_id: delegateUserId, // Delegate user
        start_date: today,
        end_date: today,
        is_active: true
      })
      .returning('id');
    testDelegationId = typeof delegation === 'object' ? delegation.id : delegation;
    console.log(`✅ Delegation ID ${testDelegationId} configured.`);

    // Submit another low journal
    const [jDel] = await db('journal_entries')
      .insert({ company_id: companyId, entry_date: '2026-07-07', description: 'Delegation Test', status: 'DRAFT' })
      .returning('id');
    const testJournalIdDel = typeof jDel === 'object' ? jDel.id : jDel;
    await db('journal_lines').insert([
      { entry_id: testJournalIdDel, account_id: acc1.id, debit: 20000, credit: 0 },
      { entry_id: testJournalIdDel, account_id: acc2.id, debit: 0, credit: 20000 }
    ]);

    const resC = await WorkflowEngineService.submitToWorkflow(companyId, 'JOURNAL', testJournalIdDel, 20000, userId);

    console.log("[TEST C] Reviewing Stage 1 by Assistant (Acting as Delegate)...");
    // Assistant User ID delegateUserId has no direct permissions, but should succeed since delegated
    const outcomeC = await WorkflowEngineService.reviewStage(
      companyId,
      resC.instanceId,
      'APPROVE',
      'Approved by assistant on delegation.',
      delegateUserId, // Delegate User ID
      'Assistant', // Delegate Role
      [] // Delegate has no permissions directly
    );
    console.log(`- Review Outcome status: ${outcomeC.status}`);

    const postedDel = await db('journal_entries').where({ id: testJournalIdDel }).first();
    console.log(`- Final Journal Status: ${postedDel.status}`);
    if (postedDel.status !== 'POSTED') {
      throw new Error("FAIL: Delegated approval failed to release transaction.");
    }
    console.log("✅ Test Case C passed (delegation verification).");

  } finally {
    console.log("\n[CLEANUP] Cleaning up test records...");
    if (testJournalIdLow) {
      await db('journal_posting_logs').where({ journal_entry_id: testJournalIdLow }).delete();
      await db('journal_lines').where({ entry_id: testJournalIdLow }).delete();
      await db('journal_entries').where({ id: testJournalIdLow }).delete();
    }
    if (testJournalIdHigh) {
      await db('journal_posting_logs').where({ journal_entry_id: testJournalIdHigh }).delete();
      await db('journal_lines').where({ entry_id: testJournalIdHigh }).delete();
      await db('journal_entries').where({ id: testJournalIdHigh }).delete();
    }
    if (testJournalIdDel) {
      await db('journal_posting_logs').where({ journal_entry_id: testJournalIdDel }).delete();
      await db('journal_lines').where({ entry_id: testJournalIdDel }).delete();
      await db('journal_entries').where({ id: testJournalIdDel }).delete();
    }
    if (testDelegationId) {
      await db('workflow_delegations').where({ id: testDelegationId }).delete();
    }
    if (testDefId) {
      await db('workflow_definitions').where({ id: testDefId }).delete();
    }
    console.log("✅ Cleanup completed.");
  }
}

runTests()
  .then(() => {
    console.log("\n=========================================================");
    console.log("ALL UNIFIED WORKFLOW ENGINE INTEGRATION TESTS PASSED");
    console.log("=========================================================\n");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ TEST RUN FAILURE:", err);
    process.exit(1);
  });
