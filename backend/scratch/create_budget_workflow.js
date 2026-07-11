const db = require('../src/config/db');

async function run() {
  console.log('=== SETTING UP BUDGET APPROVAL WORKFLOW STAGES ===');

  try {
    const companies = [1, 2]; // Standard test companies

    // 1. Ensure BUDGET document type is registered
    await db('workflow_document_types').insert({
      code: 'BUDGET',
      name: 'Budget Plan Approval',
      callback_service: 'budget.service',
      callback_method: 'activateBudget',
      is_active: true
    }).onConflict('code').merge();

    for (const companyId of companies) {
      console.log(`Setting up for Company ${companyId}...`);

      // 2. Insert or get workflow definition for BUDGET
      let definition = await db('workflow_definitions')
        .where({ company_id: companyId, document_type_code: 'BUDGET' })
        .first();

      if (!definition) {
        const [defIdObj] = await db('workflow_definitions').insert({
          company_id: companyId,
          document_type_code: 'BUDGET',
          name: 'Standard Budget Approval Process',
          is_active: true
        }).returning('id');
        const defId = typeof defIdObj === 'object' ? defIdObj.id : defIdObj;
        definition = { id: defId };
      }

      console.log(`Workflow Definition ID for BUDGET: ${definition.id}`);

      // Clean up old stages to rebuild cleanly
      await db('workflow_stages').where({ workflow_definition_id: definition.id }).delete();

      // 3. Insert Stage: Finance Manager Review (requires analytics.view permission)
      await db('workflow_stages').insert({
        workflow_definition_id: definition.id,
        stage_sequence: 1,
        name: 'Finance Manager Budget Review',
        required_role: 'Company Admin', // Matches the active logged-in role
        required_permission: 'analytics.view',
        approval_mode: 'SEQUENTIAL'
      });

      console.log('✅ Created Standard BUDGET Approval Stage.');
    }

    console.log('=== WORKFLOW SETUP COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ WORKFLOW SETUP FAILED:', err);
    process.exit(1);
  }
}

run();
