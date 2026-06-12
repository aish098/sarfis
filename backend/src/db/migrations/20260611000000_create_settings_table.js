exports.up = function(knex) {
  return knex.schema.createTable('settings', (table) => {
    table.increments('id').primary();
    table.string('scope', 50).notNullable();
    table.string('target_id', 100).notNullable();
    table.jsonb('value').notNullable().defaultTo('{}');
    table.timestamps(true, true);
    table.unique(['scope', 'target_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('settings');
};
