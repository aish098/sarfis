exports.up = async function(knex) {
  await knex.schema
    // 1. asset_categories
    .createTable('asset_categories', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('category_name', 150).notNullable();
      table.integer('default_useful_life_years').notNullable().defaultTo(5);
      table.string('default_depreciation_method', 50).notNullable().defaultTo('STRAIGHT_LINE');
      table.decimal('default_salvage_percent', 5, 2).notNullable().defaultTo(10.00);
      table.integer('asset_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('accumulated_depreciation_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.integer('depreciation_expense_account_id').nullable().references('id').inTable('accounts').onDelete('SET NULL');
      table.timestamps(true, true);
    })

    // 2. assets
    .createTable('assets', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('asset_code', 100).notNullable();
      table.string('asset_name', 200).notNullable();
      table.integer('category_id').notNullable().references('id').inTable('asset_categories').onDelete('RESTRICT');
      table.integer('purchase_voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
      table.date('purchase_date').notNullable();
      table.date('placed_in_service_date').notNullable();
      table.decimal('purchase_cost', 15, 2).notNullable();
      table.integer('location_id').nullable().references('id').inTable('warehouses').onDelete('SET NULL');
      table.integer('custodian_employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL');
      table.string('serial_number', 100).nullable();
      table.text('notes').nullable();
      
      // Units of production specific fields
      table.decimal('estimated_total_units', 15, 4).nullable();
      table.decimal('current_units_used', 15, 4).notNullable().defaultTo(0);
      table.decimal('remaining_units', 15, 4).nullable();
      
      // Revaluation reserves fields
      table.date('last_revaluation_date').nullable();
      table.decimal('last_revaluation_amount', 15, 2).nullable();
      
      table.string('status', 30).notNullable().defaultTo('ACTIVE'); // 'ACTIVE' | 'DISPOSED' | 'UNDER_MAINTENANCE' | 'SOLD'
      table.timestamps(true, true);

      table.unique(['company_id', 'asset_code']);
      table.index(['company_id']);
    })

    // 3. asset_depreciation_books (separating books from assets)
    .createTable('asset_depreciation_books', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.string('book_name', 50).notNullable(); // 'Accounting' | 'Tax' | 'Management'
      table.string('depreciation_method', 50).notNullable().defaultTo('STRAIGHT_LINE');
      table.integer('useful_life_years').notNullable().defaultTo(5);
      table.integer('useful_life_months').notNullable().defaultTo(60);
      table.decimal('salvage_value', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('accumulated_depreciation', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('current_book_value', 15, 2).notNullable();
      table.date('last_depreciation_date').nullable();
      table.integer('last_depreciation_run_id').nullable(); // Will reference run id later dynamically
      table.timestamps(true, true);

      table.unique(['asset_id', 'book_name']);
      table.index(['company_id', 'book_name']);
    })

    // 4. depreciation_policies
    .createTable('depreciation_policies', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('policy_name', 150).notNullable();
      table.string('method', 50).notNullable(); // 'STRAIGHT_LINE' | 'REDUCING_BALANCE' | 'UNITS_OF_PRODUCTION'
      table.string('frequency', 30).notNullable().defaultTo('MONTHLY'); // 'MONTHLY' | 'YEARLY'
      table.boolean('manual_allowed').notNullable().defaultTo(true);
      table.boolean('posting_enabled').notNullable().defaultTo(true);
      table.timestamps(true, true);
    })

    // 5. depreciation_runs
    .createTable('depreciation_runs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.date('run_date').notNullable();
      table.string('period', 30).notNullable(); // e.g. '2026-07'
      table.string('method', 50).notNullable();
      table.integer('voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
      table.integer('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.string('status', 30).notNullable().defaultTo('PREVIEW'); // 'PREVIEW' | 'POSTED'
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);

      table.unique(['company_id', 'period']);
    })

    // 6. depreciation_entries (allocation lines)
    .createTable('depreciation_entries', table => {
      table.increments('id').primary();
      table.integer('depreciation_run_id').notNullable().references('id').inTable('depreciation_runs').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.decimal('opening_book_value', 15, 2).notNullable();
      table.decimal('depreciation_amount', 15, 2).notNullable();
      table.decimal('closing_book_value', 15, 2).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // 7. asset_usage_logs (Units of Production meter logs)
    .createTable('asset_usage_logs', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.date('usage_date').notNullable();
      table.decimal('units_used', 15, 4).notNullable();
      table.string('source', 100).notNullable().defaultTo('MANUAL');
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // 8. asset_ledger (unified sub-ledger)
    .createTable('asset_ledger', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.string('event_type', 50).notNullable(); // 'ACQUISITION' | 'DEPRECIATION' | 'TRANSFER' | 'MAINTENANCE' | 'REVALUATION' | 'DISPOSAL' | 'SALE'
      table.date('event_date').notNullable();
      table.text('description').notNullable();
      table.string('book_name', 50).nullable(); // Specific depreciation book name if applicable
      table.decimal('amount', 15, 2).notNullable();
      table.integer('voucher_id').nullable().references('id').inTable('vouchers').onDelete('SET NULL');
      table.integer('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });

  // Seed default categories for existing companies
  const companies = await knex('companies').select('id');
  for (const c of companies) {
    // Lookup typical account IDs
    const assetAcc = await knex('accounts').where({ company_id: c.id }).andWhere('code', 'like', '15%').first();
    const accDepAcc = await knex('accounts').where({ company_id: c.id }).andWhere('code', 'like', '16%').first();
    const expAcc = await knex('accounts').where({ company_id: c.id }).andWhere('code', 'like', '55%').first();

    const categories = [
      { name: 'Buildings & Structures', life: 25, method: 'STRAIGHT_LINE', salvage: 10.00 },
      { name: 'Motor Vehicles', life: 5, method: 'REDUCING_BALANCE', salvage: 15.00 },
      { name: 'Computer Equipment', life: 3, method: 'STRAIGHT_LINE', salvage: 5.00 },
      { name: 'Office Furniture & Fixtures', life: 7, method: 'STRAIGHT_LINE', salvage: 10.00 },
      { name: 'Industrial Machinery', life: 10, method: 'UNITS_OF_PRODUCTION', salvage: 10.00 }
    ];

    for (const cat of categories) {
      await knex('asset_categories').insert({
        company_id: c.id,
        category_name: cat.name,
        default_useful_life_years: cat.life,
        default_depreciation_method: cat.method,
        default_salvage_percent: cat.salvage,
        asset_account_id: assetAcc ? assetAcc.id : null,
        accumulated_depreciation_account_id: accDepAcc ? accDepAcc.id : null,
        depreciation_expense_account_id: expAcc ? expAcc.id : null
      });
    }
  }
};

exports.down = async function(knex) {
  await knex.schema
    .dropTableIfExists('asset_ledger')
    .dropTableIfExists('asset_usage_logs')
    .dropTableIfExists('depreciation_entries')
    .dropTableIfExists('depreciation_runs')
    .dropTableIfExists('depreciation_policies')
    .dropTableIfExists('asset_depreciation_books')
    .dropTableIfExists('assets')
    .dropTableIfExists('asset_categories');
};
