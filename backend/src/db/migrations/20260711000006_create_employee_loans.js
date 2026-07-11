exports.up = function(knex) {
  return knex.schema.createTable('employee_loans', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    table.decimal('amount', 15, 2).notNullable();
    table.string('purpose', 255).notNullable();
    table.integer('repayment_period').defaultTo(12).notNullable(); // in months
    table.decimal('monthly_installment', 15, 2).notNullable();
    table.string('status', 30).defaultTo('PENDING').notNullable(); // 'PENDING', 'APPROVED', 'REJECTED'
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('employee_loans');
};
