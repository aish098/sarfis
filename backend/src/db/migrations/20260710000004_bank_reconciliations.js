exports.up = function(knex) {
  return knex.schema.createTable('bank_reconciliations', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
    table.string('period_name', 20).notNullable();
    table.decimal('statement_balance', 15, 2).notNullable();
    table.decimal('ledger_balance', 15, 2).notNullable();
    table.timestamp('reconciled_at').defaultTo(knex.fn.now());
    table.integer('reconciled_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    
    table.unique(['company_id', 'account_id', 'period_name']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('bank_reconciliations');
};
