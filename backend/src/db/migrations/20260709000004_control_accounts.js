exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('accounts', 'is_control');
  if (!hasCol) {
    await knex.schema.alterTable('accounts', table => {
      table.boolean('is_control').notNullable().defaultTo(false);
    });
  }

  // Update existing standard control accounts to is_control = true
  await knex('accounts')
    .where('name', 'ilike', '%accumulated depreciation%')
    .orWhere('name', 'ilike', '%allowance for doubtful%')
    .orWhere('name', 'ilike', '%accounts receivable%')
    .orWhere('name', 'ilike', '%accounts payable%')
    .orWhere('name', 'ilike', '%inventory control%')
    .orWhere('name', 'ilike', '%inventory asset%')
    .update({ is_control: true });
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('accounts', 'is_control');
  if (hasCol) {
    await knex.schema.alterTable('accounts', table => {
      table.dropColumn('is_control');
    });
  }
};
