const knex = require('knex');
const config = require('../knexfile');
const db = knex(config.development);
const BudgetService = require('../src/services/budget.service');

async function testSuite() {
  console.log('--- STARTING UAT-161 TO UAT-168 BUDGET EXTENSIONS VERIFICATION ---');

  const companyId = 9;

  try {
    // 1. Reset / Seed test budget header for year 2026
    console.log('\n[1/5] Seeding test budget header...');
    await db('budget_monthly_allocations').delete();
    await db('budget_transfers').delete();
    await db('budget_control_lines').delete();
    await db('budget_headers').where({ company_id: companyId }).delete();

    const [header] = await db('budget_headers')
      .insert({
        company_id: companyId,
        fiscal_year: '2026',
        name: 'Enterprise Operating Budget',
        version_name: 'Original',
        status: 'ACTIVE', // Mark as ACTIVE to enforce checks
        revision_number: 1,
        created_from: 'MANUAL',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    console.log(`- Created active budget header: ID=${header.id}, Version=${header.version_name}, Status=${header.status}`);

    // Fetch an expense account to run allocations against
    const expenseAccount = await db('accounts')
      .where({ company_id: companyId, is_postable: true })
      .andWhere('code', 'like', '5%')
      .first();

    if (!expenseAccount) {
      throw new Error('No postable expense account found for testing.');
    }

    // 2. Seed budget control line with current_budget_amount
    const [line] = await db('budget_control_lines')
      .insert({
        budget_header_id: header.id,
        account_id: expenseAccount.id,
        allocated_amount: 100000.00,
        current_budget_amount: 100000.00,
        control_level: 'BLOCK',
        alert_threshold_pct: 90.00,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    console.log(`- Seeded control line: ID=${line.id}, Account=${expenseAccount.code}, Allocated=PKR 100,000`);

    // 3. Seed monthly allocations for April (month 4) and May (month 5)
    console.log('\n[2/5] Testing Monthly Allocation Overrides & Fallsbacks (UAT-161, UAT-162)...');
    await db('budget_monthly_allocations').insert([
      { budget_control_line_id: line.id, month: 4, allocated_amount: 10000.00 }, // April override
      { budget_control_line_id: line.id, month: 5, allocated_amount: 50000.00 }  // May override
    ]);

    // Check transaction in April for 15,000 (exceeds monthly override of 10,000)
    console.log('- Verifying transaction check for April with amount PKR 15,000...');
    const checkApril = await BudgetService.checkTransactionBudget(
      companyId,
      'JOURNAL',
      999,
      [{ accountId: expenseAccount.id, debit: 15000.00, date: '2026-04-15' }]
    );
    console.log(`  Is Exceeded? ${checkApril.isExceeded} (Expected: true)`);
    if (!checkApril.isExceeded) throw new Error('Monthly override block check failed for April.');

    // Check transaction in May for 15,000 (within override limit of 50,000)
    console.log('- Verifying transaction check for May with amount PKR 15,000...');
    const checkMay = await BudgetService.checkTransactionBudget(
      companyId,
      'JOURNAL',
      999,
      [{ accountId: expenseAccount.id, debit: 15000.00, date: '2026-05-15' }]
    );
    console.log(`  Is Exceeded? ${checkMay.isExceeded} (Expected: false)`);
    if (checkMay.isExceeded) throw new Error('Monthly override check incorrectly blocked a valid transaction in May.');

    // 4. Test Budget Revisions (UAT-164)
    console.log('\n[3/5] Testing Budget Revisions version increments (UAT-164)...');
    // Import controller and mock request/response
    const budgetCtrl = require('../src/controllers/budget.controller');
    const mockRes = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(payload) { this.data = payload; return this; }
    };

    await budgetCtrl.createRevision({ companyId, params: { id: header.id } }, mockRes);
    const newHeader = mockRes.data;
    console.log(`- Created revision: Name="${newHeader.name}", Version="${newHeader.version_name}", RevisionNum=${newHeader.revision_number}`);
    if (newHeader.revision_number !== 2) throw new Error('Revision number was not incremented.');

    // 5. Test Budget Transfers (UAT-163)
    console.log('\n[4/5] Testing Inter-Departmental Transfers (UAT-163)...');
    // Create another line on the draft header to transfer into
    const [line2] = await db('budget_control_lines')
      .insert({
        budget_header_id: header.id,
        account_id: expenseAccount.id,
        department: 'Marketing',
        allocated_amount: 50000.00,
        current_budget_amount: 50000.00,
        control_level: 'BLOCK',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    await budgetCtrl.transferBudget({
      companyId,
      userId: 1,
      body: {
        fromLineId: line.id,
        toLineId: line2.id,
        amount: 20000.00,
        reason: 'Shift Marketing operations budget'
      }
    }, mockRes);

    const fromLineUpdated = await db('budget_control_lines').where({ id: line.id }).first();
    const toLineUpdated = await db('budget_control_lines').where({ id: line2.id }).first();

    console.log(`- Source Line (from): Original=PKR 100k, TransferOut=PKR ${fromLineUpdated.transfer_out_amount}, Current=PKR ${fromLineUpdated.current_budget_amount}`);
    console.log(`- Target Line (to): Original=PKR 50k, TransferIn=PKR ${toLineUpdated.transfer_in_amount}, Current=PKR ${toLineUpdated.current_budget_amount}`);

    if (parseFloat(fromLineUpdated.current_budget_amount) !== 80000.00) throw new Error('Source current budget was not updated correctly.');
    if (parseFloat(toLineUpdated.current_budget_amount) !== 70000.00) throw new Error('Target current budget was not updated correctly.');

    // 6. Test Read-only Lock (UAT-171)
    console.log('\n[5/5] Testing Read-only Lock enforcement (UAT-171)...');
    await budgetCtrl.saveBudgetLines({ companyId, params: { id: header.id }, body: { lines: [] } }, mockRes);
    console.log(`- Save lines response code: ${mockRes.statusCode} (Expected: 400), Message: "${mockRes.data?.error}"`);
    if (mockRes.statusCode !== 400) throw new Error('Save lines on active budget did not trigger validation error.');

    console.log('\n✅ ALL UAT VERIFICATION TESTS COMPLETED SUCCESSFULLY.');
  } catch (err) {
    console.error('\n❌ UAT VERIFICATION FAILED:', err.message);
  } finally {
    await db.destroy();
  }
}

testSuite();
