exports.up = function(knex) {
  return knex.schema.createTable('period_close_history', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('period_id').notNullable().references('id').inTable('accounting_periods').onDelete('CASCADE');
    table.string('action', 20).notNullable(); // 'CLOSE' | 'REOPEN'
    table.integer('performed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('performed_at').defaultTo(knex.fn.now());
    table.jsonb('checklist_snapshot').nullable();
    table.text('reason').nullable();
    
    table.index(['company_id']);
    table.index(['period_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('period_close_history');
};
