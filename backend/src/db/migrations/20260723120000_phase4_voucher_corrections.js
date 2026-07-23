/**
 * Migration: Phase 4 Voucher Corrections & Sub-ledger Reversal Columns
 */
exports.up = async function(knex) {
  const safeAddColumn = async (tableName, colName, builderFn) => {
    const hasCol = await knex.schema.hasColumn(tableName, colName);
    if (!hasCol) {
      await knex.schema.table(tableName, (table) => {
        builderFn(table);
      });
    }
  };

  // Add reversal & replacement relationship columns to vouchers
  await safeAddColumn('vouchers', 'reversal_voucher_id', t => t.bigInteger('reversal_voucher_id').unsigned().nullable());
  await safeAddColumn('vouchers', 'correction_draft_id', t => t.bigInteger('correction_draft_id').unsigned().nullable());
  await safeAddColumn('vouchers', 'superseded_by_voucher_id', t => t.bigInteger('superseded_by_voucher_id').unsigned().nullable());
  await safeAddColumn('vouchers', 'correction_of_voucher_id', t => t.bigInteger('correction_of_voucher_id').unsigned().nullable());
  await safeAddColumn('vouchers', 'reversal_of_voucher_id', t => t.bigInteger('reversal_of_voucher_id').unsigned().nullable());
  await safeAddColumn('vouchers', 'reversal_journal_entry_id', t => t.bigInteger('reversal_journal_entry_id').unsigned().nullable());

  // Ensure document_correction_requests has reversal_journal_entry_id
  await safeAddColumn('document_correction_requests', 'reversal_journal_entry_id', t => t.bigInteger('reversal_journal_entry_id').unsigned().nullable());
};

exports.down = async function(knex) {
  // Safe rollback
};
