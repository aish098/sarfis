exports.up = function(knex) {
  return knex.schema
    .createTable('period_close_sessions', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('period_id').notNullable().references('id').inTable('accounting_periods').onDelete('CASCADE');
      table.string('status', 30).notNullable().defaultTo('OPEN'); // 'OPEN', 'READY_TO_CLOSE', 'PENDING_APPROVAL', 'CLOSED', 'REOPENED'
      table.integer('started_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.integer('workflow_instance_id').nullable().references('id').inTable('workflow_instances').onDelete('SET NULL');
      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at').nullable();
      table.timestamps(true, true);
    })
    .createTable('period_close_signoffs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('session_id').notNullable().references('id').inTable('period_close_sessions').onDelete('CASCADE');
      table.string('step', 50).notNullable(); // 'INVENTORY', 'PAYROLL', 'BANK_REC', 'GL_CONTROL', 'BUDGET', 'TRIAL_BALANCE'
      table.boolean('checked').notNullable().defaultTo(true);
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamp('checked_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);
      table.unique(['session_id', 'step']);
    })
    .createTable('period_close_snapshots', table => {
      table.increments('id').primary();
      table.integer('session_id').notNullable().references('id').inTable('period_close_sessions').onDelete('CASCADE');
      table.integer('period_id').notNullable().references('id').inTable('accounting_periods').onDelete('CASCADE');
      table.decimal('profit', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('assets', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('liabilities', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('equity', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('trial_balance_difference', 15, 2).notNullable().defaultTo(0.00);
      table.text('snapshot_json').notNullable(); // Holds full reports states
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('period_close_snapshots')
    .dropTableIfExists('period_close_signoffs')
    .dropTableIfExists('period_close_sessions');
};
