exports.up = async function(knex) {
  // 1. Create product_categories table
  const hasCategoriesTable = await knex.schema.hasTable('product_categories');
  if (!hasCategoriesTable) {
    await knex.schema.createTable('product_categories', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('name', 150).notNullable();
      table.integer('parent_id').nullable().references('id').inTable('product_categories').onDelete('SET NULL');
      table.text('description').nullable();
      table.integer('inventory_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('cogs_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('sales_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.timestamps(true, true);
    });
  }

  // 2. Drop products.category (temporary) and add category_id
  const hasCategoryCol = await knex.schema.hasColumn('products', 'category');
  if (hasCategoryCol) {
    await knex.schema.alterTable('products', table => {
      table.dropColumn('category');
    });
  }

  const hasCategoryIdCol = await knex.schema.hasColumn('products', 'category_id');
  if (!hasCategoryIdCol) {
    await knex.schema.alterTable('products', table => {
      table.integer('category_id').nullable().references('id').inTable('product_categories').onDelete('SET NULL');
    });
  }

  // 3. Alter warehouses table to capacity_value and capacity_type
  const hasCapacityCol = await knex.schema.hasColumn('warehouses', 'capacity');
  if (hasCapacityCol) {
    await knex.schema.alterTable('warehouses', table => {
      table.dropColumn('capacity');
    });
  }

  const hasCapacityValCol = await knex.schema.hasColumn('warehouses', 'capacity_value');
  if (!hasCapacityValCol) {
    await knex.schema.alterTable('warehouses', table => {
      table.integer('capacity_value').defaultTo(10000).notNullable();
      table.string('capacity_type', 50).defaultTo('UNITS').notNullable(); // 'UNITS' | 'PALLETS' | 'CUBIC_METERS' | 'WEIGHT'
    });
  }

  // 4. Seed categories and link products for existing companies
  const companies = await knex('companies').select('id');
  for (const c of companies) {
    const cats = [
      { company_id: c.id, name: 'Electronics', description: 'Computing, displays, and accessories' },
      { company_id: c.id, name: 'Furniture', description: 'Desks, chairs, and office layouts' },
      { company_id: c.id, name: 'Office Supplies', description: 'Paper, pens, and consumables' }
    ];

    for (const cat of cats) {
      const exists = await knex('product_categories')
        .where({ company_id: c.id, name: cat.name })
        .first();
      if (!exists) {
        await knex('product_categories').insert(cat);
      }
    }

    // Map existing products to their new normalized categories
    const elecCat = await knex('product_categories').where({ company_id: c.id, name: 'Electronics' }).first();
    const furnCat = await knex('product_categories').where({ company_id: c.id, name: 'Furniture' }).first();
    const suppCat = await knex('product_categories').where({ company_id: c.id, name: 'Office Supplies' }).first();

    if (elecCat) {
      await knex('products').where('sku', 'like', '%LAP%').andWhere('company_id', c.id).update({ category_id: elecCat.id });
      await knex('products').where('sku', 'like', '%MON%').andWhere('company_id', c.id).update({ category_id: elecCat.id });
    }
    if (furnCat) {
      await knex('products').where('name', 'like', '%Desk%').andWhere('company_id', c.id).update({ category_id: furnCat.id });
      await knex('products').where('name', 'like', '%Chair%').andWhere('company_id', c.id).update({ category_id: furnCat.id });
    }
    if (suppCat) {
      await knex('products').where('name', 'like', '%Paper%').andWhere('company_id', c.id).update({ category_id: suppCat.id });
      await knex('products').where('name', 'like', '%Pen%').andWhere('company_id', c.id).update({ category_id: suppCat.id });
    }
  }
};

exports.down = async function(knex) {
  const hasCategoryIdCol = await knex.schema.hasColumn('products', 'category_id');
  if (hasCategoryIdCol) {
    await knex.schema.alterTable('products', table => {
      table.dropColumn('category_id');
    });
  }

  const hasCategoryCol = await knex.schema.hasColumn('products', 'category');
  if (!hasCategoryCol) {
    await knex.schema.alterTable('products', table => {
      table.string('category', 100).defaultTo('Others').notNullable();
    });
  }

  await knex.schema.dropTableIfExists('product_categories');

  const hasCapacityValCol = await knex.schema.hasColumn('warehouses', 'capacity_value');
  if (hasCapacityValCol) {
    await knex.schema.alterTable('warehouses', table => {
      table.dropColumn('capacity_value');
      table.dropColumn('capacity_type');
      table.integer('capacity').defaultTo(10000).notNullable();
    });
  }
};
