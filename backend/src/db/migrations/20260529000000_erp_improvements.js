/**
 * Migration: Sage 50 style ERP database improvements for SCAFIS
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('vendors', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('name', 200).notNullable();
      table.string('email', 200).nullable();
      table.string('phone', 50).nullable();
      table.text('address').nullable();
      table.decimal('current_balance', 15, 2).defaultTo(0.00);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('deleted_at').nullable().defaultTo(null);
      table.timestamps(true, true);

      table.index(['company_id']);
    })
    .createTable('company_accounting_settings', table => {
      table.integer('company_id').primary().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('default_sales_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('default_ap_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('default_ar_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('default_inventory_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('default_cogs_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('default_cash_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.decimal('tax_rate', 5, 2).defaultTo(0.00);
    })
    .createTable('accounting_periods', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('period_name', 20).notNullable(); // e.g. '2026-05'
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.string('status', 20).defaultTo('OPEN'); // 'OPEN' | 'CLOSED'
      table.timestamps(true, true);

      table.unique(['company_id', 'period_name']);
      table.index(['company_id']);
    })
    .createTable('vouchers', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('type', 30).notNullable(); // 'PURCHASE' | 'SALES' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL'
      table.string('voucher_number', 50).notNullable();
      table.date('date').notNullable().defaultTo(knex.fn.now());
      table.string('status', 25).defaultTo('DRAFT'); // 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED'
      table.jsonb('payload').notNullable();
      table.decimal('total_amount', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('tax_amount', 15, 2).defaultTo(0.00);
      table.integer('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.boolean('is_reversed').defaultTo(false);
      table.integer('reversal_voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
      table.timestamp('deleted_at').nullable().defaultTo(null);
      table.timestamps(true, true);

      table.unique(['company_id', 'type', 'voucher_number']);
      table.index(['company_id', 'type', 'status']);
    })
    .createTable('voucher_sequences', table => {
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('type', 30).notNullable();
      table.string('prefix', 10).notNullable();
      table.integer('next_val').defaultTo(1);
      
      table.primary(['company_id', 'type']);
    })
    .createTable('transaction_audit_logs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
      table.string('action', 50).notNullable(); // 'CREATE', 'PENDING_APPROVAL', 'POST', 'REVERSE', 'DELETE'
      table.integer('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('description').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['company_id', 'created_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('transaction_audit_logs')
    .dropTableIfExists('voucher_sequences')
    .dropTableIfExists('vouchers')
    .dropTableIfExists('accounting_periods')
    .dropTableIfExists('company_accounting_settings')
    .dropTableIfExists('vendors');
};
