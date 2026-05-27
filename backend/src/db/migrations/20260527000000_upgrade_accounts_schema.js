const fs = require('fs');
const path = require('path');

exports.up = async function(knex) {
  // Check if the column exists first so we don't crash if it already ran manually
  const hasCategory = await knex.schema.hasColumn('accounts', 'category');
  if (hasCategory) {
    console.log('[Migration] accounts.category already exists. Skipping upgrade accounts schema.');
    return;
  }

  // Rename type to category
  await knex.schema.alterTable('accounts', function(table) {
    table.renameColumn('type', 'category');
  });

  // Add new columns
  await knex.schema.alterTable('accounts', function(table) {
    table.string('normal_balance', 10).defaultTo('Debit');
    table.boolean('is_contra').defaultTo(false);
  });

  // Run the SQL data updates
  const sqlPath = path.join(__dirname, '../../../migrations/002_accounts_upgrade.sql');
  if (fs.existsSync(sqlPath)) {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    // We already did the schema part (ALTER TABLE), so we only want the UPDATE statements.
    // The safest way is just to manually execute the UPDATEs.
    
    await knex.raw(`
      UPDATE accounts
      SET normal_balance = CASE
        WHEN category IN ('Asset', 'Expense') THEN 'Debit'
        WHEN category IN ('Liability', 'Equity', 'Revenue', 'Income') THEN 'Credit'
        ELSE 'Debit'
      END,
      is_contra = FALSE;
    `);

    await knex.raw(`
      UPDATE accounts
      SET is_contra = TRUE,
          normal_balance = 'Credit'
      WHERE category = 'Asset' 
        AND (
          LOWER(name) LIKE '%allowance%' OR
          LOWER(name) LIKE '%accumulated depreciation%' OR
          LOWER(name) LIKE '%accumulated amortization%'
        );
    `);

    await knex.raw(`
      UPDATE accounts
      SET is_contra = TRUE,
          normal_balance = 'Debit'
      WHERE category IN ('Revenue', 'Income') 
        AND (
          LOWER(name) LIKE '%discount%' OR
          LOWER(name) LIKE '%returns%' OR
          LOWER(name) LIKE '%allowances%'
        );
    `);

    await knex.raw(`
      UPDATE accounts
      SET is_contra = TRUE,
          normal_balance = 'Debit'
      WHERE category = 'Equity' 
        AND (
          LOWER(name) LIKE '%drawings%' OR
          LOWER(name) LIKE '%dividends%' OR
          LOWER(name) LIKE '%treasury stock%'
        );
    `);

    await knex.raw(`
      UPDATE accounts
      SET is_contra = TRUE,
          normal_balance = 'Debit'
      WHERE category = 'Liability'
        AND (
          LOWER(name) LIKE '%discount%'
        );
    `);
  }
};

exports.down = async function(knex) {
  const hasCategory = await knex.schema.hasColumn('accounts', 'category');
  if (hasCategory) {
    await knex.schema.alterTable('accounts', function(table) {
      table.dropColumn('is_contra');
      table.dropColumn('normal_balance');
      table.renameColumn('category', 'type');
    });
  }
};
