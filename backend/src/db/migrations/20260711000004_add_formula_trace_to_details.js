exports.up = function(knex) {
  return knex.schema.alterTable('payroll_line_details', table => {
    table.jsonb('formula_trace').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('payroll_line_details', table => {
    table.dropColumn('formula_trace');
  });
};
