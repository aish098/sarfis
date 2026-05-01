const db = require('../src/config/db');

async function checkImbalance() {
  try {
    const unbalanced = await db('journal_lines as jl')
      .join('journal_entries as je', 'je.id', 'jl.entry_id')
      .groupBy('je.id', 'je.description', 'je.company_id')
      .select(
        'je.id',
        'je.company_id',
        'je.description',
        db.raw('SUM(jl.debit) as total_debit'),
        db.raw('SUM(jl.credit) as total_credit'),
        db.raw('ABS(SUM(jl.debit) - SUM(jl.credit)) as difference')
      )
      .having(db.raw('SUM(jl.debit) != SUM(jl.credit)'));

    console.log("Unbalanced Journal Entries Found:", JSON.stringify(unbalanced, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkImbalance();
