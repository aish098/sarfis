const db = require('../config/db');

class ReportModel {
  /**
   * Helper to retrieve historical closed period report snapshot.
   */
  static async getClosedPeriodSnapshot(companyId, targetDate, trx = db) {
    const period = await trx('accounting_periods')
      .where('company_id', companyId)
      .andWhere('start_date', '<=', targetDate)
      .andWhere('end_date', '>=', targetDate)
      .andWhere('status', 'CLOSED')
      .first();

    if (period) {
      const session = await trx('period_close_sessions')
        .where({ company_id: companyId, period_id: period.id, status: 'CLOSED' })
        .orderBy('created_at', 'desc')
        .first();

      if (session) {
        const snapshot = await trx('period_close_snapshots')
          .where({ session_id: session.id })
          .first();
        if (snapshot) {
          return JSON.parse(snapshot.snapshot_json);
        }
      }
    }
    return null;
  }

  static async getTrialBalance(companyId, startDate, endDate, trx = db) {
    const targetDate = endDate || startDate;
    if (targetDate) {
      const snapshot = await this.getClosedPeriodSnapshot(companyId, targetDate, trx);
      if (snapshot && snapshot.trialBalance) {
        return snapshot.trialBalance;
      }
    }

    let query = trx('accounts as a')
      .select('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra', 'a.balance as static_balance')
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
      .groupBy('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra', 'a.balance')
      .having(trx.raw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0'))
      .orderBy('a.code', 'asc');
  }

  static async getIncomeStatement(companyId, startDate, endDate, trx = db) {
    const targetDate = endDate || startDate;
    if (targetDate) {
      const snapshot = await this.getClosedPeriodSnapshot(companyId, targetDate, trx);
      if (snapshot && snapshot.incomeStatement) {
        return snapshot.incomeStatement;
      }
    }

    let query = trx('accounts as a')
      .select('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('a.company_id', companyId)
      .whereIn('a.category', ['Income', 'Revenue', 'Expense']);

    if (startDate && endDate) {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id')
        .join('journal_entries as je', 'l.entry_id', 'je.id')
        .where('je.entry_date', '>=', startDate)
        .where('je.entry_date', '<=', endDate);
    } else {
      query = query.join('journal_lines as l', 'a.id', 'l.account_id');
    }

    const rows = await query
      .groupBy('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra')
      .having(trx.raw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0'))
      .orderBy('a.category', 'desc')
      .orderBy('a.code', 'asc');

    // Replicate model parsing (net profit formatting if required)
    let revenue = 0, expenses = 0;
    const items = rows.map(r => {
      const dr = parseFloat(r.total_debit || 0);
      const cr = parseFloat(r.total_credit || 0);
      let balance = 0;
      if (r.category === 'Expense') {
        balance = r.normal_balance === 'Debit' ? dr - cr : cr - dr;
        expenses += balance;
      } else {
        balance = r.normal_balance === 'Credit' ? cr - dr : dr - cr;
        revenue += balance;
      }
      return { ...r, balance };
    });

    const netProfit = revenue - expenses;
    return {
      revenue,
      expenses,
      netProfit,
      items
    };
  }

  static async getBalanceSheet(companyId, asOfDate, trx = db) {
    if (asOfDate) {
      const snapshot = await this.getClosedPeriodSnapshot(companyId, asOfDate, trx);
      if (snapshot && snapshot.balanceSheet) {
        return snapshot.balanceSheet;
      }
    }

    let query = trx('accounts as a')
      .select('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra')
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

    const rows = await query
      .groupBy('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra')
      .having(trx.raw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0'))
      .orderBy('a.category', 'asc')
      .orderBy('a.code', 'asc');

    let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;
    const items = rows.map(r => {
      const dr = parseFloat(r.total_debit || 0);
      const cr = parseFloat(r.total_credit || 0);
      let balance = 0;
      if (r.category === 'Asset') {
        balance = r.normal_balance === 'Debit' ? dr - cr : cr - dr;
        totalAssets += balance;
      } else if (r.category === 'Liability') {
        balance = r.normal_balance === 'Credit' ? cr - dr : dr - cr;
        totalLiabilities += balance;
      } else if (r.category === 'Equity') {
        balance = r.normal_balance === 'Credit' ? cr - dr : dr - cr;
        totalEquity += balance;
      }
      return { ...r, balance };
    });

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      items
    };
  }

  static async getCashFlow(companyId, startDate, endDate, trx = db) {
    const targetDate = endDate || startDate;
    if (targetDate) {
      const snapshot = await this.getClosedPeriodSnapshot(companyId, targetDate, trx);
      if (snapshot && snapshot.cashFlow) {
        return snapshot.cashFlow;
      }
    }

    const cashEntries = await trx('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .join('journal_entries as je', 'l.entry_id', 'je.id')
      .select('l.entry_id', 'l.debit', 'l.credit', 'l.account_id', 'a.name as cash_account_name')
      .where('a.company_id', companyId)
      .andWhere(function() {
        this.where(trx.raw('LOWER(a.name)'), 'like', '%cash%')
            .orWhere(trx.raw('LOWER(a.name)'), 'like', '%bank%');
      })
      .andWhere('je.entry_date', '>=', startDate)
      .andWhere('je.entry_date', '<=', endDate);

    if (cashEntries.length === 0) return [];

    const entryIds = cashEntries.map(e => e.entry_id);

    const counterparts = await trx('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .select('l.entry_id', 'l.debit', 'l.credit', 'a.category as type', 'a.name')
      .whereIn('l.entry_id', entryIds)
      .andWhereNot(function() {
        this.where(trx.raw('LOWER(a.name)'), 'like', '%cash%')
            .orWhere(trx.raw('LOWER(a.name)'), 'like', '%bank%');
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
        results.push({
          type: 'Transfer',
          name: cashLine.cash_account_name,
          magnitude: netCash
        });
      }
    }

    return results;
  }

  static async getTemporaryAccountsBalances(companyId, endDate, trx = db) {
    return trx('accounts as a')
      .join('journal_lines as l', 'a.id', 'l.account_id')
      .join('journal_entries as e', 'l.entry_id', 'e.id')
      .select('a.id', 'a.category as type', 'a.balance as account_balance')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('a.company_id', companyId)
      .whereIn('a.category', ['Income', 'Revenue', 'Expense'])
      .where('e.entry_date', '<=', endDate)
      .groupBy('a.id', 'a.category', 'a.balance');
  }

  static async findRetainedEarningsAccount(companyId, trx = db) {
    return trx('accounts')
      .where('company_id', companyId)
      .whereILike('name', '%Retained Earnings%')
      .first();
  }
}

module.exports = ReportModel;
