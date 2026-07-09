exports.up = async function(knex) {
  const hasCapacity = await knex.schema.hasColumn('warehouses', 'capacity');
  if (!hasCapacity) {
    await knex.schema.alterTable('warehouses', table => {
      table.integer('capacity').defaultTo(10000).notNullable();
    });
  }

  const hasCategory = await knex.schema.hasColumn('products', 'category');
  if (!hasCategory) {
    await knex.schema.alterTable('products', table => {
      table.string('category', 100).defaultTo('Others').notNullable();
    });
  }

  // Update existing seeded products with some diverse categories for demo dashboard purposes
  await knex('products').where('sku', 'like', '%LAP%').update({ category: 'Electronics' });
  await knex('products').where('sku', 'like', '%MON%').update({ category: 'Electronics' });
  await knex('products').where('name', 'like', '%Desk%').update({ category: 'Furniture' });
  await knex('products').where('name', 'like', '%Chair%').update({ category: 'Furniture' });
  await knex('products').where('name', 'like', '%Paper%').update({ category: 'Office Supplies' });
  await knex('products').where('name', 'like', '%Pen%').update({ category: 'Office Supplies' });
};

exports.down = async function(knex) {
  const hasCapacity = await knex.schema.hasColumn('warehouses', 'capacity');
  if (hasCapacity) {
    await knex.schema.alterTable('warehouses', table => {
      table.dropColumn('capacity');
    });
  }

  const hasCategory = await knex.schema.hasColumn('products', 'category');
  if (hasCategory) {
    await knex.schema.alterTable('products', table => {
      table.dropColumn('category');
    });
  }
};
