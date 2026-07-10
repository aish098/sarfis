exports.up = async function(knex) {
  await knex.schema.createTable('employee_notification_subscriptions', table => {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('CASCADE');
    table.integer('event_id').unsigned().notNullable()
      .references('id').inTable('notification_events').onDelete('CASCADE');
    table.string('channel', 30).notNullable(); // 'EMAIL' | 'APP' | 'SMS' | 'WHATSAPP' | 'SLACK' | 'TEAMS'
    table.boolean('enabled').defaultTo(true).notNullable();
    table.timestamps(true, true);

    table.unique(['company_id', 'employee_id', 'event_id', 'channel']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('employee_notification_subscriptions');
};
