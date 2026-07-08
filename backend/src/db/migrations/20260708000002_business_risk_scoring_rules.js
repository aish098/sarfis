exports.up = async function(knex) {
  // 1. Create risk_categories master table
  await knex.schema.createTable('risk_categories', table => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('label', 100).notNullable();
    table.string('entity_scope', 20).notNullable().defaultTo('BOTH'); // 'CUSTOMER' | 'VENDOR' | 'BOTH'
    table.integer('default_weight').notNullable().defaultTo(0);
    table.string('severity', 20).notNullable().defaultTo('MEDIUM'); // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    table.string('rule_type', 20).notNullable().defaultTo('STATIC'); // 'STATIC' | 'FORMULA'
    table.string('description', 255);
  });

  // 2. Create company_risk_rules configuration table
  await knex.schema.createTable('company_risk_rules', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('category_id').notNullable().references('id').inTable('risk_categories').onDelete('CASCADE');
    table.integer('weight').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.integer('updated_by').references('id').inTable('users');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['company_id', 'category_id']);
  });

  // 3. Create risk_level_rules threshold table
  await knex.schema.createTable('risk_level_rules', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('risk_level', 20).notNullable(); // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    table.integer('min_score').notNullable();
    table.integer('max_score').notNullable();
    table.unique(['company_id', 'risk_level']);
  });

  // 4. Create risk_policy_history audit table
  await knex.schema.createTable('risk_policy_history', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('policy_type', 50).notNullable(); // 'RULE_CHANGE' | 'THRESHOLD_CHANGE'
    table.integer('rule_id'); // Can map to company_risk_rules.id or risk_level_rules.id
    table.string('old_value', 255).notNullable();
    table.string('new_value', 255).notNullable();
    table.integer('changed_by').references('id').inTable('users');
    table.string('reason', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 5. Seed default risk categories
  const categories = [
    { code: 'LATE_PAYMENT', label: 'Late Payment', entity_scope: 'CUSTOMER', default_weight: 15, severity: 'MEDIUM', rule_type: 'STATIC', description: 'Client payment delayed beyond invoice terms' },
    { code: 'BOUNCED_CHEQUE', label: 'Bounced Cheque', entity_scope: 'CUSTOMER', default_weight: 40, severity: 'HIGH', rule_type: 'STATIC', description: 'Bounced bank cheque event' },
    { code: 'OVERDUE_INVOICE', label: 'Overdue Invoice', entity_scope: 'CUSTOMER', default_weight: 30, severity: 'MEDIUM', rule_type: 'STATIC', description: 'Outstanding invoice exceeding max credit days' },
    { code: 'BAD_DEBT', label: 'Bad Debt / Default', entity_scope: 'CUSTOMER', default_weight: 60, severity: 'CRITICAL', rule_type: 'STATIC', description: 'Unpaid bad debt or billing default' },
    { code: 'LEGAL_CASE', label: 'Legal Case', entity_scope: 'BOTH', default_weight: 100, severity: 'CRITICAL', rule_type: 'STATIC', description: 'Legal case initiated against partner' },
    { code: 'OTHER', label: 'Other Issue', entity_scope: 'BOTH', default_weight: 10, severity: 'LOW', rule_type: 'STATIC', description: 'Other miscellaneous risk issue' },
    { code: 'POOR_QUALITY', label: 'Poor Quality', entity_scope: 'VENDOR', default_weight: 20, severity: 'MEDIUM', rule_type: 'STATIC', description: 'Vendor delivery of poor quality goods' },
    { code: 'LATE_DELIVERY', label: 'Late Delivery', entity_scope: 'VENDOR', default_weight: 15, severity: 'LOW', rule_type: 'STATIC', description: 'Vendor delay in shipments' },
    { code: 'PRICE_MANIPULATION', label: 'Price Manipulation', entity_scope: 'VENDOR', default_weight: 30, severity: 'MEDIUM', rule_type: 'STATIC', description: 'Vendor unauthorized price increases' },
    { code: 'FRAUD', label: 'Fraud / Duplicate Billing', entity_scope: 'VENDOR', default_weight: 80, severity: 'CRITICAL', rule_type: 'STATIC', description: 'Vendor fraudulent or duplicate billing' },
    { code: 'CONTRACT_VIOLATION', label: 'Contract Violation', entity_scope: 'VENDOR', default_weight: 50, severity: 'HIGH', rule_type: 'STATIC', description: 'Vendor violation of supply agreement terms' }
  ];

  await knex('risk_categories').insert(categories);

  // 6. Initialize default rules & levels for all existing companies
  const companies = await knex('companies').select('id');
  const seededCats = await knex('risk_categories').select('id', 'default_weight');

  for (const company of companies) {
    // Seed rules
    const rulesToInsert = seededCats.map(cat => ({
      company_id: company.id,
      category_id: cat.id,
      weight: cat.default_weight,
      enabled: true
    }));
    await knex('company_risk_rules').insert(rulesToInsert);

    // Seed thresholds
    const thresholds = [
      { company_id: company.id, risk_level: 'LOW', min_score: 0, max_score: 20 },
      { company_id: company.id, risk_level: 'MEDIUM', min_score: 21, max_score: 50 },
      { company_id: company.id, risk_level: 'HIGH', min_score: 51, max_score: 80 },
      { company_id: company.id, risk_level: 'CRITICAL', min_score: 81, max_score: 999 }
    ];
    await knex('risk_level_rules').insert(thresholds);
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('risk_policy_history');
  await knex.schema.dropTableIfExists('risk_level_rules');
  await knex.schema.dropTableIfExists('company_risk_rules');
  await knex.schema.dropTableIfExists('risk_categories');
};
