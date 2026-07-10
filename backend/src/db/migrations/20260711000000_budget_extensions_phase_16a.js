exports.up = async function(knex) {
  // 1. Extend budget_headers with versioning, revision history, and audit logs
  await knex.schema.alterTable('budget_headers', table => {
    table.integer('parent_budget_id').nullable().references('id').inTable('budget_headers').onDelete('SET NULL');
    table.integer('revision_number').notNullable().defaultTo(1);
    table.string('created_from', 50).nullable().defaultTo('MANUAL'); // 'MANUAL' | 'REVISION' | 'ROLLOVER'
    table.date('effective_date').nullable();
    table.date('approved_date').nullable();
  });

  // 2. Extend budget_control_lines with audit-friendly transfer columns
  await knex.schema.alterTable('budget_control_lines', table => {
    table.decimal('transfer_in_amount', 15, 2).notNullable().defaultTo(0.00);
    table.decimal('transfer_out_amount', 15, 2).notNullable().defaultTo(0.00);
    table.decimal('current_budget_amount', 15, 2).notNullable().defaultTo(0.00);
  });

  // 3. Create budget_monthly_allocations table
  await knex.schema.createTable('budget_monthly_allocations', table => {
    table.increments('id').primary();
    table.integer('budget_control_line_id').notNullable().references('id').inTable('budget_control_lines').onDelete('CASCADE');
    table.integer('month').notNullable(); // 1 to 12
    table.decimal('allocated_amount', 15, 2).notNullable();
    table.decimal('actual_amount', 15, 2).notNullable().defaultTo(0.00);
    table.decimal('committed_amount', 15, 2).notNullable().defaultTo(0.00);
    table.decimal('remaining_amount', 15, 2).notNullable().defaultTo(0.00);
    table.timestamps(true, true);

    table.unique(['budget_control_line_id', 'month']);
  });

  // 4. Create budget_transfers table for auditing department transfers
  await knex.schema.createTable('budget_transfers', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('from_budget_control_line_id').notNullable().references('id').inTable('budget_control_lines').onDelete('CASCADE');
    table.integer('to_budget_control_line_id').notNullable().references('id').inTable('budget_control_lines').onDelete('CASCADE');
    table.decimal('amount', 15, 2).notNullable();
    table.text('reason').nullable();
    table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('transfer_date').defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('budget_transfers');
  await knex.schema.dropTableIfExists('budget_monthly_allocations');
  
  await knex.schema.alterTable('budget_control_lines', table => {
    table.dropColumn('transfer_in_amount');
    table.dropColumn('transfer_out_amount');
    table.dropColumn('current_budget_amount');
  });

  await knex.schema.alterTable('budget_headers', table => {
    table.dropColumn('parent_budget_id');
    table.dropColumn('revision_number');
    table.dropColumn('created_from');
    table.dropColumn('effective_date');
    table.dropColumn('approved_date');
  });
};
