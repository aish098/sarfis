exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('financial_statement_note_templates');
  if (!hasTable) {
    await knex.schema.createTable('financial_statement_note_templates', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable();
      table.string('statement_type', 50).notNullable(); // 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW'
      table.string('report_group', 100).notNullable(); // 'CASH' | 'RECEIVABLES' | 'BAD_DEBT' | 'INVENTORY' | 'PPE' | 'PAYABLES' | 'TAX'
      table.integer('note_number').notNullable();
      table.string('note_name', 255).notNullable();
      
      table.timestamps(true, true);

      // Constraints
      table.unique(['company_id', 'statement_type', 'report_group']);
      table.unique(['company_id', 'statement_type', 'note_number']);
    });
  }

  // Seed default templates for any active companies
  const companies = await knex('companies').select('id');
  for (const c of companies) {
    const defaults = [
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'CASH', note_number: 2, note_name: 'Cash & Cash Equivalents' },
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'RECEIVABLES', note_number: 3, note_name: 'Trade Receivables' },
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'BAD_DEBT', note_number: 4, note_name: 'Allowance for Doubtful Accounts' },
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'INVENTORY', note_number: 5, note_name: 'Inventories' },
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'PPE', note_number: 7, note_name: 'Property, Plant & Equipment' },
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'PAYABLES', note_number: 8, note_name: 'Trade and Other Payables' },
      { company_id: c.id, statement_type: 'BALANCE_SHEET', report_group: 'TAX', note_number: 9, note_name: 'Taxation Liabilities' }
    ];

    for (const d of defaults) {
      const exists = await knex('financial_statement_note_templates')
        .where({ company_id: c.id, statement_type: d.statement_type, report_group: d.report_group })
        .first();
      if (!exists) {
        await knex('financial_statement_note_templates').insert(d);
      }
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('financial_statement_note_templates');
};
