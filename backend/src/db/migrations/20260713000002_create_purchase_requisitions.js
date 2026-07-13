exports.up = async function(knex) {
  await knex.schema
    .createTable('purchase_requisitions', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('requested_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('requisition_number', 50).notNullable();
      table.string('department', 100).nullable();
      table.date('required_date').notNullable();
      table.string('priority', 30).notNullable().defaultTo('NORMAL'); // 'LOW', 'NORMAL', 'HIGH', 'URGENT'
      table.text('reason').nullable();
      table.string('status', 30).notNullable().defaultTo('DRAFT'); // 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONVERTED_TO_PO', 'CLOSED', 'REJECTED'
      table.decimal('estimated_total', 15, 2).notNullable().defaultTo(0.00);
      table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('approved_at').nullable();
      table.timestamps(true, true);

      table.unique(['company_id', 'requisition_number']);
      table.index(['company_id', 'status']);
    })
    .createTable('purchase_requisition_items', table => {
      table.increments('id').primary();
      table.integer('purchase_requisition_id').notNullable().references('id').inTable('purchase_requisitions').onDelete('CASCADE');
      table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.text('description').nullable();
      table.decimal('quantity', 15, 4).notNullable();
      table.decimal('estimated_price', 15, 2).notNullable();
      table.decimal('line_total', 15, 2).notNullable();
    });

  // Alter purchase_orders to add purchase_requisition_id reference
  await knex.schema.alterTable('purchase_orders', table => {
    table.integer('purchase_requisition_id').nullable().references('id').inTable('purchase_requisitions').onDelete('SET NULL');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('purchase_orders', table => {
    table.dropColumn('purchase_requisition_id');
  });
  await knex.schema.dropTableIfExists('purchase_requisition_items');
  await knex.schema.dropTableIfExists('purchase_requisitions');
};
