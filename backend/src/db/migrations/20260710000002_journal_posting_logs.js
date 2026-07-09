exports.up = async function(knex) {
  // 1. Add is_postable to accounts table
  const hasIsPostable = await knex.schema.hasColumn('accounts', 'is_postable');
  if (!hasIsPostable) {
    await knex.schema.alterTable('accounts', table => {
      table.boolean('is_postable').defaultTo(true).notNullable();
    });
  }

  // 2. Add reference and reversal fields to journal_entries table
  const hasRef = await knex.schema.hasColumn('journal_entries', 'reference');
  if (!hasRef) {
    await knex.schema.alterTable('journal_entries', table => {
      table.string('reference', 100).nullable();
      table.integer('reversal_of_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.integer('reversed_by_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.text('reversal_reason').nullable();
    });
  }

  // 3. Create journal_posting_logs table
  const hasLogsTable = await knex.schema.hasTable('journal_posting_logs');
  if (!hasLogsTable) {
    await knex.schema.createTable('journal_posting_logs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('CASCADE');
      table.integer('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('reference', 100).nullable();
      table.string('posting_source', 50).defaultTo('MANUAL').notNullable(); // 'MANUAL' | 'VOUCHER' | 'PAYROLL' | 'ASSET' | 'DEPRECIATION' | 'YEAR_END' | 'AUTO'
      table.string('status', 100).notNullable(); // 'POSTING_STARTED', 'VALIDATING_PERIOD', 'VALIDATING_ACCOUNTS', 'CREATING_HEADER', 'CREATING_LINES', 'UPDATING_LEDGER', 'POSTED', 'VALIDATION_FAILED', 'ROLLBACK', 'REVERSED'
      table.decimal('debit_total', 15, 2).defaultTo(0).notNullable();
      table.decimal('credit_total', 15, 2).defaultTo(0).notNullable();
      table.integer('duration_ms').defaultTo(0).notNullable();
      table.text('error_message').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('journal_posting_logs');
  
  const hasRef = await knex.schema.hasColumn('journal_entries', 'reference');
  if (hasRef) {
    await knex.schema.alterTable('journal_entries', table => {
      table.dropColumn('reversal_reason');
      table.dropColumn('reversed_by_id');
      table.dropColumn('reversal_of_id');
      table.dropColumn('reference');
    });
  }

  const hasIsPostable = await knex.schema.hasColumn('accounts', 'is_postable');
  if (hasIsPostable) {
    await knex.schema.alterTable('accounts', table => {
      table.dropColumn('is_postable');
    });
  }
};
