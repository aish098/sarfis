exports.up = function(knex) {
  return knex.schema.table('company_accounting_settings', table => {
    table.integer('default_tax_payable_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
    table.integer('default_tax_receivable_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.table('company_accounting_settings', table => {
    table.dropColumn('default_tax_payable_account_id');
    table.dropColumn('default_tax_receivable_account_id');
  });
};
