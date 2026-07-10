exports.up = function(knex) {
  return knex.schema
    .createTable('budget_headers', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('fiscal_year', 10).notNullable(); // e.g. '2026'
      table.string('name', 150).notNullable(); // e.g. '2026 Core Operating Budget'
      table.string('version_name', 50).defaultTo('Original'); // 'Original' | 'Revised' | 'Forecast'
      table.string('status', 30).defaultTo('DRAFT'); // 'DRAFT' | 'ACTIVE' | 'CLOSED'
      table.timestamps(true, true);
    })
    .createTable('budget_control_lines', table => {
      table.increments('id').primary();
      table.integer('budget_header_id').notNullable().references('id').inTable('budget_headers').onDelete('CASCADE');
      table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
      table.string('department', 100).nullable(); // e.g. 'Marketing'
      table.string('project', 100).nullable(); // e.g. 'Campaign Alpha'
      table.string('branch', 100).nullable(); // e.g. 'Karachi'
      table.decimal('allocated_amount', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('alert_threshold_pct', 5, 2).defaultTo(90.00);
      table.string('control_level', 30).defaultTo('BLOCK'); // 'NONE' | 'WARN' | 'BLOCK'
      table.timestamps(true, true);

      table.unique(['budget_header_id', 'account_id', 'department', 'project', 'branch'], 'idx_budget_line_dims');
    })
    .createTable('budget_control_transactions', table => {
      table.increments('id').primary();
      table.integer('budget_control_line_id').notNullable().references('id').inTable('budget_control_lines').onDelete('CASCADE');
      table.string('document_type', 50).notNullable(); // 'VOUCHER' | 'JOURNAL'
      table.integer('document_id').notNullable();
      table.decimal('amount', 15, 2).notNullable(); // positive for debit/spend, negative for credit/reversal
      table.string('status', 30).defaultTo('ACTUAL'); // 'COMMITTED' | 'ACTUAL'
      table.date('posting_date').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .alterTable('journal_lines', table => {
      table.string('department', 100).nullable();
      table.string('project', 100).nullable();
      table.string('branch', 100).nullable();
    })
    .alterTable('vouchers', table => {
      table.string('department', 100).nullable();
      table.string('project', 100).nullable();
      table.string('branch', 100).nullable();
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('vouchers', table => {
      table.dropColumn('branch');
      table.dropColumn('project');
      table.dropColumn('department');
    })
    .alterTable('journal_lines', table => {
      table.dropColumn('branch');
      table.dropColumn('project');
      table.dropColumn('department');
    })
    .dropTableIfExists('budget_control_transactions')
    .dropTableIfExists('budget_control_lines')
    .dropTableIfExists('budget_headers');
};
