exports.up = async function(knex) {
  // 1. Create risk_approval_requests table (generic metadata + expiration + voucher links)
  await knex.schema.createTable('risk_approval_requests', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('entity_type', 20).notNullable(); // 'CUSTOMER' | 'VENDOR'
    table.integer('entity_id').notNullable();
    table.string('request_type', 50).notNullable(); // 'TRANSACTION_OVERRIDE' | 'STATUS_CHANGE' | 'CREDIT_POLICY_CHANGE' | 'WRITE_OFF' | 'REINSTATEMENT'
    table.jsonb('metadata').nullable(); // JSON payload for details
    table.integer('voucher_id').nullable(); // Can be linked to a specific voucher draft if applicable
    table.timestamp('expires_at').nullable(); // Expiration timestamp for overrides
    table.text('reason').notNullable();
    table.string('status', 20).notNullable().defaultTo('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED'
    table.integer('requested_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at').nullable();
    table.text('review_notes').nullable();
    table.timestamps(true, true);
  });

  // 2. Add override_request_id to vouchers table
  await knex.schema.alterTable('vouchers', (table) => {
    table.integer('override_request_id').nullable().references('id').inTable('risk_approval_requests').onDelete('SET NULL');
  });

  // 3. Add next_review_date to business_relationship_status table
  await knex.schema.alterTable('business_relationship_status', (table) => {
    table.date('next_review_date').nullable();
  });

  // 4. Add risk_score snapshot to business_relationship_history table
  await knex.schema.alterTable('business_relationship_history', (table) => {
    table.integer('risk_score').notNullable().defaultTo(0);
  });

  // 5. Add composite high-performance indexes
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_relationship_status_lookup ON business_relationship_status(company_id, entity_type, entity_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_relationship_status_filter ON business_relationship_status(company_id, status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_relationship_status_level ON business_relationship_status(company_id, risk_level)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_risk_incidents_lookup ON business_risk_incidents(company_id, entity_type, entity_id)');
};

exports.down = async function(knex) {
  // Drop composite indexes
  await knex.raw('DROP INDEX IF EXISTS idx_relationship_status_lookup');
  await knex.raw('DROP INDEX IF EXISTS idx_relationship_status_filter');
  await knex.raw('DROP INDEX IF EXISTS idx_relationship_status_level');
  await knex.raw('DROP INDEX IF EXISTS idx_risk_incidents_lookup');

  // Remove columns from business_relationship_history
  await knex.schema.alterTable('business_relationship_history', (table) => {
    table.dropColumn('risk_score');
  });

  // Remove columns from business_relationship_status
  await knex.schema.alterTable('business_relationship_status', (table) => {
    table.dropColumn('next_review_date');
  });

  // Remove columns from vouchers
  await knex.schema.alterTable('vouchers', (table) => {
    table.dropColumn('override_request_id');
  });

  // Drop table
  await knex.schema.dropTableIfExists('risk_approval_requests');
};
