exports.up = async function(knex) {
  const hasPOCol = await knex.schema.hasColumn('vouchers', 'purchase_order_id');
  if (!hasPOCol) {
    await knex.schema.alterTable('vouchers', table => {
      table.integer('purchase_order_id').nullable().references('id').inTable('purchase_orders').onDelete('SET NULL');
    });
  }

  const hasVoucherCol = await knex.schema.hasColumn('deliveries', 'voucher_id');
  if (!hasVoucherCol) {
    await knex.schema.alterTable('deliveries', table => {
      table.integer('voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  const hasVoucherCol = await knex.schema.hasColumn('deliveries', 'voucher_id');
  if (hasVoucherCol) {
    await knex.schema.alterTable('deliveries', table => {
      table.dropColumn('voucher_id');
    });
  }

  const hasPOCol = await knex.schema.hasColumn('vouchers', 'purchase_order_id');
  if (hasPOCol) {
    await knex.schema.alterTable('vouchers', table => {
      table.dropColumn('purchase_order_id');
    });
  }
};
