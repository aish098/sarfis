require('dotenv').config();
const db = require('./src/config/db');
const BudgetService = require('./src/services/budget.service');
const WorkflowEngineService = require('./src/services/workflow_engine.service');
const JournalModel = require('./src/models/journal.model');
const JournalService = require('./src/services/journal.service');
const JournalPostingService = require('./src/services/journal_posting.service');

async function runTests() {
  console.log("=========================================================");
  console.log("RUNNING REAL-TIME BUDGET & BUDGET CONTROL INTEGRATION TESTS...");
  console.log("=========================================================");

  let testHeaderId = null;
  let testJournalIdLow = null;
  let testJournalIdHigh = null;
  let testWorkflowInstanceId = null;
  let testDefId = null;

  const companyId = 12; // Standard test company ID
  const userId = 2; // Manager user

  try {
    // 1. Resolve Expense Account
    const expenseAcc = await db('accounts')
      .where({ company_id: companyId })
      .andWhere('code', 'like', '5%') // typical expense codes
      .first();

    if (!expenseAcc) {
      console.log("❌ Error: No expense account starting with '5' found for company 12.");
      return;
    }
    console.log(`[SETUP] Resolved Expense Account: ${expenseAcc.code} - ${expenseAcc.name} (ID: ${expenseAcc.id})`);

    // Clean up any active budgets for 2026 to avoid collision
    await db('budget_headers').where({ company_id: companyId, fiscal_year: '2026' }).delete();

    // Ensure open accounting period for 2026-07
    const periodName = '2026-07';
    await db('accounting_periods').where({ company_id: companyId, period_name: periodName }).delete();
    await db('accounting_periods').insert({
      company_id: companyId,
      period_name: periodName,
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      status: 'OPEN'
    });
    console.log(`[SETUP] Ensured accounting period '${periodName}' is open.`);

    // Ensure document types registry seeded
    const docReg = await db('workflow_document_types').where({ code: 'JOURNAL' }).first();
    if (!docReg) {
      await db('workflow_document_types').insert({
        code: 'JOURNAL',
        name: 'Manual Journal Entry',
        success_callback: 'journal.service.postJournalEntry',
        failure_callback: null
      });
    }

    // Clean up previous workflow definition
    await db('workflow_definitions').where({ company_id: companyId, document_type_code: 'JOURNAL' }).delete();
    
    // Insert new definition
    const [def] = await db('workflow_definitions')
      .insert({
        company_id: companyId,
        document_type_code: 'JOURNAL',
        name: 'Journal Approval Chain',
        is_active: true
      })
      .returning('*');
    testDefId = def.id;

    // Create Manager stage
    await db('workflow_stages').insert({
      workflow_definition_id: testDefId,
      stage_sequence: 1,
      name: 'Manager Review',
      required_role: 'Manager',
      required_permission: 'journal.approve',
      timeout_hours: 24,
      approval_mode: 'SEQUENTIAL'
    });
    console.log(`[SETUP] Seeded Workflow Definition and Stage for JOURNAL.`);

    // 2. Create Active Budget
    const [header] = await db('budget_headers')
      .insert({
        company_id: companyId,
        fiscal_year: '2026',
        name: '2026 Core Operating Budget',
        version_name: 'Original',
        status: 'ACTIVE'
      })
      .returning('*');
    testHeaderId = header.id;
    console.log(`[SETUP] Created Active Budget Header, ID: ${testHeaderId}`);

    // 3. Create Budget Line (Allocated PKR 100,000 for Marketing department)
    const [line] = await db('budget_control_lines')
      .insert({
        budget_header_id: testHeaderId,
        account_id: expenseAcc.id,
        department: 'Marketing',
        project: null,
        branch: null,
        allocated_amount: 100000.00,
        alert_threshold_pct: 90.00,
        control_level: 'BLOCK'
      })
      .returning('*');
    console.log(`[SETUP] Configured budget line: PKR 100,000 limit, BLOCK control on Department: Marketing`);

    // Resolve cash offset account
    const cashAcc = await db('accounts')
      .where({ company_id: companyId })
      .andWhere('code', 'like', '1%')
      .first();

    // ---------------------------------------------------------
    // TEST CASE A: Transaction within budget (PKR 30,000)
    // ---------------------------------------------------------
    console.log("\n[TEST A] Submitting low amount journal within budget (PKR 30,000)...");
    
    // Create draft journal
    testJournalIdLow = await JournalModel.createEntry({
      companyId,
      entryDate: '2026-07-15',
      description: 'Test Marketing Expense',
      status: 'DRAFT',
      userId
    });

    await JournalModel.createLine({
      entryId: testJournalIdLow,
      accountId: expenseAcc.id,
      debit: 30000,
      credit: 0,
      department: 'Marketing'
    });

    await JournalModel.createLine({
      entryId: testJournalIdLow,
      accountId: cashAcc.id,
      debit: 0,
      credit: 30000
    });

    // Check budget availability
    const checkLow = await BudgetService.checkTransactionBudget(companyId, 'JOURNAL', testJournalIdLow, [
      { accountId: expenseAcc.id, debit: 30000, credit: 0, department: 'Marketing' }
    ]);
    console.log(`- Budget check exceeded? ${checkLow.isExceeded}`);
    if (checkLow.isExceeded) throw new Error('Test Case A failed: Low amount journal shouldn\'t exceed budget.');

    // Submit and post journal
    const resLow = await JournalService.postJournalEntry(testJournalIdLow, companyId, userId);
    console.log(`- Low Journal post status: ${resLow ? 'SUCCESS' : 'FAILED'}`);
    
    // Verify budget transaction recorded
    const actualSpendLow = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
      .sum('amount as total');
    console.log(`- Actual Recorded Spend: PKR ${actualSpendLow[0].total}`);
    if (parseFloat(actualSpendLow[0].total) !== 30000) {
      throw new Error('Test Case A failed: Spend not committed correctly.');
    }
    console.log("✅ Test Case A passed.");

    // ---------------------------------------------------------
    // TEST CASE B: Transaction exceeding budget (PKR 80,000)
    // ---------------------------------------------------------
    console.log("\n[TEST B] Submitting journal exceeding budget (PKR 80,000 - Total PKR 110,000)...");
    
    testJournalIdHigh = await JournalModel.createEntry({
      companyId,
      entryDate: '2026-07-15',
      description: 'Exceeded Marketing Expense',
      status: 'DRAFT',
      userId
    });

    await JournalModel.createLine({
      entryId: testJournalIdHigh,
      accountId: expenseAcc.id,
      debit: 80000,
      credit: 0,
      department: 'Marketing'
    });

    await JournalModel.createLine({
      entryId: testJournalIdHigh,
      accountId: cashAcc.id,
      debit: 0,
      credit: 80000
    });

    // Check budget availability (exceeds remaining 70,000)
    const checkHigh = await BudgetService.checkTransactionBudget(companyId, 'JOURNAL', testJournalIdHigh, [
      { accountId: expenseAcc.id, debit: 80000, credit: 0, department: 'Marketing' }
    ]);
    console.log(`- Budget check exceeded? ${checkHigh.isExceeded}`);
    console.log(`- Breached control level: ${checkHigh.breaches[0].controlLevel}`);
    if (!checkHigh.isExceeded || checkHigh.breaches[0].controlLevel !== 'BLOCK') {
      throw new Error('Test Case B failed: Should trigger a BLOCK control.');
    }

    // Try posting directly - should fail due to Block control level
    try {
      await JournalService.postJournalEntry(testJournalIdHigh, companyId, userId);
      throw new Error('Should have blocked direct posting.');
    } catch (blockErr) {
      console.log(`- Direct post correctly blocked: ${blockErr.message}`);
    }

    // Submit to workflow engine
    console.log(`- Submitting to Workflow Engine to trigger CFO Override flow...`);
    const resWorkflow = await WorkflowEngineService.submitToWorkflow(companyId, 'JOURNAL', testJournalIdHigh, 80000, userId);
    console.log(`- Workflow submission outcome status: ${resWorkflow.status}`);
    
    // Verify CFO override stage was injected in definitions
    const stages = await db('workflow_stages')
      .where({ workflow_definition_id: testDefId })
      .orderBy('stage_sequence', 'asc');

    console.log(`- Definition stages sequence:`, stages.map(s => `${s.name} (Role: ${s.required_role}, Sequence: ${s.stage_sequence})`));
    const hasCFOOverride = stages.some(s => s.required_role === 'CFO');
    if (!hasCFOOverride) {
      throw new Error('Test Case B failed: CFO override stage was not injected.');
    }

    const workflowInstance = await db('workflow_instances')
      .where({ company_id: companyId, document_id: testJournalIdHigh, status: 'PENDING' })
      .first();
    testWorkflowInstanceId = workflowInstance.id;

    // Verify committed spend was registered in budget transactions
    const committedSpend = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
      .sum('amount as total');
    console.log(`- Committed Spend: PKR ${committedSpend[0].total}`);
    if (parseFloat(committedSpend[0].total) !== 80000) {
      throw new Error('Test Case B failed: Committed spend not registered.');
    }

    // Approve through Manager (Stage 1)
    console.log(`- Approving Stage 1 (Manager Review)...`);
    const managerApproval = await db('workflow_instance_approvals')
      .where({ workflow_instance_id: testWorkflowInstanceId, status: 'PENDING' })
      .first();
    await WorkflowEngineService.reviewStage(companyId, testWorkflowInstanceId, 'APPROVE', 'Manager Approved', 2, 'Manager', ['journal.approve']);

    // Retrieve and Approve through CFO (Stage 2 - Override)
    console.log(`- Approving Stage 2 (CFO Budget Override)...`);
    const cfoApproval = await db('workflow_instance_approvals')
      .where({ workflow_instance_id: testWorkflowInstanceId, status: 'PENDING' })
      .first();
    await WorkflowEngineService.reviewStage(companyId, testWorkflowInstanceId, 'APPROVE', 'CFO Budget Override Approved', 3, 'CFO', ['journal.post']); // User 3 is CFO

    // Verify final status of the journal entry is POSTED
    const finalJournal = await db('journal_entries').where({ id: testJournalIdHigh }).first();
    console.log(`- Final Journal Status after CFO approval: ${finalJournal.status}`);
    if (finalJournal.status !== 'POSTED') {
      throw new Error('Test Case B failed: Journal not posted after override approval.');
    }

    // Verify committed spend is cleared and actual spend is committed
    const finalActualSpend = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
      .sum('amount as total');
    console.log(`- Final Total Actual spend committed: PKR ${finalActualSpend[0].total}`);
    if (parseFloat(finalActualSpend[0].total) !== 110000) {
      throw new Error('Test Case B failed: Final actual spend does not match.');
    }
    console.log("✅ Test Case B passed.");

    // ---------------------------------------------------------
    // TEST CASE C: Reversal release
    // ---------------------------------------------------------
    console.log("\n[TEST C] Reversing the exceeded journal entry...");
    await JournalPostingService.reverse(testJournalIdHigh, companyId, userId, 'Audit test reversal');
    
    // Check that spend is rolled back
    const postReversalSpend = await db('budget_control_transactions')
      .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
      .sum('amount as total');
    console.log(`- Total Actual spend after reversal: PKR ${postReversalSpend[0].total}`);
    if (parseFloat(postReversalSpend[0].total) !== 30000) {
      throw new Error('Test Case C failed: Reversal did not release the spend.');
    }
    console.log("✅ Test Case C passed.");

  } catch (err) {
    console.error("❌ Test run encountered error:", err);
  } finally {
    console.log("\n[CLEANUP] Cleaning up test records...");
    if (testJournalIdLow) {
      await db('budget_control_transactions').where({ document_type: 'JOURNAL', document_id: testJournalIdLow }).delete();
      await db('journal_lines').where({ entry_id: testJournalIdLow }).delete();
      await db('journal_entries').where({ id: testJournalIdLow }).delete();
    }
    if (testJournalIdHigh) {
      await db('budget_control_transactions').where({ document_type: 'JOURNAL', document_id: testJournalIdHigh }).delete();
      await db('journal_lines').where({ entry_id: testJournalIdHigh }).delete();
      await db('journal_entries').where({ id: testJournalIdHigh }).delete();
    }
    if (testWorkflowInstanceId) {
      await db('workflow_instance_approvals').where({ workflow_instance_id: testWorkflowInstanceId }).delete();
      await db('workflow_history').where({ workflow_instance_id: testWorkflowInstanceId }).delete();
      await db('workflow_instances').where({ id: testWorkflowInstanceId }).delete();
    }
    if (testHeaderId) {
      await db('budget_control_lines').where({ budget_header_id: testHeaderId }).delete();
      await db('budget_headers').where({ id: testHeaderId }).delete();
    }
    if (testDefId) {
      await db('workflow_definitions').where({ id: testDefId }).delete();
    }
    console.log("✅ Cleanup completed.");
    process.exit(0);
  }
}

runTests();
