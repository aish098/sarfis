exports.up = async function(knex) {
  await knex.schema.alterTable('journal_entries', table => {
    table.string('status', 20).defaultTo('POSTED'); // Default to POSTED for existing entries
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('journal_entries', table => {
    table.dropColumn('status');
  });
};
