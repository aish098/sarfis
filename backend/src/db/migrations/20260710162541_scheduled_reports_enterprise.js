exports.up = function(knex) {
  return knex.schema
    .createTable('scheduled_reports', table => {
      table.increments('id').primary();
      table.integer('company_id').unsigned().notNullable()
        .references('id').inTable('companies').onDelete('CASCADE');
      table.string('report_type').notNullable(); // BALANCE_SHEET, INCOME_STATEMENT, CASH_FLOW, TRIAL_BALANCE, EQUITY
      table.string('frequency').notNullable(); // DAILY, WEEKLY, MONTHLY
      table.string('format').notNullable(); // PDF, EXCEL, CSV
      table.boolean('enabled').defaultTo(true);
      table.timestamp('next_run').nullable();
      table.integer('created_by').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    .createTable('report_recipients', table => {
      table.increments('id').primary();
      table.integer('schedule_id').unsigned().notNullable()
        .references('id').inTable('scheduled_reports').onDelete('CASCADE');
      table.integer('employee_id').unsigned().nullable();
      table.string('email').notNullable();
    })
    .createTable('report_history', table => {
      table.increments('id').primary();
      table.integer('schedule_id').unsigned().notNullable()
        .references('id').inTable('scheduled_reports').onDelete('CASCADE');
      table.timestamp('generated_at').defaultTo(knex.fn.now());
      table.string('status').notNullable(); // SUCCESS, FAILED
      table.string('file_name').nullable();
      table.integer('duration').nullable(); // milliseconds
      table.text('error').nullable();
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('report_history')
    .dropTableIfExists('report_recipients')
    .dropTableIfExists('scheduled_reports');
};
