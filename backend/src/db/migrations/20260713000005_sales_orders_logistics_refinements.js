exports.up = async function(knex) {
  // 1. Alter products table
  const hasShelf = await knex.schema.hasColumn('products', 'shelf_location');
  if (!hasShelf) {
    await knex.schema.alterTable('products', table => {
      table.string('shelf_location', 100).nullable();
    });
  }

  // 2. Seed some demo shelf locations for aish098/sarfis products
  await knex('products').where('sku', 'like', '%LAP%').update({ shelf_location: 'A-12' });
  await knex('products').where('sku', 'like', '%MON%').update({ shelf_location: 'A-15' });
  await knex('products').where('name', 'like', '%Desk%').update({ shelf_location: 'B-04' });
  await knex('products').where('name', 'like', '%Chair%').update({ shelf_location: 'B-05' });
  await knex('products').where('name', 'like', '%Paper%').update({ shelf_location: 'C-01' });
  await knex('products').where('name', 'like', '%Pen%').update({ shelf_location: 'C-02' });

  // 3. Alter deliveries table
  await knex.schema.alterTable('deliveries', table => {
    table.string('driver_name', 150).nullable();
    table.string('vehicle_number', 50).nullable();
    table.string('courier_name', 150).nullable();
    table.string('tracking_number', 100).nullable();
    table.timestamp('dispatch_time').nullable();
    table.timestamp('arrival_time').nullable();
    table.string('receiver_name', 150).nullable();
    table.text('receiver_signature').nullable();
    table.text('remarks').nullable();
  });

  // 4. Alter sales_order_items table
  const hasQtyDispatched = await knex.schema.hasColumn('sales_order_items', 'quantity_dispatched');
  if (!hasQtyDispatched) {
    await knex.schema.alterTable('sales_order_items', table => {
      table.decimal('quantity_dispatched', 15, 4).defaultTo(0.0000).notNullable();
    });
  }
};

exports.down = async function(knex) {
  const hasQtyDispatched = await knex.schema.hasColumn('sales_order_items', 'quantity_dispatched');
  if (hasQtyDispatched) {
    await knex.schema.alterTable('sales_order_items', table => {
      table.dropColumn('quantity_dispatched');
    });
  }

  await knex.schema.alterTable('deliveries', table => {
    table.dropColumn('driver_name');
    table.dropColumn('vehicle_number');
    table.dropColumn('courier_name');
    table.dropColumn('tracking_number');
    table.dropColumn('dispatch_time');
    table.dropColumn('arrival_time');
    table.dropColumn('receiver_name');
    table.dropColumn('receiver_signature');
    table.dropColumn('remarks');
  });

  const hasShelf = await knex.schema.hasColumn('products', 'shelf_location');
  if (hasShelf) {
    await knex.schema.alterTable('products', table => {
      table.dropColumn('shelf_location');
    });
  }
};
