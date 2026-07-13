exports.up = async function(knex) {
  // 1. Create sales_orders table
  await knex.schema.createTable('sales_orders', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('so_number', 50).notNullable();
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('RESTRICT');
    table.integer('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
    table.date('delivery_date').notNullable();
    table.string('status', 30).notNullable().defaultTo('DRAFT');
    table.decimal('total_amount', 15, 2).defaultTo(0.00);
    table.text('notes').nullable();
    table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.unique(['company_id', 'so_number']);
  });

  // 2. Create sales_order_items table
  await knex.schema.createTable('sales_order_items', table => {
    table.increments('id').primary();
    table.integer('sales_order_id').notNullable().references('id').inTable('sales_orders').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    table.decimal('quantity', 15, 4).notNullable();
    table.decimal('unit_price', 15, 2).notNullable();
    table.decimal('discount', 15, 2).defaultTo(0.00);
    table.decimal('line_total', 15, 2).notNullable();
    table.text('notes').nullable();
  });

  // 3. Alter deliveries table to add sales_order_id reference
  const hasSOInDeliveries = await knex.schema.hasColumn('deliveries', 'sales_order_id');
  if (!hasSOInDeliveries) {
    await knex.schema.alterTable('deliveries', table => {
      table.integer('sales_order_id').nullable().references('id').inTable('sales_orders').onDelete('SET NULL');
    });
  }

  // 4. Alter vouchers table to add sales_order_id reference
  const hasSOInVouchers = await knex.schema.hasColumn('vouchers', 'sales_order_id');
  if (!hasSOInVouchers) {
    await knex.schema.alterTable('vouchers', table => {
      table.integer('sales_order_id').nullable().references('id').inTable('sales_orders').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  // Alter vouchers to drop column
  const hasSOInVouchers = await knex.schema.hasColumn('vouchers', 'sales_order_id');
  if (hasSOInVouchers) {
    await knex.schema.alterTable('vouchers', table => {
      table.dropColumn('sales_order_id');
    });
  }

  // Alter deliveries to drop column
  const hasSOInDeliveries = await knex.schema.hasColumn('deliveries', 'sales_order_id');
  if (hasSOInDeliveries) {
    await knex.schema.alterTable('deliveries', table => {
      table.dropColumn('sales_order_id');
    });
  }

  await knex.schema.dropTableIfExists('sales_order_items');
  await knex.schema.dropTableIfExists('sales_orders');
};
