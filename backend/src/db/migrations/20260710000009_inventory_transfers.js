exports.up = async function(knex) {
  await knex.schema.createTable('inventory_transfers', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('reference', 100).notNullable();
    table.integer('from_warehouse_id').notNullable().references('warehouses.id').onDelete('RESTRICT');
    table.integer('to_warehouse_id').notNullable().references('warehouses.id').onDelete('RESTRICT');
    table.string('status', 30).notNullable().defaultTo('COMPLETED'); // DRAFT, PENDING_APPROVAL, APPROVED, IN_TRANSIT, RECEIVED, CANCELLED
    table.integer('created_by').references('users.id').onDelete('SET NULL');
    table.integer('approved_by').references('users.id').onDelete('SET NULL');
    table.integer('dispatched_by').references('users.id').onDelete('SET NULL');
    table.integer('received_by').references('users.id').onDelete('SET NULL');
    table.date('transfer_date').notNullable().defaultTo(knex.fn.now());
    table.timestamp('dispatch_date').nullable();
    table.timestamp('receive_date').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('inventory_transfer_lines', table => {
    table.increments('id').primary();
    table.integer('inventory_transfer_id').notNullable().references('inventory_transfers.id').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('products.id').onDelete('RESTRICT');
    table.decimal('quantity', 15, 4).notNullable();
    table.decimal('cost', 15, 2).notNullable();
    table.string('batch_no', 100).nullable();
    table.string('serial_no', 100).nullable();
    table.date('expiry_date').nullable();
    table.string('remarks', 300);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('inventory_transfer_lines');
  await knex.schema.dropTableIfExists('inventory_transfers');
};
