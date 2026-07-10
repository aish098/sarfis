require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
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
        }
      ])
      .onConflict('code')
      .ignore();
    console.log('[Workflow Seed] Default document types verified/seeded');
  } catch (error) {
    console.error('[Migrations] Migration failed:', error.message);
    console.error('[Migrations] Continuing server startup despite migration failure.');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
