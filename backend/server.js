require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Start listening on the port immediately so Railway health checks succeed instantly
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Run database checks and migrations asynchronously in the background
  (async () => {
    // 1. Initial Connectivity Check to capture raw PG driver errors
    try {
      console.log('[DB TEST] Verifying database connectivity...');
      await db.raw('SELECT 1+1 AS test').timeout(5000);
      console.log('[DB TEST] Database connection verified successfully.');
    } catch (dbErr) {
      console.error('[DB TEST] Database connection check FAILED:');
      console.error(dbErr.stack || dbErr);
      console.log('[DB TEST] App will retry connection on demand during HTTP requests.');
    }

    // 2. Run migrations and seed data
    try {
      console.log('[Migrations] Unlocking migrations lock if stuck...');
      try {
        await db.migrate.forceFreeConnection();
      } catch (lockErr) {
        console.log('[Migrations] Note: forceFreeConnection was skipped or not supported:', lockErr.message);
      }
      console.log('[Migrations] Running migrations...');
      await db.migrate.latest();
      console.log('[Migrations] Migrations completed successfully');

      // Run SaaS Admin Backend migrations & Master Admin Sync
      try {
        const saasDb = require('../saas-admin-backend/src/db/knex');
        console.log('[SaaS Admin] Running SaaS Admin migrations...');
        await saasDb.migrate.latest();
        
        const bcrypt = require('bcryptjs');
        const initialEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@saas.com';
        const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPass123!';
        
        const superAdminRole = await saasDb('admin_roles').where({ name: 'SUPER_ADMIN' }).first();
        if (!superAdminRole) {
          await saasDb.seed.run();
        } else {
          const existingAdmin = await saasDb('admins').whereRaw('LOWER(email) = ?', [initialEmail.toLowerCase()]).first();
          const passwordHash = await bcrypt.hash(initialPassword, 10);
          if (!existingAdmin) {
            await saasDb('admins').insert({
              name: 'Master Admin',
              email: initialEmail,
              password_hash: passwordHash,
              role_id: superAdminRole.id,
              status: 'ACTIVE',
              must_change_password: true
            });
          } else {
            await saasDb('admins').where({ id: existingAdmin.id }).update({
              password_hash: passwordHash,
              status: 'ACTIVE',
              updated_at: new Date()
            });
          }
        }
        console.log('[SaaS Admin] Master Admin credentials synced successfully.');
      } catch (saasErr) {
        console.error('[SaaS Admin] Startup init error:', saasErr.message);
      }

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
          },
          {
            code: 'PURCHASE_REQUISITION',
            name: 'Purchase Requisition Approval',
            callback_service: 'purchase_requisition.service',
            callback_method: 'approvePurchaseRequisition'
          },
          {
            code: 'PURCHASE_ORDER',
            name: 'Purchase Order Approval',
            callback_service: 'purchase_order.service',
            callback_method: 'approvePurchaseOrder'
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

      // Auto-create purchase requisition workflow definitions & stages for all companies
      for (const c of companies) {
        let def = await db('workflow_definitions')
          .where({ company_id: c.id, document_type_code: 'PURCHASE_REQUISITION' })
          .first();
        
        let defId;
        if (!def) {
          const [inserted] = await db('workflow_definitions')
            .insert({
              company_id: c.id,
              document_type_code: 'PURCHASE_REQUISITION',
              name: 'Standard Purchase Requisition Approval Process',
              is_active: true
            })
            .returning('id');
          defId = typeof inserted === 'object' ? inserted.id : inserted;
        } else {
          defId = def.id;
        }

        const stageCount = await db('workflow_stages')
          .where({ workflow_definition_id: defId })
          .count('id as count')
          .first();
        
        if (parseInt(stageCount.count || 0) === 0) {
          await db('workflow_stages').insert({
            workflow_definition_id: defId,
            stage_sequence: 1,
            name: 'Department Manager Requisition Review',
            required_role: null,
            required_permission: null,
            approval_mode: 'SEQUENTIAL'
          });
        }
      }
      console.log('[Workflow Seed] Purchase Requisition approval definition/stages verified for all companies');

      // 1. Clean up cached accounting settings with missing default inventory account mappings
      const deletedSettingsCount = await db('company_accounting_settings')
        .whereNull('default_inventory_account_id')
        .del();
      if (deletedSettingsCount > 0) {
        console.log(`[Startup Maintenance] Deleted ${deletedSettingsCount} incomplete company accounting settings records.`);
      }

      // 2. Ensure all companies have open 2026 accounting periods
      for (const company of companies) {
        const periodsCount = await db('accounting_periods').where({ company_id: company.id }).count('* as count').first();
        const count = parseInt(periodsCount.count || 0, 10);

        if (count === 0) {
          console.log(`[Startup Maintenance] Company ID ${company.id} has 0 accounting periods. Seeding 2026 periods...`);
          const periodData = [];
          for (let month = 1; month <= 12; month++) {
            const monthStr = month < 10 ? `0${month}` : `${month}`;
            const periodName = `2026-${monthStr}`;
            
            const endDateObj = new Date(2026, month, 0);
            const endDay = endDateObj.getDate();
            
            periodData.push({
              company_id: company.id,
              period_name: periodName,
              start_date: `2026-${monthStr}-01`,
              end_date: `2026-${monthStr}-${endDay}`,
              status: 'OPEN'
            });
          }
          await db('accounting_periods').insert(periodData);
          console.log(`[Startup Maintenance] Seeded periods for company ID ${company.id}.`);
        }
      }
    } catch (error) {
      console.error('[Migrations] Migration failed:', error.message);
      console.error(error.stack);
    }
  })();
}

startServer();
