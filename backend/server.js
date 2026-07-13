require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[Migrations] Unlocking migrations lock if stuck...');
    await db.migrate.unlock();
    console.log('[Migrations] Running migrations...');
    await db.migrate.latest();
    console.log('[Migrations] Migrations completed successfully');

    // Seed default document types if missing
    await db('workflow_document_types')
      .insert([
        {
          code: 'VOUCHER',
          name: 'ERP Voucher (Sales, Purchase, etc.)',
          callback_service: 'voucher.service',
          callback_method: 'postToLedger'
        },
        {
          code: 'JOURNAL',
          name: 'Manual Journal Entry',
          callback_service: 'journal.service',
          callback_method: 'postJournalEntry'
        },
        {
          code: 'PAYROLL',
          name: 'Payroll Run',
          callback_service: 'payroll.service',
          callback_method: 'postPayrollRun'
        },
        {
          code: 'BUDGET',
          name: 'Budget Plan Approval',
          callback_service: 'budget.service',
          callback_method: 'activateBudget'
        }
      ])
      .onConflict('code')
      .ignore();
    console.log('[Workflow Seed] Default document types verified/seeded');

    // Auto-create budget workflow definitions & stages for all companies
    const companies = await db('companies').select('id');
    for (const c of companies) {
      let def = await db('workflow_definitions')
        .where({ company_id: c.id, document_type_code: 'BUDGET' })
        .first();
      
      let defId;
      if (!def) {
        const [inserted] = await db('workflow_definitions')
          .insert({
            company_id: c.id,
            document_type_code: 'BUDGET',
            name: 'Standard Budget Approval Process',
            is_active: true
          })
          .returning('id');
        defId = typeof inserted === 'object' ? inserted.id : inserted;
      } else {
        defId = def.id;
      }

      // If no stages exist, seed standard budget approval stage
      const stageCount = await db('workflow_stages')
        .where({ workflow_definition_id: defId })
        .count('id as count')
        .first();
      
      if (parseInt(stageCount.count || 0) === 0) {
        await db('workflow_stages').insert({
          workflow_definition_id: defId,
          stage_sequence: 1,
          name: 'Finance Manager Budget Review',
          required_role: null,
          required_permission: null,
          approval_mode: 'SEQUENTIAL'
        });
      }
    }
    console.log('[Workflow Seed] Budget approval definition/stages verified for all companies');
  } catch (error) {
    console.error('[Migrations] Migration failed:', error.message);
    console.error('[Migrations] Continuing server startup despite migration failure.');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
