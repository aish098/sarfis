exports.up = async function(knex) {
  await knex.schema.alterTable('notifications', table => {
    table.boolean('is_archived').defaultTo(false).notNullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('notifications', table => {
    table.dropColumn('is_archived');
  });
};
