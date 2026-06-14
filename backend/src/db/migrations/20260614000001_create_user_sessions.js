exports.up = function(knex) {
  return knex.schema.createTable('user_sessions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('company_id').unsigned().nullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.string('ip_address');
    table.string('device');
    table.timestamp('login_time').defaultTo(knex.fn.now());
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.boolean('is_active').defaultTo(true);
    
    table.index(['user_id', 'company_id', 'is_active']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_sessions');
};
