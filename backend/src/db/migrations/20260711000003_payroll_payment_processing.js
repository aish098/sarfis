exports.up = function(knex) {
  return knex.schema
    // 1. Create payroll_payment_batches Table
    .createTable('payroll_payment_batches', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('period', 10).notNullable();
      table.string('batch_reference', 50).notNullable();
      table.string('payment_method', 20).notNullable().defaultTo('BANK');
      table.string('bank_name', 100).nullable();
      table.string('bank_file_path', 255).nullable();
      table.string('payment_file_type', 20).nullable();
      table.string('status', 20).notNullable().defaultTo('DRAFT');
      table.decimal('total_amount', 15, 2).notNullable().defaultTo(0.00);
      table.integer('employee_count').notNullable().defaultTo(0);
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('approved_at').nullable();
      table.timestamp('sent_at').nullable();
      table.timestamp('reconciled_at').nullable();
      table.timestamp('paid_at').nullable();
      table.timestamps(true, true);
    })
    // 2. Alter payroll_lines Table to add payment tracking fields
    .alterTable('payroll_lines', table => {
      table.string('payment_status', 30).notNullable().defaultTo('PENDING');
      table.date('payment_date').nullable();
      table.string('hold_type', 30).nullable();
      table.text('hold_reason').nullable();
      table.integer('hold_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('hold_at').nullable();
    })
    // 3. Create payroll_payments Table
    .createTable('payroll_payments', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('payroll_line_id').notNullable().references('id').inTable('payroll_lines').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.integer('payment_batch_id').nullable().references('id').inTable('payroll_payment_batches').onDelete('SET NULL');
      table.integer('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.string('payment_method', 20).notNullable().defaultTo('BANK');
      table.string('bank_account', 50).notNullable();
      table.decimal('amount', 15, 2).notNullable();
      table.string('currency', 3).notNullable().defaultTo('PKR');
      table.decimal('exchange_rate', 10, 4).notNullable().defaultTo(1.0000);
      table.date('payment_date').notNullable();
      table.string('payment_reference', 50).notNullable();
      table.string('bank_id', 50).nullable();
      table.text('bank_response').nullable();
      table.text('remarks').nullable();
      table.boolean('is_reversal').notNullable().defaultTo(false);
      table.integer('reversal_payment_id').nullable();
      table.timestamp('reversed_at').nullable();
      table.integer('reversed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);
    })
    // 4. Create payroll_adjustments Table
    .createTable('payroll_adjustments', table => {
      table.increments('id').primary();
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.integer('payroll_line_id').notNullable().references('id').inTable('payroll_lines').onDelete('CASCADE');
      table.string('type', 30).notNullable();
      table.decimal('amount', 15, 2).notNullable();
      table.text('reason').notNullable();
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);
    })
    // 5. Create payroll_payslips Table
    .createTable('payroll_payslips', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.integer('payroll_line_id').notNullable().references('id').inTable('payroll_lines').onDelete('CASCADE');
      table.string('pdf_path', 255).notNullable();
      table.string('template_version', 20).notNullable().defaultTo('v1.0');
      table.string('checksum', 64).nullable();
      table.string('generated_hash', 64).nullable();
      table.boolean('email_sent').notNullable().defaultTo(false);
      table.timestamp('email_sent_at').nullable();
      table.integer('generated_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);
    })
    // 6. Create payroll_status_history Table
    .createTable('payroll_status_history', table => {
      table.increments('id').primary();
      table.integer('payroll_line_id').notNullable().references('id').inTable('payroll_lines').onDelete('CASCADE');
      table.string('old_status', 30).notNullable();
      table.string('new_status', 30).notNullable();
      table.text('reason').nullable();
      table.integer('changed_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamp('changed_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('payroll_status_history')
    .dropTableIfExists('payroll_payslips')
    .dropTableIfExists('payroll_adjustments')
    .dropTableIfExists('payroll_payments')
    .alterTable('payroll_lines', table => {
      table.dropColumn('hold_at');
      table.dropColumn('hold_by');
      table.dropColumn('hold_reason');
      table.dropColumn('hold_type');
      table.dropColumn('payment_date');
      table.dropColumn('payment_status');
    })
    .dropTableIfExists('payroll_payment_batches');
};
