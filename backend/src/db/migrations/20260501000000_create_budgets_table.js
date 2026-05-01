/**
 * Migration: Create budgets table for SCAFIS Budget & Planning Module
 */
exports.up = function (knex) {
  return knex.schema
    .createTable("budgets", (table) => {
      table.increments("id").primary();
      table.integer("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
      table.integer("account_id").nullable().references("id").inTable("accounts").onDelete("SET NULL");
      table.string("sector_id").nullable(); // sector name/id from your existing sectors
      table.string("budget_type").notNullable().defaultTo("account"); // 'account' | 'sector'
      table.integer("period_month").notNullable(); // 1-12
      table.integer("period_year").notNullable();
      table.decimal("budget_amount", 20, 4).notNullable().defaultTo(0);
      table.string("currency").defaultTo("PKR");
      table.text("notes").nullable();
      table.timestamps(true, true);

      table.unique(["company_id", "account_id", "sector_id", "period_month", "period_year", "budget_type"]);
      table.index(["company_id", "period_year", "period_month"]);
    })
    .createTable("monthly_financial_snapshots", (table) => {
      // Optional caching table to speed up trend queries
      table.increments("id").primary();
      table.integer("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
      table.integer("account_id").notNullable().references("id").inTable("accounts").onDelete("CASCADE");
      table.integer("period_month").notNullable();
      table.integer("period_year").notNullable();
      table.decimal("debit_total", 20, 4).defaultTo(0);
      table.decimal("credit_total", 20, 4).defaultTo(0);
      table.decimal("net_balance", 20, 4).defaultTo(0);
      table.timestamp("computed_at").defaultTo(knex.fn.now());

      table.unique(["company_id", "account_id", "period_month", "period_year"]);
      table.index(["company_id", "period_year", "period_month"]);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists("monthly_financial_snapshots")
    .dropTableIfExists("budgets");
};
