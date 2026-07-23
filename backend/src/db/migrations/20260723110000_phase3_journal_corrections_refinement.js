/**
 * Migration: Phase 3 Journal Correction Refinements & Line Reversal Links
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

  // Add correction_draft_id & correction_of_entry_id to journal_entries
  await safeAddColumn('journal_entries', 'correction_draft_id', t => t.bigInteger('correction_draft_id').unsigned().nullable());
  await safeAddColumn('journal_entries', 'correction_of_entry_id', t => t.bigInteger('correction_of_entry_id').unsigned().nullable());

  // Add reversal_of_line_id to journal_lines
  await safeAddColumn('journal_lines', 'reversal_of_line_id', t => t.bigInteger('reversal_of_line_id').unsigned().nullable());
};

exports.down = async function(knex) {
  // Safe rollback
};
