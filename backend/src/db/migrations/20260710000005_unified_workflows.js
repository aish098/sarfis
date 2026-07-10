exports.up = function(knex) {
  return knex.schema
    .createTable('workflow_document_types', table => {
      table.increments('id').primary();
      table.string('code', 50).unique().notNullable(); // e.g. 'VOUCHER', 'JOURNAL'
      table.string('name', 150).notNullable();
      table.string('callback_service', 150).notNullable(); // Name of the service file, e.g. 'voucher.service'
      table.string('callback_method', 150).notNullable(); // Name of the success callback method, e.g. 'postVoucher'
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('workflow_definitions', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('document_type_code', 50).notNullable().references('code').inTable('workflow_document_types').onDelete('CASCADE');
      table.string('name', 150).notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);

      table.unique(['company_id', 'document_type_code']);
    })
    .createTable('workflow_stages', table => {
      table.increments('id').primary();
      table.integer('workflow_definition_id').notNullable().references('id').inTable('workflow_definitions').onDelete('CASCADE');
      table.integer('stage_sequence').notNullable(); // e.g. 1, 2
      table.string('name', 150).notNullable(); // e.g. 'CFO Review'
      table.string('required_role', 100).nullable();
      table.string('required_permission', 100).nullable();
      table.jsonb('conditions').nullable(); // e.g. [{"field": "amount", "operator": ">=", "value": 500000}]
      table.integer('timeout_hours').nullable();
      table.string('escalate_role', 100).nullable();
      table.string('approval_mode', 20).defaultTo('SEQUENTIAL'); // 'SEQUENTIAL' | 'PARALLEL'
      table.timestamps(true, true);

      table.unique(['workflow_definition_id', 'stage_sequence']);
    })
    .createTable('workflow_instances', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('workflow_definition_id').notNullable().references('id').inTable('workflow_definitions').onDelete('CASCADE');
      table.integer('document_id').notNullable();
      table.integer('current_stage_sequence').defaultTo(1);
      table.string('status', 30).defaultTo('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED'
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    })
    .createTable('workflow_instance_approvals', table => {
      table.increments('id').primary();
      table.integer('workflow_instance_id').notNullable().references('id').inTable('workflow_instances').onDelete('CASCADE');
      table.integer('stage_id').notNullable().references('id').inTable('workflow_stages').onDelete('CASCADE');
      table.string('status', 30).defaultTo('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED'
      table.integer('actioned_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('actioned_at').nullable();
      table.text('comments').nullable();
      table.timestamps(true, true);
    })
    .createTable('workflow_history', table => {
      table.increments('id').primary();
      table.integer('workflow_instance_id').notNullable().references('id').inTable('workflow_instances').onDelete('CASCADE');
      table.string('action', 50).notNullable(); // 'SUBMITTED', 'APPROVED', 'REJECTED', 'ESCALATED'
      table.string('stage_name', 150).nullable();
      table.integer('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('comments').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('workflow_delegations', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('from_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('to_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('workflow_delegations')
    .dropTableIfExists('workflow_history')
    .dropTableIfExists('workflow_instance_approvals')
    .dropTableIfExists('workflow_instances')
    .dropTableIfExists('workflow_stages')
    .dropTableIfExists('workflow_definitions')
    .dropTableIfExists('workflow_document_types');
};
