const db = require('../config/db');

class AnalyticsModel {
  static async getAccountBalances(companyId, period) {
    const query = db('accounts as a')
      .leftJoin('journal_lines as l', 'a.id', 'l.account_id')
      .leftJoin('journal_entries as e', 'l.entry_id', 'e.id')
      .select('a.type', 'a.code', 'a.name')
      .sum('l.debit as td')
      .sum('l.credit as tc')
      .where('a.company_id', companyId)
      .groupBy('a.type', 'a.code', 'a.name');

    if (period) {
      // Calculate cumulative balances up to the end of the selected period
      query.andWhereRaw("TO_CHAR(e.entry_date, 'YYYY-MM') <= ?", [period]);
    }

    return query;
  }

  static async getBudgetsWithActuals(companyId, period) {
    // Using raw for the subquery due to complex logic and Postgres specific functions
    return db('accounts as a')
      .leftJoin('budgets as b', function() {
        this.on('a.id', '=', 'b.account_id').andOn('b.period', '=', db.raw('?', [period]));
      })
      .select(
        'a.id as account_id',
        'a.name as account_name',
        'a.code',
        'a.type',
        db.raw('COALESCE(b.amount, 0) as budgeted_amount'),
        db.raw(`
          COALESCE(
            ABS(
              (SELECT SUM(CASE 
                          WHEN LOWER(a2.type) IN ('income','revenue','liability','equity') THEN l.credit - l.debit 
                          ELSE l.debit - l.credit END)
               FROM journal_lines l
               JOIN journal_entries e ON l.entry_id = e.id
               JOIN accounts a2 ON l.account_id = a2.id
               WHERE l.account_id = a.id AND TO_CHAR(e.entry_date, 'YYYY-MM') = ?
              )
            ), 0) as actual_amount
        `, [period])
      )
      .where('a.company_id', companyId)
      .whereIn(db.raw('LOWER(a.type)'), ['income', 'revenue', 'expense'])
      .orderBy('a.type', 'desc')
      .orderBy('a.code', 'asc');
  }

  static async upsertBudget(budgetData) {
    const { company_id, account_id, period, amount } = budgetData;
    const [budget] = await db('budgets')
      .insert({ company_id, account_id, period, amount })
      .onConflict(['company_id', 'account_id', 'period'])
      .merge({ amount })
      .returning('*');
    return budget;
  }

  static async getHistoricalRevenue(companyId) {
    const revenues = await db('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .join('journal_entries as e', 'l.entry_id', 'e.id')
      .where('a.company_id', companyId)
      .andWhereRaw("LOWER(a.type) IN ('income', 'revenue')")
      .andWhereRaw("e.entry_date >= DATE_TRUNC('month', NOW() - INTERVAL '1 year')")
      .groupByRaw("DATE_TRUNC('month', e.entry_date)")
      .orderByRaw("DATE_TRUNC('month', e.entry_date)")
      .select([
        db.raw("DATE_TRUNC('month', e.entry_date) as month"),
        db.raw("ABS(SUM(l.credit - l.debit)) as revenue")
      ]);
    return revenues;
  }
}

module.exports = AnalyticsModel;