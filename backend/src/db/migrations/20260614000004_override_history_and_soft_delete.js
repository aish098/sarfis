exports.up = async function(knex) {
  // 1. Add columns to user_permission_overrides table
  await knex.schema.alterTable('user_permission_overrides', (table) => {
    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.integer('requested_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('approval_status', 50).notNullable().defaultTo('APPROVED'); // 'PENDING', 'APPROVED', 'REJECTED'
  });

  // 2. Create user_permission_overrides_history table
  await knex.schema.createTable('user_permission_overrides_history', (table) => {
    table.increments('id').primary();
    table.integer('override_id').unsigned().nullable()
      .references('id').inTable('user_permission_overrides').onDelete('SET NULL');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.integer('permission_id').unsigned().notNullable()
      .references('id').inTable('permissions').onDelete('CASCADE');
    table.boolean('is_allowed').notNullable();
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    table.string('reason', 255).nullable();
    table.integer('requested_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('approved_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('approval_status', 50).notNullable().defaultTo('APPROVED');
    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.string('action', 50).notNullable(); // 'CREATED', 'UPDATED', 'RESET', 'APPROVED'
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  // 1. Drop user_permission_overrides_history table
  await knex.schema.dropTableIfExists('user_permission_overrides_history');

  // 2. Remove columns from user_permission_overrides table
  await knex.schema.alterTable('user_permission_overrides', (table) => {
    table.dropColumn('approval_status');
    table.dropColumn('requested_by');
    table.dropColumn('is_deleted');
  });
};
