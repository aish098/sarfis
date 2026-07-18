exports.up = async function(knex) {
  // 1. Alter company_accounting_settings to add inventory_costing_method
  await knex.schema.alterTable('company_accounting_settings', table => {
    table.string('inventory_costing_method', 20).defaultTo('AVERAGE').notNullable();
  });

  // 2. Create inventory_layers table
  await knex.schema.createTable('inventory_layers', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('warehouse_id').notNullable().references('id').inTable('warehouses').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.decimal('received_qty', 15, 4).notNullable();
    table.decimal('remaining_qty', 15, 4).notNullable();
    table.decimal('unit_cost', 15, 4).notNullable();
    table.string('source_document', 255).nullable();
    table.string('source_type', 50).nullable(); // 'purchase_order', 'goods_receipt', 'voucher', 'adjustment'
    table.timestamp('received_date').notNullable().defaultTo(knex.fn.now());
    table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance
    table.index(['product_id', 'warehouse_id', 'remaining_qty']);
    table.index(['received_date']);
  });

  // 3. Create inventory_layer_consumptions table
  await knex.schema.createTable('inventory_layer_consumptions', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('layer_id').notNullable().references('id').inTable('inventory_layers').onDelete('CASCADE');
    table.integer('stock_log_id').notNullable().references('id').inTable('stock_logs').onDelete('CASCADE');
    table.decimal('issued_qty', 15, 4).notNullable();
    table.decimal('unit_cost', 15, 4).notNullable();
    table.decimal('extended_cost', 15, 4).notNullable();
    table.string('document_type', 50).nullable(); // 'voucher', 'delivery', 'adjustment'
    table.string('document_number', 255).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('inventory_layer_consumptions');
  await knex.schema.dropTableIfExists('inventory_layers');
  await knex.schema.alterTable('company_accounting_settings', table => {
    table.dropColumn('inventory_costing_method');
  });
};
