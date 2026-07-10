exports.up = async function(knex) {
  await knex.schema.createTable('mail_configurations', table => {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.string('provider', 30).notNullable().defaultTo('MOCK'); // 'SMTP' | 'MOCK'
    table.string('host', 255);
    table.integer('port');
    table.string('username', 255);
    table.text('password'); // AES-256 encrypted
    table.string('from_name', 255);
    table.string('from_email', 255);
    table.string('encryption', 20).defaultTo('TLS'); // 'SSL' | 'TLS' | 'NONE'
    table.boolean('is_default').defaultTo(true);
    table.string('status', 30).defaultTo('ACTIVE');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('email_delivery_logs', table => {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.string('recipient', 255).notNullable();
    table.string('subject', 255).notNullable();
    table.string('provider', 50).notNullable();
    table.integer('duration_ms').defaultTo(0);
    table.text('smtp_response');
    table.string('status', 30).notNullable(); // 'SUCCESS' | 'FAILED'
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('email_delivery_logs');
  await knex.schema.dropTableIfExists('mail_configurations');
};
