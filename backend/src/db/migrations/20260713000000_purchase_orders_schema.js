exports.up = async function(knex) {
  await knex.schema
    .createTable('purchase_orders', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('vendor_id').nullable().references('id').inTable('vendors').onDelete('SET NULL');
      table.string('po_number', 50).notNullable();
      table.date('date').notNullable().defaultTo(knex.fn.now());
      table.string('status', 30).notNullable().defaultTo('DRAFT'); // 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED'
      table.decimal('total_amount', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0.00);
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.unique(['company_id', 'po_number']);
      table.index(['company_id', 'status']);
    })
    .createTable('purchase_order_items', table => {
      table.increments('id').primary();
      table.integer('purchase_order_id').notNullable().references('id').inTable('purchase_orders').onDelete('CASCADE');
      table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.decimal('quantity', 15, 4).notNullable();
      table.decimal('unit_price', 15, 2).notNullable();
      table.decimal('line_total', 15, 2).notNullable();
    });

  // Alter delivery_items table to add discount and offer if not exists
  const hasDiscount = await knex.schema.hasColumn('delivery_items', 'discount');
  if (!hasDiscount) {
    await knex.schema.alterTable('delivery_items', table => {
      table.decimal('discount', 15, 2).defaultTo(0.00).notNullable();
    });
  }

  const hasOffer = await knex.schema.hasColumn('delivery_items', 'offer');
  if (!hasOffer) {
    await knex.schema.alterTable('delivery_items', table => {
      table.string('offer', 150).nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('purchase_order_items');
  await knex.schema.dropTableIfExists('purchase_orders');
  
  const hasDiscount = await knex.schema.hasColumn('delivery_items', 'discount');
  if (hasDiscount) {
    await knex.schema.alterTable('delivery_items', table => {
      table.dropColumn('discount');
    });
  }

  const hasOffer = await knex.schema.hasColumn('delivery_items', 'offer');
  if (hasOffer) {
    await knex.schema.alterTable('delivery_items', table => {
      table.dropColumn('offer');
    });
  }
};
