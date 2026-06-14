exports.up = async function(knex) {
  // 1. Add columns to user_permission_overrides
  await knex.schema.alterTable('user_permission_overrides', (table) => {
    table.string('reason', 255).nullable();
    table.integer('approved_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
  });

  // 2. Add permissions_cache column to user_sessions
  await knex.schema.alterTable('user_sessions', (table) => {
    table.jsonb('permissions_cache').nullable();
  });
};

exports.down = async function(knex) {
  // 1. Remove permissions_cache from user_sessions
  await knex.schema.alterTable('user_sessions', (table) => {
    table.dropColumn('permissions_cache');
  });

  // 2. Remove columns from user_permission_overrides
  await knex.schema.alterTable('user_permission_overrides', (table) => {
    table.dropColumn('approved_by');
    table.dropColumn('reason');
  });
};
