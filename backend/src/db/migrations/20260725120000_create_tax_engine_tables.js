exports.up = async function(knex) {
  // 1. Table: tax_years
  const hasTaxYears = await knex.schema.hasTable('tax_years');
  if (!hasTaxYears) {
    await knex.schema.createTable('tax_years', (table) => {
      table.increments('id').primary();
      table.string('code').notNullable().unique(); // e.g. PK-2026-27-SALARY
      table.string('name').notNullable(); // e.g. Pakistan Tax Year 2026-27
      table.string('country_code', 10).notNullable().defaultTo('PK');
      table.string('currency_code', 10).notNullable().defaultTo('PKR');
      table.string('tax_category').notNullable().defaultTo('SALARY'); // SALARY, BUSINESS, PENSION
      table.date('effective_from').notNullable();
      table.date('effective_to').notNullable();
      table.string('status').notNullable().defaultTo('DRAFT'); // DRAFT, UNDER_REVIEW, APPROVED, ACTIVE, ARCHIVED
      table.integer('version').notNullable().defaultTo(1);
      table.integer('revision').notNullable().defaultTo(0);
      table.string('source_reference').nullable(); // Finance Act 2026, First Schedule, Part I, Division I
      table.string('source_version').nullable(); // Finance Act 2026
      table.string('gazette_number').nullable();
      table.string('notification_number').nullable();
      table.string('official_document_url').nullable();
      table.date('published_date').nullable();
      table.timestamp('published_at').nullable();
      table.integer('approved_by').nullable();
      table.timestamp('approved_at').nullable();
      table.integer('activated_by').nullable();
      table.timestamp('activated_at').nullable();
      table.timestamp('locked_at').nullable();
      table.timestamps(true, true);
    });
  }

  // 2. Table: tax_slabs
  const hasTaxSlabs = await knex.schema.hasTable('tax_slabs');
  if (!hasTaxSlabs) {
    await knex.schema.createTable('tax_slabs', (table) => {
      table.increments('id').primary();
      table.integer('tax_year_id').unsigned().notNullable()
        .references('id').inTable('tax_years').onDelete('CASCADE');
      table.integer('sequence_no').notNullable();
      table.decimal('lower_bound', 15, 2).notNullable();
      table.decimal('upper_bound', 15, 2).nullable(); // NULL means unbounded (above 7M)
      table.decimal('base_tax', 15, 2).notNullable().defaultTo(0);
      table.decimal('marginal_rate', 6, 4).notNullable().defaultTo(0); // e.g. 0.11 for 11%
      table.decimal('excess_over', 15, 2).notNullable().defaultTo(0);
      table.text('description').nullable();
      table.timestamps(true, true);
      table.unique(['tax_year_id', 'sequence_no']);
    });
  }

  // 3. Table: company_tax_settings
  const hasCompanyTaxSettings = await knex.schema.hasTable('company_tax_settings');
  if (!hasCompanyTaxSettings) {
    await knex.schema.createTable('company_tax_settings', (table) => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().unique();
      table.integer('active_tax_year_id').unsigned().nullable()
        .references('id').inTable('tax_years').onDelete('SET NULL');
      table.string('default_country_code', 10).defaultTo('PK');
      table.string('default_tax_category', 20).defaultTo('SALARY');
      table.string('currency_code', 10).defaultTo('PKR');
      table.date('effective_from').nullable();
      table.date('effective_to').nullable();
      table.boolean('allow_custom_exemptions').defaultTo(true);
      table.timestamps(true, true);
    });
  }

  // 4. Table: payroll_tax_snapshots
  const hasTaxSnapshots = await knex.schema.hasTable('payroll_tax_snapshots');
  if (!hasTaxSnapshots) {
    await knex.schema.createTable('payroll_tax_snapshots', (table) => {
      table.increments('id').primary();
      table.integer('company_id').notNullable();
      table.integer('payroll_line_id').notNullable();
      table.integer('employee_id').notNullable();
      table.integer('tax_year_id').unsigned().notNullable()
        .references('id').inTable('tax_years').onDelete('RESTRICT');
      table.integer('tax_slab_id').unsigned().notNullable()
        .references('id').inTable('tax_slabs').onDelete('RESTRICT');
      table.decimal('annual_taxable_income', 15, 2).notNullable();
      table.decimal('projected_annual_income', 15, 2).notNullable();
      table.decimal('base_tax', 15, 2).notNullable();
      table.decimal('marginal_rate', 6, 4).notNullable();
      table.decimal('excess_amount', 15, 2).notNullable();
      table.decimal('raw_annual_tax', 15, 4).notNullable();
      table.decimal('annual_tax', 15, 2).notNullable();
      table.decimal('current_period_tax', 15, 2).notNullable();
      table.decimal('tax_already_withheld', 15, 2).defaultTo(0);
      table.string('calculation_engine_version', 20).defaultTo('1.0.0');
      table.string('tax_formula_version', 20).defaultTo('1.0');
      table.string('source_reference').nullable();
      table.string('source_version').nullable();
      table.jsonb('calculation_json').nullable();
      table.timestamp('calculated_at').defaultTo(knex.fn.now());

      table.index(['company_id', 'employee_id', 'calculated_at']);
      table.index(['tax_year_id']);
      table.index(['payroll_line_id']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('payroll_tax_snapshots');
  await knex.schema.dropTableIfExists('company_tax_settings');
  await knex.schema.dropTableIfExists('tax_slabs');
  await knex.schema.dropTableIfExists('tax_years');
};
