exports.up = function(knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.string('type', 30).defaultTo('system'); // 'approval', 'period', 'permission', 'system'
    table.string('priority', 20).defaultTo('MEDIUM'); // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    table.string('entity_type', 50).nullable(); // e.g. 'voucher', 'journal'
    table.integer('entity_id').nullable(); // e.g. voucher id or journal entry id
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_archived').defaultTo(false);
    table.timestamps(true, true);

    table.index(['company_id', 'user_id', 'is_read', 'is_archived']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('notifications');
};
