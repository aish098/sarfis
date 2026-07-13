exports.up = async function(knex) {
  await knex.schema
    .createTable('goods_receipts', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('purchase_order_id').nullable().references('id').inTable('purchase_orders').onDelete('SET NULL');
      table.string('grn_number', 50).notNullable();
      table.integer('vendor_id').notNullable().references('id').inTable('vendors').onDelete('RESTRICT');
      table.integer('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('RESTRICT');
      table.date('received_date').notNullable();
      table.integer('received_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('status', 30).notNullable().defaultTo('DRAFT'); // 'DRAFT', 'RECEIVED'
      table.string('supplier_reference', 100).nullable(); // Supplier Delivery Note/Challan
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.unique(['company_id', 'grn_number']);
      table.index(['company_id', 'status']);
    })
    .createTable('goods_receipt_items', table => {
      table.increments('id').primary();
      table.integer('goods_receipt_id').notNullable().references('id').inTable('goods_receipts').onDelete('CASCADE');
      table.integer('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
      table.decimal('quantity_ordered', 15, 4).notNullable();
      table.decimal('quantity_received', 15, 4).notNullable();
      table.decimal('quantity_rejected', 15, 4).notNullable().defaultTo(0.0000);
      table.text('notes').nullable(); // Rejected items explanation
    });

  // Alter vouchers to add goods_receipt_id reference
  await knex.schema.alterTable('vouchers', table => {
    table.integer('goods_receipt_id').nullable().references('id').inTable('goods_receipts').onDelete('SET NULL');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('vouchers', table => {
    table.dropColumn('goods_receipt_id');
  });
  await knex.schema.dropTableIfExists('goods_receipt_items');
  await knex.schema.dropTableIfExists('goods_receipts');
};
