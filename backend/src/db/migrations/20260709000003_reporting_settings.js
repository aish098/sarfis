exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('company_accounting_settings', 'negative_balance_style');
  if (!hasCol) {
    await knex.schema.alterTable('company_accounting_settings', table => {
      table.string('negative_balance_style', 30).notNullable().defaultTo('minus'); // 'minus' | 'parentheses' | 'red'
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('company_accounting_settings', 'negative_balance_style');
  if (hasCol) {
    await knex.schema.alterTable('company_accounting_settings', table => {
      table.dropColumn('negative_balance_style');
    });
  }
};
