
exports.up = function(knex) {
  return knex.schema.table('deliveries', table => {
    table.integer('ar_account_id').unsigned().references('id').inTable('accounts').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.table('deliveries', table => {
    table.dropColumn('ar_account_id');
  });
};
