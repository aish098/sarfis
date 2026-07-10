exports.up = function(knex) {
  return knex.schema
    .createTable('attendance_logs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.date('date').notNullable();
      table.string('status', 30).notNullable(); // 'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'
      table.decimal('working_hours', 5, 2).notNullable().defaultTo(8.00);
      table.timestamps(true, true);
      table.unique(['employee_id', 'date']);
    })
    .createTable('leave_balances', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.string('leave_type', 30).notNullable(); // 'ANNUAL', 'SICK', 'CASUAL'
      table.integer('allocated_days').notNullable().defaultTo(0);
      table.integer('used_days').notNullable().defaultTo(0);
      table.timestamps(true, true);
      table.unique(['employee_id', 'leave_type']);
    })
    .createTable('leave_applications', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.string('leave_type', 30).notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.integer('days').notNullable();
      table.string('status', 30).defaultTo('DRAFT').notNullable(); // 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
      table.timestamps(true, true);
    })
    .createTable('overtime_records', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.date('date').notNullable();
      table.decimal('hours', 5, 2).notNullable();
      table.decimal('multiplier', 3, 2).defaultTo(1.50).notNullable();
      table.decimal('amount', 15, 2).notNullable();
      table.string('status', 30).defaultTo('PENDING').notNullable(); // 'PENDING', 'APPROVED'
      table.timestamps(true, true);
    })
    .createTable('payroll_runs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('period', 10).notNullable(); // YYYY-MM
      table.string('status', 30).defaultTo('DRAFT').notNullable(); // 'DRAFT', 'PENDING_APPROVAL', 'POSTED', 'REVERSED'
      table.decimal('total_gross', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('total_deductions', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('total_net', 15, 2).notNullable().defaultTo(0.00);
      table.integer('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.unique(['company_id', 'period']);
    })
    .createTable('payroll_lines', table => {
      table.increments('id').primary();
      table.integer('payroll_run_id').notNullable().references('id').inTable('payroll_runs').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.decimal('basic_salary', 15, 2).notNullable();
      table.decimal('house_rent', 15, 2).notNullable();
      table.decimal('medical_allowance', 15, 2).notNullable();
      table.decimal('transport_allowance', 15, 2).notNullable();
      table.decimal('overtime_amount', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('tax_deduction', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('pf_deduction', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('eobi_deduction', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('social_security_deduction', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('gross_salary', 15, 2).notNullable();
      table.decimal('net_salary', 15, 2).notNullable();
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('payroll_lines')
    .dropTableIfExists('payroll_runs')
    .dropTableIfExists('overtime_records')
    .dropTableIfExists('leave_applications')
    .dropTableIfExists('leave_balances')
    .dropTableIfExists('attendance_logs');
};
