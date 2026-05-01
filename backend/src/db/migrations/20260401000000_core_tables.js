
exports.up = function(knex) {
  return knex.schema
    .createTable('users', table => {
      table.increments('id').primary();
      table.string('name').nullable();
      table.string('email').notNullable().unique();
      table.string('password').notNullable();
      table.string('role').defaultTo('Company Admin');
      table.timestamps(true, true);
    })
    .createTable('companies', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('owner_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    .createTable('company_users', table => {
      table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.string('role').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.primary(['company_id', 'user_id']);
    })
    .createTable('accounts', table => {
      table.increments('id').primary();
      table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('CASCADE');
      table.string('code').notNullable();
      table.string('name').notNullable();
      table.string('type').notNullable();
      table.decimal('balance', 15, 2).defaultTo(0);
      table.timestamps(true, true);
      table.unique(['company_id', 'code']);
    })
    .createTable('journal_entries', table => {
      table.increments('id').primary();
      table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('CASCADE');
      table.date('entry_date').notNullable().defaultTo(knex.fn.now());
      table.string('description');
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    })
    .createTable('journal_lines', table => {
      table.increments('id').primary();
      table.integer('entry_id').unsigned().references('id').inTable('journal_entries').onDelete('CASCADE');
      table.integer('account_id').unsigned().references('id').inTable('accounts').onDelete('CASCADE');
      table.decimal('debit', 15, 2).defaultTo(0);
      table.decimal('credit', 15, 2).defaultTo(0);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('journal_lines')
    .dropTableIfExists('journal_entries')
    .dropTableIfExists('accounts')
    .dropTableIfExists('company_users')
    .dropTableIfExists('companies')
    .dropTableIfExists('users');
};
