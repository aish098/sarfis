/**
 * Migration: Document Rejection, Revision Snapshots, Optimistic Concurrency & Correction Requests
 */
exports.up = async function(knex) {
  const isPostgres = knex.client.config.client === 'pg';

  // Helper to safely add column if it does not exist
  const safeAddColumn = async (tableName, colName, builderFn) => {
    const hasCol = await knex.schema.hasColumn(tableName, colName);
    if (!hasCol) {
      await knex.schema.table(tableName, (table) => {
        builderFn(table);
      });
    }
  };

  // Helper for adding revision & concurrency columns to operational/financial tables
  const addRevisionColumns = async (tableName, includeFinancialReversal = false) => {
    const hasTable = await knex.schema.hasTable(tableName);
    if (!hasTable) return;

    await safeAddColumn(tableName, 'revision_number', t => t.integer('revision_number').notNullable().defaultTo(0));
    await safeAddColumn(tableName, 'version', t => t.integer('version').notNullable().defaultTo(1));
    await safeAddColumn(tableName, 'last_rejected_at', t => t.timestamp('last_rejected_at', { useTz: true }).nullable());
    await safeAddColumn(tableName, 'last_rejected_by', t => t.bigInteger('last_rejected_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL'));
    await safeAddColumn(tableName, 'last_rejection_code', t => t.string('last_rejection_code', 50).nullable());
    await safeAddColumn(tableName, 'last_rejection_reason', t => t.text('last_rejection_reason').nullable());
    await safeAddColumn(tableName, 'resubmitted_at', t => t.timestamp('resubmitted_at', { useTz: true }).nullable());
    await safeAddColumn(tableName, 'resubmitted_by', t => t.bigInteger('resubmitted_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL'));
    await safeAddColumn(tableName, 'superseded_by_document_id', t => t.bigInteger('superseded_by_document_id').unsigned().nullable());

    if (includeFinancialReversal) {
      await safeAddColumn(tableName, 'is_reversed', t => t.boolean('is_reversed').notNullable().defaultTo(false));
      await safeAddColumn(tableName, 'reversed_by_entry_id', t => t.bigInteger('reversed_by_entry_id').unsigned().nullable());
    }
  };

  await addRevisionColumns('purchase_requisitions', false);
  await addRevisionColumns('purchase_orders', false);
  await addRevisionColumns('goods_receipts', true);
  await addRevisionColumns('vouchers', true);
  await addRevisionColumns('journal_entries', true);

  // 2. Create document_revisions table
  const hasRevisionsTable = await knex.schema.hasTable('document_revisions');
  if (!hasRevisionsTable) {
    await knex.schema.createTable('document_revisions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('document_type', 50).notNullable();
      table.bigInteger('document_id').unsigned().notNullable();
      table.integer('revision_number').notNullable();
      table.integer('cycle_number').notNullable().defaultTo(1);
      table.string('snapshot_type', 30).notNullable(); // 'SUBMITTED', 'REJECTED', 'RESUBMITTED', 'APPROVED', 'POSTED'
      table.string('previous_status', 50).notNullable();
      table.string('new_status', 50).notNullable();
      if (isPostgres) {
        table.jsonb('snapshot_json').notNullable();
      } else {
        table.text('snapshot_json').notNullable();
      }
      table.string('content_hash', 128).notNullable();
      table.text('change_summary').nullable();
      table.text('revision_notes').nullable();
      table.bigInteger('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['company_id', 'document_type', 'document_id', 'revision_number', 'snapshot_type'], 'uq_document_revision');
      table.index(['company_id', 'document_type', 'document_id', 'revision_number'], 'idx_document_revisions_lookup');
    });
  }

  // 3. Create document_correction_requests table
  const hasCorrectionTable = await knex.schema.hasTable('document_correction_requests');
  if (!hasCorrectionTable) {
    await knex.schema.createTable('document_correction_requests', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('document_type', 50).notNullable();
      table.bigInteger('document_id').unsigned().notNullable();
      table.string('reason_code', 50).notNullable();
      table.text('reason_text').notNullable();
      table.bigInteger('requested_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('requested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.string('status', 30).notNullable().defaultTo('PENDING_APPROVAL'); // 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED'
      table.bigInteger('approved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('approved_at', { useTz: true }).nullable();
      table.bigInteger('rejected_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('rejected_at', { useTz: true }).nullable();
      table.text('rejection_reason').nullable();
      table.bigInteger('executed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('executed_at', { useTz: true }).nullable();
      table.text('execution_error').nullable();
      table.integer('execution_attempts').notNullable().defaultTo(0);
      table.bigInteger('reversal_document_id').unsigned().nullable();
      table.bigInteger('corrected_document_id').unsigned().nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['company_id', 'document_type', 'document_id', 'status'], 'idx_correction_requests_document');
    });

    if (isPostgres) {
      await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_active_correction_request
        ON document_correction_requests (company_id, document_type, document_id)
        WHERE status IN ('PENDING_APPROVAL', 'APPROVED', 'EXECUTING');
      `);
    }
  }

  // 4. Create notification_outbox table
  const hasOutboxTable = await knex.schema.hasTable('notification_outbox');
  if (!hasOutboxTable) {
    await knex.schema.createTable('notification_outbox', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('event_type', 50).notNullable();
      table.string('aggregate_type', 50).notNullable();
      table.bigInteger('aggregate_id').unsigned().notNullable();
      if (isPostgres) {
        table.jsonb('payload_json').notNullable();
      } else {
        table.text('payload_json').notNullable();
      }
      table.string('status', 20).notNullable().defaultTo('PENDING'); // 'PENDING', 'PROCESSING', 'SENT', 'FAILED'
      table.timestamp('locked_at', { useTz: true }).nullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }

  // 5. Add cycle_number to workflow_instances
  const hasWf = await knex.schema.hasTable('workflow_instances');
  if (hasWf) {
    const hasCycle = await knex.schema.hasColumn('workflow_instances', 'cycle_number');
    if (!hasCycle) {
      await knex.schema.table('workflow_instances', (table) => {
        table.integer('cycle_number').notNullable().defaultTo(1);
      });
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('notification_outbox');
  await knex.schema.dropTableIfExists('document_correction_requests');
  await knex.schema.dropTableIfExists('document_revisions');
};
