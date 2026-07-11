exports.up = function(knex) {
  return knex.schema
    // 1. Create salary_components Table
    .createTable('salary_components', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('code', 30).notNullable();
      table.string('name', 100).notNullable();
      table.string('type', 20).notNullable(); // 'EARNING', 'DEDUCTION'
      table.string('category', 30).notNullable(); // 'BASIC', 'ALLOWANCE', 'BONUS', 'TAX', 'PF', etc.
      table.string('calculation_type', 20).notNullable(); // 'FIXED', 'PERCENTAGE', 'FORMULA'
      table.text('formula_expression').nullable();
      table.decimal('default_value', 15, 2).defaultTo(0.00).notNullable();
      table.boolean('taxable').defaultTo(true).notNullable();
      table.boolean('is_pf').defaultTo(false).notNullable();
      table.integer('gl_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('sequence_no').defaultTo(0).notNullable();
      table.integer('display_order').defaultTo(0).notNullable();
      table.boolean('is_active').defaultTo(true).notNullable();
      table.date('effective_from').nullable();
      table.date('effective_to').nullable();
      table.timestamps(true, true);
      
      table.unique(['company_id', 'code']);
    })
    // 2. Create salary_structures Table
    .createTable('salary_structures', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('code', 30).notNullable();
      table.string('name', 100).notNullable();
      table.text('description').nullable();
      table.string('status', 20).defaultTo('ACTIVE').notNullable(); // 'DRAFT', 'ACTIVE', 'ARCHIVED'
      table.date('effective_from').nullable();
      table.date('effective_to').nullable();
      table.timestamps(true, true);

      table.unique(['company_id', 'code']);
    })
    // 3. Create salary_structure_components Table
    .createTable('salary_structure_components', table => {
      table.increments('id').primary();
      table.integer('structure_id').notNullable().references('id').inTable('salary_structures').onDelete('CASCADE');
      table.integer('component_id').notNullable().references('id').inTable('salary_components').onDelete('CASCADE');
      table.decimal('value', 15, 2).notNullable();
      table.timestamps(true, true);

      table.unique(['structure_id', 'component_id']);
    })
    // 4. Create employee_salary_components Table
    .createTable('employee_salary_components', table => {
      table.increments('id').primary();
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.integer('component_id').notNullable().references('id').inTable('salary_components').onDelete('CASCADE');
      table.decimal('value', 15, 2).notNullable();
      table.timestamps(true, true);

      table.unique(['employee_id', 'component_id']);
    })
    // 5. Create payroll_line_details Table
    .createTable('payroll_line_details', table => {
      table.increments('id').primary();
      table.integer('payroll_line_id').notNullable().references('id').inTable('payroll_lines').onDelete('CASCADE');
      table.integer('component_id').nullable().references('id').inTable('salary_components').onDelete('SET NULL');
      table.string('component_name', 100).notNullable();
      table.string('component_code', 30).notNullable();
      table.string('component_type', 20).notNullable();
      table.string('calculation_type', 20).notNullable();
      table.string('source', 30).notNullable(); // 'DEFAULT', 'STRUCTURE', 'EMPLOYEE_OVERRIDE', 'SYSTEM'
      table.text('formula_used').nullable();
      table.decimal('rate', 15, 2).nullable();
      table.decimal('base_amount', 15, 2).nullable();
      table.decimal('amount', 15, 2).notNullable();
      table.integer('gl_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('display_order').defaultTo(0).notNullable();
      table.timestamps(true, true);
    })
    // 6. Alter employees table to add salary_structure_id
    .alterTable('employees', table => {
      table.integer('salary_structure_id').nullable().references('id').inTable('salary_structures').onDelete('SET NULL');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('employees', table => {
      table.dropColumn('salary_structure_id');
    })
    .dropTableIfExists('payroll_line_details')
    .dropTableIfExists('employee_salary_components')
    .dropTableIfExists('salary_structure_components')
    .dropTableIfExists('salary_structures')
    .dropTableIfExists('salary_components');
};
