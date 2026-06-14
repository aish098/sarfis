exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('action').notNullable(); // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    table.string('entity_type').notNullable(); 
    table.string('entity_id'); 
    table.jsonb('before_state'); 
    table.jsonb('after_state');
    table.string('ip_address');
    table.string('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['company_id', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
