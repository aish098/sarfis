exports.up = async function(knex) {
  // 1. Add current_classification column
  await knex.schema.alterTable('accounts', table => {
    table.string('current_classification', 20).defaultTo('NOT_APPLICABLE').nullable();
  });

  // 2. Backfill existing accounts based on standard rules
  // Assets (Code starting with 1):
  // - code starts with 15 or 16 ➔ NON_CURRENT
  // - other codes ➔ CURRENT
  await knex('accounts')
    .where('category', 'Asset')
    .andWhere(function() {
      this.where('code', 'like', '15%').orWhere('code', 'like', '16%');
    })
    .update({ current_classification: 'NON_CURRENT' });

  await knex('accounts')
    .where('category', 'Asset')
    .andWhereNot(function() {
      this.where('code', 'like', '15%').orWhere('code', 'like', '16%');
    })
    .update({ current_classification: 'CURRENT' });

  // Liabilities (Code starting with 2):
  // - name contains 'long-term', 'loan', 'lease', 'mortgage' (case-insensitive) OR starts with 25 ➔ NON_CURRENT
  // - others ➔ CURRENT
  await knex('accounts')
    .where('category', 'Liability')
    .andWhere(function() {
      this.whereRaw("LOWER(name) LIKE '%long-term%'")
        .orWhereRaw("LOWER(name) LIKE '%long term%'")
        .orWhereRaw("LOWER(name) LIKE '%loan%'")
        .orWhereRaw("LOWER(name) LIKE '%lease%'")
        .orWhereRaw("LOWER(name) LIKE '%mortgage%'")
        .orWhere('code', 'like', '25%');
    })
    .update({ current_classification: 'NON_CURRENT' });

  await knex('accounts')
    .where('category', 'Liability')
    .andWhereNot(function() {
      this.whereRaw("LOWER(name) LIKE '%long-term%'")
        .orWhereRaw("LOWER(name) LIKE '%long term%'")
        .orWhereRaw("LOWER(name) LIKE '%loan%'")
        .orWhereRaw("LOWER(name) LIKE '%lease%'")
        .orWhereRaw("LOWER(name) LIKE '%mortgage%'")
        .orWhere('code', 'like', '25%');
    })
    .update({ current_classification: 'CURRENT' });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('accounts', table => {
    table.dropColumn('current_classification');
  });
};
