exports.up = async function(knex) {
  // 1. Create employees table
  await knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.integer('user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('name').notNullable();
    table.string('role');
    table.string('department');
    table.decimal('salary', 15, 2).notNullable();
    table.string('bank_name');
    table.string('account_number');
    table.string('status').defaultTo('Active');
    table.timestamps(true, true);
  });

  // 2. Create user_permission_overrides table
  await knex.schema.createTable('user_permission_overrides', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('company_id').unsigned().notNullable()
      .references('id').inTable('companies').onDelete('CASCADE');
    table.integer('permission_id').unsigned().notNullable()
      .references('id').inTable('permissions').onDelete('CASCADE');
    table.boolean('is_allowed').notNullable();
    table.date('start_date').nullable();
    table.date('end_date').nullable();
    
    table.unique(['user_id', 'company_id', 'permission_id']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_permission_overrides');
  await knex.schema.dropTableIfExists('employees');
};
