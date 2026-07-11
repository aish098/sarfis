exports.up = function(knex) {
  return knex.schema
    .alterTable('payroll_runs', table => {
      table.string('rule_engine_version', 20).defaultTo('5A.1').notNullable();
    })
    .alterTable('salary_components', table => {
      table.boolean('is_system_component').defaultTo(false).notNullable();
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('payroll_runs', table => {
      table.dropColumn('rule_engine_version');
    })
    .alterTable('salary_components', table => {
      table.dropColumn('is_system_component');
    });
};
