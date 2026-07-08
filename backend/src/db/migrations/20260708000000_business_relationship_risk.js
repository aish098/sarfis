exports.up = async function(knex) {
  return knex.schema
    // 1. Alter company_accounting_settings to add default_bad_debt_account_id
    .alterTable('company_accounting_settings', table => {
      table.integer('default_bad_debt_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
    })
    
    // 2. Create business_relationship_status table
    .createTable('business_relationship_status', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('entity_type', 20).notNullable(); // 'CUSTOMER' | 'VENDOR'
      table.integer('entity_id').notNullable(); // client_id or vendor_id
      table.string('status', 30).notNullable().defaultTo('ACTIVE'); // 'ACTIVE' | 'WATCHLIST' | 'RESTRICTED' | 'BLACKLISTED' | 'REINSTATED'
      table.integer('risk_score').notNullable().defaultTo(0);
      table.string('risk_level', 20).notNullable().defaultTo('LOW'); // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      table.decimal('credit_limit_override', 15, 2).nullable();
      table.boolean('cash_only').defaultTo(false);
      table.boolean('manager_approval_required').defaultTo(false);
      table.integer('max_credit_days').nullable();
      table.timestamp('blacklist_expires_at').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.unique(['company_id', 'entity_type', 'entity_id']);
      table.index(['company_id']);
      table.index(['company_id', 'entity_type', 'entity_id']);
    })

    // 3. Create business_risk_incidents table
    .createTable('business_risk_incidents', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('entity_type', 20).notNullable(); // 'CUSTOMER' | 'VENDOR'
      table.integer('entity_id').notNullable();
      table.string('category', 50).notNullable(); // 'LATE_PAYMENT', 'BOUNCED_CHEQUE', 'OVERDUE_INVOICE', 'BAD_DEBT', 'LEGAL_CASE', etc.
      table.date('incident_date').notNullable();
      table.text('reason').notNullable();
      table.decimal('loss_amount', 15, 2).defaultTo(0.00);
      table.decimal('recovered_amount', 15, 2).defaultTo(0.00);
      table.integer('days_late').defaultTo(0);
      table.boolean('resolved').defaultTo(false);
      table.timestamp('resolved_at').nullable();
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.index(['company_id']);
      table.index(['company_id', 'entity_type', 'entity_id']);
    })

    // 4. Create reinstatement_requests table
    .createTable('reinstatement_requests', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('entity_type', 20).notNullable();
      table.integer('entity_id').notNullable();
      table.date('request_date').notNullable().defaultTo(knex.fn.now());
      table.text('reason').notNullable();
      table.string('status', 20).notNullable().defaultTo('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED'
      table.integer('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('review_notes').nullable();
      table.date('decision_date').nullable();
      table.string('priority_after_reinstate', 20).nullable();
      table.string('receivables_handling', 30).nullable(); // 'KEEP_AR' | 'WRITE_OFF' | 'SETTLEMENT' | 'LEGAL'
      
      // Credit Committee Section
      table.date('committee_meeting_date').nullable();
      table.text('committee_participants').nullable();
      table.text('committee_decision').nullable();
      table.date('committee_next_review_date').nullable();

      table.timestamps(true, true);

      table.index(['company_id']);
    })

    // 5. Create payment_plans table
    .createTable('payment_plans', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('entity_type', 20).notNullable();
      table.integer('entity_id').notNullable();
      table.decimal('total_amount', 15, 2).notNullable();
      table.string('frequency', 20).notNullable(); // 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
      table.string('status', 20).notNullable().defaultTo('ACTIVE'); // 'ACTIVE' | 'COMPLETED' | 'DEFAULTED'
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['company_id']);
    })

    // 6. Create payment_plan_installments table
    .createTable('payment_plan_installments', table => {
      table.increments('id').primary();
      table.integer('plan_id').notNullable().references('id').inTable('payment_plans').onDelete('CASCADE');
      table.date('due_date').notNullable();
      table.decimal('amount', 15, 2).notNullable();
      table.decimal('paid_amount', 15, 2).defaultTo(0.00);
      table.decimal('remaining_amount', 15, 2).defaultTo(0.00);
      table.string('status', 20).notNullable().defaultTo('UNPAID'); // 'UNPAID' | 'PARTIAL' | 'PAID'
      table.timestamp('paid_at').nullable();
      table.timestamps(true, true);
    })

    // 7. Create business_relationship_history table
    .createTable('business_relationship_history', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('entity_type', 20).notNullable();
      table.integer('entity_id').notNullable();
      table.string('action', 50).notNullable();
      table.integer('performed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('remarks').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // 8. Seed permissions and link them
    .then(async () => {
      const newPermissions = [
        { code: 'risk.view', module: 'risk', action: 'view', description: 'View relationship risk metrics and reports' },
        { code: 'risk.manage', module: 'risk', action: 'manage', description: 'Log incidents, manage risk settings, and write off bad debts' },
        { code: 'risk.approve', module: 'risk', action: 'approve', description: 'Approve overrides and reinstatement requests' },
      ];

      await knex('permissions').insert(newPermissions);

      const roles = await knex('roles').select('*');
      const perms = await knex('permissions').select('*');

      const getPermId = (code) => perms.find(p => p.code === code)?.id;
      const getRoleId = (name) => roles.find(r => r.name === name)?.id;

      const roleMappings = [];

      // Admin gets all 3
      const adminId = getRoleId('Admin');
      if (adminId) {
        newPermissions.forEach(p => {
          const pid = getPermId(p.code);
          if (pid) roleMappings.push({ role_id: adminId, permission_id: pid });
        });
      }

      // Accountant gets view & manage
      const accountantId = getRoleId('Accountant');
      if (accountantId) {
        ['risk.view', 'risk.manage'].forEach(c => {
          const pid = getPermId(c);
          if (pid) roleMappings.push({ role_id: accountantId, permission_id: pid });
        });
      }

      // Finance Manager gets all 3
      const financeManagerId = getRoleId('Finance Manager');
      if (financeManagerId) {
        newPermissions.forEach(p => {
          const pid = getPermId(p.code);
          if (pid) roleMappings.push({ role_id: financeManagerId, permission_id: pid });
        });
      }

      // Sales Manager gets view & approve (for overrides)
      const salesManagerId = getRoleId('Sales Manager');
      if (salesManagerId) {
        ['risk.view', 'risk.approve'].forEach(c => {
          const pid = getPermId(c);
          if (pid) roleMappings.push({ role_id: salesManagerId, permission_id: pid });
        });
      }

      if (roleMappings.length > 0) {
        await knex('role_permissions').insert(roleMappings);
      }
    });
};

exports.down = async function(knex) {
  // 1. Delete permissions first
  const codes = ['risk.view', 'risk.manage', 'risk.approve'];
  const perms = await knex('permissions').whereIn('code', codes).select('id');
  const permIds = perms.map(p => p.id);

  if (permIds.length > 0) {
    await knex('role_permissions').whereIn('permission_id', permIds).delete();
    await knex('permissions').whereIn('id', permIds).delete();
  }

  // 2. Drop tables
  return knex.schema
    .dropTableIfExists('business_relationship_history')
    .dropTableIfExists('payment_plan_installments')
    .dropTableIfExists('payment_plans')
    .dropTableIfExists('reinstatement_requests')
    .dropTableIfExists('business_risk_incidents')
    .dropTableIfExists('business_relationship_status')
    .alterTable('company_accounting_settings', table => {
      table.dropColumn('default_bad_debt_account_id');
    });
};
