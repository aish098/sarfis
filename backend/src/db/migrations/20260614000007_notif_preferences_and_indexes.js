exports.up = async function(knex) {
  // 1. Create user_notification_preferences table
  await knex.schema.createTable('user_notification_preferences', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('company_id').unsigned().nullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.boolean('email_enabled').notNullable().defaultTo(true);
    table.boolean('in_app_enabled').notNullable().defaultTo(true);
    table.boolean('critical_only').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['user_id', 'company_id']);
  });

  // 2. Safely add database indexes
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON audit_logs(company_id, created_at)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_overrides_user_company ON user_permission_overrides(user_id, company_id)');
};

exports.down = async function(knex) {
  // Drop indexes safely
  await knex.raw('DROP INDEX IF EXISTS idx_notifications_user_read');
  await knex.raw('DROP INDEX IF EXISTS idx_notifications_company');
  await knex.raw('DROP INDEX IF EXISTS idx_audit_logs_company_created');
  await knex.raw('DROP INDEX IF EXISTS idx_overrides_user_company');

  // Drop table
  await knex.schema.dropTableIfExists('user_notification_preferences');
};
