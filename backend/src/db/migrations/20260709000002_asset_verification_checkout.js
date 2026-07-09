exports.up = async function(knex) {
  await knex.schema
    // 1. asset_assignments
    .createTable('asset_assignments', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
      table.date('checkout_date').nullable();
      table.date('expected_return').nullable();
      table.date('actual_return').nullable();
      table.string('status', 40).notNullable().defaultTo('RESERVED'); // 'RESERVED' | 'CHECKED_OUT' | 'RETURNED'
      table.text('notes').nullable();
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);
    })

    // 2. asset_verification_sessions
    .createTable('asset_verification_sessions', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('session_name', 150).notNullable();
      table.date('verification_date').notNullable();
      table.string('status', 40).notNullable().defaultTo('PLANNED'); // 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'CLOSED'
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);
    })

    // 3. asset_verification_items
    .createTable('asset_verification_items', table => {
      table.increments('id').primary();
      table.integer('session_id').notNullable().references('id').inTable('asset_verification_sessions').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.string('status', 40).notNullable().defaultTo('FOUND'); // 'FOUND' | 'MISSING' | 'DAMAGED' | 'RELOCATED' | 'NOT_IDENTIFIED' | 'UNDER_REPAIR'
      table.text('notes').nullable();
      table.integer('verified_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamp('verified_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function(knex) {
  await knex.schema
    .dropTableIfExists('asset_verification_items')
    .dropTableIfExists('asset_verification_sessions')
    .dropTableIfExists('asset_assignments');
};
