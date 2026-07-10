exports.up = function(knex) {
  return knex.schema
    .alterTable('budget_headers', table => {
      table.string('scenario_type').defaultTo('EXPECTED').notNullable();
    })
    .createTable('budget_dashboard_cache', table => {
      table.increments('id').primary();
      table.integer('company_id').references('id').inTable('companies').onDelete('CASCADE').notNullable();
      table.string('fiscal_year').notNullable();
      table.string('scenario_type').notNullable();
      table.string('version_name').notNullable();
      table.decimal('total_budget', 15, 2).defaultTo(0.00).notNullable();
      table.decimal('actual_spent', 15, 2).defaultTo(0.00).notNullable();
      table.decimal('committed_spent', 15, 2).defaultTo(0.00).notNullable();
      table.decimal('forecast_year_end', 15, 2).defaultTo(0.00).notNullable();
      table.decimal('variance', 15, 2).defaultTo(0.00).notNullable();
      table.decimal('utilization_pct', 5, 2).defaultTo(0.00).notNullable();
      table.string('risk_level').defaultTo('LOW').notNullable();
      table.integer('departments_over_budget').defaultTo(0).notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      
      table.unique(['company_id', 'fiscal_year', 'scenario_type', 'version_name']);
    })
    .createTable('budget_forecast_overrides', table => {
      table.increments('id').primary();
      table.integer('budget_control_line_id').references('id').inTable('budget_control_lines').onDelete('CASCADE').notNullable();
      table.decimal('override_amount', 15, 2).notNullable();
      table.text('reason').notNullable();
      table.integer('adjusted_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('adjusted_at').defaultTo(knex.fn.now()).notNullable();

      table.unique(['budget_control_line_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('budget_forecast_overrides')
    .dropTableIfExists('budget_dashboard_cache')
    .alterTable('budget_headers', table => {
      table.dropColumn('scenario_type');
    });
};
