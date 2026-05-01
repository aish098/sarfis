const db = require('../config/db');

class ReportModel {
  static async getTrialBalance(companyId, startDate, endDate) {
    let query = db('accounts as a')
      .select('a.id', 'a.code', 'a.name', 'a.type', 'a.balance as static_balance')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('a.company_id', companyId);

    if (startDate && endDate) {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id')
        .join('journal_entries as je', 'l.entry_id', 'je.id')
        .where('je.entry_date', '>=', startDate)
        .where('je.entry_date', '<=', endDate);
    } else {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id');
    }

    return query
      .groupBy('a.id', 'a.code', 'a.name', 'a.type', 'a.balance')
      .having(db.raw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0'))
      .orderBy('a.code', 'asc');
  }

  static async getIncomeStatement(companyId, startDate, endDate) {
    let query = db('accounts as a')
      .select('a.id', 'a.code', 'a.name', 'a.type')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('a.company_id', companyId)
      .whereIn(db.raw('LOWER(a.type)'), ['income', 'revenue', 'expense']);

    if (startDate && endDate) {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id')
        .join('journal_entries as je', 'l.entry_id', 'je.id')
        .where('je.entry_date', '>=', startDate)
        .where('je.entry_date', '<=', endDate);
    } else {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id');
    }

    return query
      .groupBy('a.id', 'a.code', 'a.name', 'a.type')
      .having(db.raw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0'))
      .orderBy('a.type', 'desc')
      .orderBy('a.code', 'asc');
  }

  static async getBalanceSheet(companyId, asOfDate) {
    let query = db('accounts as a')
      .select('a.id', 'a.code', 'a.name', 'a.type')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('a.company_id', companyId);

    if (asOfDate) {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id')
        .join('journal_entries as je', 'l.entry_id', 'je.id')
        .where('je.entry_date', '<=', asOfDate);
    } else {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id');
    }

    return query
      .groupBy('a.id', 'a.code', 'a.name', 'a.type')
      .having(db.raw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0'))
      .orderBy('a.type', 'asc')
      .orderBy('a.code', 'asc');
  }

  static async getCashFlow(companyId, startDate, endDate) {
    // 1. Identify all transactions targeting 'Cash' or 'Bank' accounts flexibly
    const cashEntries = await db('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .join('journal_entries as je', 'l.entry_id', 'je.id')
      .select('l.entry_id', 'l.debit', 'l.credit', 'l.account_id', 'a.name as cash_account_name')
      .where('a.company_id', companyId)
      .andWhere(function() {
        this.where(db.raw('LOWER(a.name)'), 'like', '%cash%')
            .orWhere(db.raw('LOWER(a.name)'), 'like', '%bank%');
      })
      .andWhere('je.entry_date', '>=', startDate)
      .andWhere('je.entry_date', '<=', endDate);

    if (cashEntries.length === 0) return [];

    const entryIds = cashEntries.map(e => e.entry_id);

    // 2. Find the 'other side' of these entries to categorize the flow
    const counterparts = await db('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .select('l.entry_id', 'l.debit', 'l.credit', 'a.type', 'a.name')
      .whereIn('l.entry_id', entryIds)
      .andWhereNot(function() {
        this.where(db.raw('LOWER(a.name)'), 'like', '%cash%')
            .orWhere(db.raw('LOWER(a.name)'), 'like', '%bank%');
      });

    const results = [];
    for (let cashLine of cashEntries) {
      const entryCounterparts = counterparts.filter(c => c.entry_id === cashLine.entry_id);
      const netCash = parseFloat(cashLine.debit || 0) - parseFloat(cashLine.credit || 0);

      if (entryCounterparts.length > 0) {
        results.push({
          type: entryCounterparts[0].type,
          name: entryCounterparts[0].name,
          magnitude: netCash
        });
      } else {
        // Internal transfer or missing counterpart
        results.push({
          type: 'Transfer',
          name: cashLine.cash_account_name,
          magnitude: netCash
        });
      }
    }

    return results;
  }

  static async getTemporaryAccountsBalances(companyId, endDate, trx) {
    const query = db('accounts as a')
      .join('journal_lines as l', 'a.id', 'l.account_id')
      .join('journal_entries as e', 'l.entry_id', 'e.id')
      .select('a.id', 'a.type', 'a.balance as account_balance')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('a.company_id', companyId)
      .whereIn('a.type', ['Income', 'Revenue', 'Expense'])
      .where('e.entry_date', '<=', endDate)
      .groupBy('a.id', 'a.type', 'a.balance');

    if (trx) query.transacting(trx);
    return query;
  }

  static async findRetainedEarningsAccount(companyId, trx) {
    const query = db('accounts')
      .where('company_id', companyId)
      .whereILike('name', '%Retained Earnings%')
      .first();

    if (trx) query.transacting(trx);
    return query;
  }
}

module.exports = ReportModel;
