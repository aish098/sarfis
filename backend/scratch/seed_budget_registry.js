const db = require('../src/config/db');

async function seed() {
  console.log('=== SEEDING FP&A BUDGET DATA ===');

  try {
    const companyId = 1; // Default company

    // Find valid postable accounts in Chart of Accounts
    const accounts = await db('accounts').where({ company_id: companyId });
    if (accounts.length < 3) {
      console.log('⚠️ Need at least 3 accounts in database. Seeding accounts...');
      // Insert basic accounts if missing
      await db('accounts').insert([
        { company_id: companyId, code: '1000', name: 'Marketing Expense', type: 'EXPENSE', is_postable: true },
        { company_id: companyId, code: '2000', name: 'Operational Expense', type: 'EXPENSE', is_postable: true },
        { company_id: companyId, code: '3000', name: 'Human Resource Expense', type: 'EXPENSE', is_postable: true }
      ]).onConflict(['company_id', 'code']).ignore();
    }

    const dbAccounts = await db('accounts').where({ company_id: companyId }).orderBy('code', 'asc');
    const acc1 = dbAccounts[0];
    const acc2 = dbAccounts[1];
    const acc3 = dbAccounts[2];

    console.log(`Using accounts: ${acc1.code} (${acc1.name}), ${acc2.code} (${acc2.name}), ${acc3.code} (${acc3.name})`);

    // Clean up old UAT / test budgets for this company
    await db('budget_headers').where({ company_id: companyId, fiscal_year: '2026' }).delete();

    // 1. Insert ACTIVE budget header
    const [headerIdObj] = await db('budget_headers').insert({
      company_id: companyId,
      fiscal_year: '2026',
      name: 'Enterprise Operations & Marketing Plan',
      version_name: 'Original',
      scenario_type: 'EXPECTED',
      status: 'ACTIVE'
    }).returning('id');

    const headerId = typeof headerIdObj === 'object' ? headerIdObj.id : headerIdObj;
    console.log(`Created Active Budget Header ID: ${headerId}`);

    // 2. Insert budget control lines
    const [line1Obj] = await db('budget_control_lines').insert({
      budget_header_id: headerId,
      account_id: acc1.id,
      department: 'Marketing',
      branch: 'Main Head Office',
      allocated_amount: 120000,
      current_budget_amount: 120000,
      alert_threshold_pct: 90,
      control_level: 'BLOCK'
    }).returning('id');
    const lineId1 = typeof line1Obj === 'object' ? line1Obj.id : line1Obj;

    const [line2Obj] = await db('budget_control_lines').insert({
      budget_header_id: headerId,
      account_id: acc2.id,
      department: 'Operations',
      branch: 'Main Head Office',
      allocated_amount: 240000,
      current_budget_amount: 240000,
      alert_threshold_pct: 85,
      control_level: 'WARNING'
    }).returning('id');
    const lineId2 = typeof line2Obj === 'object' ? line2Obj.id : line2Obj;

    const [line3Obj] = await db('budget_control_lines').insert({
      budget_header_id: headerId,
      account_id: acc3.id,
      department: 'HR',
      branch: 'Main Head Office',
      allocated_amount: 180000,
      current_budget_amount: 180000,
      alert_threshold_pct: 95,
      control_level: 'BLOCK'
    }).returning('id');
    const lineId3 = typeof line3Obj === 'object' ? line3Obj.id : line3Obj;

    console.log('Created 3 budget control lines.');

    // 3. Insert 12 monthly splits for each line
    for (let m = 1; m <= 12; m++) {
      await db('budget_monthly_allocations').insert({
        budget_control_line_id: lineId1,
        month: m,
        allocated_amount: 10000
      });
      await db('budget_monthly_allocations').insert({
        budget_control_line_id: lineId2,
        month: m,
        allocated_amount: 20000
      });
      await db('budget_monthly_allocations').insert({
        budget_control_line_id: lineId3,
        month: m,
        allocated_amount: 15000
      });
    }
    console.log('Created 36 monthly allocation splits.');

    // 4. Create Workflow timeline audit logs
    let definition = await db('workflow_definitions').where({ company_id: companyId, document_type_code: 'BUDGET' }).first();
    if (!definition) {
      await db('workflow_document_types').insert({
        code: 'BUDGET',
        name: 'Budget Plan Approval',
        callback_service: 'budget.service',
        callback_method: 'activateBudget'
      }).onConflict('code').ignore();

      const [defIdObj] = await db('workflow_definitions').insert({
        company_id: companyId,
        document_type_code: 'BUDGET',
        name: 'Standard Budget Approval'
      }).returning('id');
      const defId = typeof defIdObj === 'object' ? defIdObj.id : defIdObj;
      definition = { id: defId };
    }

    const [wfIdObj] = await db('workflow_instances').insert({
      company_id: companyId,
      workflow_definition_id: definition.id,
      document_id: headerId,
      status: 'APPROVED',
      current_stage_sequence: 3
    }).returning('id');
    const wfId = typeof wfIdObj === 'object' ? wfIdObj.id : wfIdObj;

    await db('workflow_history').insert([
      { workflow_instance_id: wfId, action: 'SUBMITTED', stage_name: 'Budget Creation', user_id: 1, comments: 'FY26 Initial operational draft compiled.', created_at: '2026-07-01 09:00:00' },
      { workflow_instance_id: wfId, action: 'APPROVED', stage_name: 'Finance Manager Review', user_id: 1, comments: 'Checked allocations against department guidelines.', created_at: '2026-07-02 14:30:00' },
      { workflow_instance_id: wfId, action: 'APPROVED', stage_name: 'CFO Approval', user_id: 1, comments: 'Enterprise budget approved for execution.', created_at: '2026-07-03 11:15:00' }
    ]);
    console.log('Created workflow audit history.');

    // 5. Post some actual transactions to visualize charts and calendar utilization
    // Marketing actual spent
    await db('budget_control_transactions').insert([
      { budget_control_line_id: lineId1, document_type: 'JOURNAL', document_id: 101, status: 'ACTUAL', amount: 8000, posting_date: '2026-01-15' },
      { budget_control_line_id: lineId1, document_type: 'JOURNAL', document_id: 102, status: 'ACTUAL', amount: 9200, posting_date: '2026-02-20' },
      { budget_control_line_id: lineId1, document_type: 'JOURNAL', document_id: 103, status: 'ACTUAL', amount: 10500, posting_date: '2026-03-10' }, // overspend (105%)
      { budget_control_line_id: lineId1, document_type: 'JOURNAL', document_id: 104, status: 'ACTUAL', amount: 7800, posting_date: '2026-04-18' },
      { budget_control_line_id: lineId1, document_type: 'JOURNAL', document_id: 105, status: 'ACTUAL', amount: 8900, posting_date: '2026-05-22' },
      { budget_control_line_id: lineId1, document_type: 'COMMITTED', document_id: 106, status: 'COMMITTED', amount: 1200, posting_date: '2026-06-05' }
    ]);

    // Operations actual spent
    await db('budget_control_transactions').insert([
      { budget_control_line_id: lineId2, document_type: 'JOURNAL', document_id: 201, status: 'ACTUAL', amount: 18000, posting_date: '2026-01-10' },
      { budget_control_line_id: lineId2, document_type: 'JOURNAL', document_id: 202, status: 'ACTUAL', amount: 19500, posting_date: '2026-02-12' },
      { budget_control_line_id: lineId2, document_type: 'JOURNAL', document_id: 203, status: 'ACTUAL', amount: 22000, posting_date: '2026-03-15' }, // overspent (110%)
      { budget_control_line_id: lineId2, document_type: 'JOURNAL', document_id: 204, status: 'ACTUAL', amount: 19000, posting_date: '2026-04-12' },
      { budget_control_line_id: lineId2, document_type: 'JOURNAL', document_id: 205, status: 'ACTUAL', amount: 20500, posting_date: '2026-05-28' },
      { budget_control_line_id: lineId2, document_type: 'COMMITTED', document_id: 206, status: 'COMMITTED', amount: 4500, posting_date: '2026-06-25' }
    ]);

    console.log('Created budget control transactions.');

    // 6. Delete old cache so dashboard compiles freshly
    await db('budget_dashboard_cache').where({ company_id: companyId, fiscal_year: '2026' }).delete();
    console.log('Invalidated dashboard caches.');

    console.log('✅ DATABASE SEEDED SUCCESSFULLY.');
    process.exit(0);
  } catch (err) {
    console.error('❌ SEEDING FAILED:', err);
    process.exit(1);
  }
}

seed();
