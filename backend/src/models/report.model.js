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

  static async getAccountBalanceAsOf(companyId, accountId, asOfDate, trx = db) {
    const res = await trx('journal_lines as l')
      .join('journal_entries as je', 'l.entry_id', 'je.id')
      .sum('l.debit as total_debit')
      .sum('l.credit as total_credit')
      .where('je.entry_date', '<=', asOfDate)
      .andWhere('l.account_id', accountId)
      .first();

    const dr = parseFloat(res?.total_debit || 0);
    const cr = parseFloat(res?.total_credit || 0);
    return { debit: dr, credit: cr };
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
      .select('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra', 'a.current_classification')
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
      .groupBy('a.id', 'a.code', 'a.name', 'a.category', 'a.normal_balance', 'a.is_contra', 'a.current_classification')
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

  static async getCashFlow(companyId, startDate, endDate, method = 'indirect', trx = db) {
    const targetDate = endDate || startDate;
    if (targetDate) {
      const snapshot = await this.getClosedPeriodSnapshot(companyId, targetDate, trx);
      if (snapshot && snapshot.cashFlow) {
        return snapshot.cashFlow;
      }
    }

    if (method === 'direct') {
      return this.getCashFlowDirect(companyId, startDate, endDate, trx);
    }
    return this.getCashFlowIndirect(companyId, startDate, endDate, trx);
  }

  static async getCashFlowDirect(companyId, startDate, endDate, trx = db) {
    // 1. Fetch cash/bank journals
    const cashEntries = await trx('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .join('journal_entries as je', 'l.entry_id', 'je.id')
      .select('l.entry_id', 'l.debit', 'l.credit', 'a.name as cash_account_name')
      .where('a.company_id', companyId)
      .andWhere(function() {
        this.where(trx.raw('LOWER(a.name)'), 'like', '%cash%')
            .orWhere(trx.raw('LOWER(a.name)'), 'like', '%bank%');
      })
      .andWhere('je.entry_date', '>=', startDate)
      .andWhere('je.entry_date', '<=', endDate);

    if (cashEntries.length === 0) return [];

    const entryIds = cashEntries.map(e => e.entry_id);

    // 2. Fetch counterparts
    const counterparts = await trx('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .select('l.entry_id', 'l.debit', 'l.credit', 'a.category', 'a.name')
      .whereIn('l.entry_id', entryIds)
      .andWhereNot(function() {
        this.where(trx.raw('LOWER(a.name)'), 'like', '%cash%')
            .orWhere(trx.raw('LOWER(a.name)'), 'like', '%bank%');
      });

    let operatingReceipts = 0;
    let operatingPayments = 0;
    let investingFlow = 0;
    let financingFlow = 0;

    for (const cashLine of cashEntries) {
      const entryCounterparts = counterparts.filter(c => c.entry_id === cashLine.entry_id);
      const magnitude = parseFloat(cashLine.debit || 0) - parseFloat(cashLine.credit || 0);

      if (entryCounterparts.length > 0) {
        const c = entryCounterparts[0];
        const category = c.category;
        const nameLower = c.name.toLowerCase();

        if (category === 'Revenue' || category === 'Income' || nameLower.includes('receivable')) {
          operatingReceipts += magnitude;
        } else if (category === 'Expense' || nameLower.includes('payable') || nameLower.includes('payroll')) {
          operatingPayments += magnitude;
        } else if (nameLower.includes('asset') || nameLower.includes('equipment') || nameLower.includes('property')) {
          investingFlow += magnitude;
        } else if (category === 'Equity' || nameLower.includes('loan') || nameLower.includes('borrowing')) {
          financingFlow += magnitude;
        } else {
          operatingReceipts += magnitude; // Fallback
        }
      } else {
        operatingReceipts += magnitude;
      }
    }

    return [
      { category: 'Operating Cash Receipts', amount: operatingReceipts },
      { category: 'Operating Cash Payments', amount: operatingPayments },
      { category: 'Investing Activities', amount: investingFlow },
      { category: 'Financing Activities', amount: financingFlow },
      { category: 'Net Increase in Cash', amount: operatingReceipts + operatingPayments + investingFlow + financingFlow }
    ];
  }

  static async getCashFlowIndirect(companyId, startDate, endDate, trx = db) {
    const incomeStatement = await this.getIncomeStatement(companyId, startDate, endDate, trx);
    const netProfit = incomeStatement.netProfit || 0;

    // Get non-cash depreciation sum
    const depreciationRes = await trx('journal_lines as l')
      .join('accounts as a', 'l.account_id', 'a.id')
      .join('journal_entries as je', 'l.entry_id', 'je.id')
      .sum('l.debit as total_debit')
      .where('je.entry_date', '>=', startDate)
      .andWhere('je.entry_date', '<=', endDate)
      .andWhere('a.company_id', companyId)
      .andWhereILike('a.name', '%depreciation%')
      .first();
    const depreciation = parseFloat(depreciationRes?.total_debit || 0);

    // Prior Date
    const priorDateObj = new Date(startDate);
    priorDateObj.setDate(priorDateObj.getDate() - 1);
    const priorDate = priorDateObj.toISOString().split('T')[0];

    // Compute working capital differences
    const accounts = await trx('accounts').where({ company_id: companyId });

    let arChange = 0;
    let apChange = 0;
    let invChange = 0;

    for (const acc of accounts) {
      const priorBal = await this.getAccountBalanceAsOf(companyId, acc.id, priorDate, trx);
      const closeBal = await this.getAccountBalanceAsOf(companyId, acc.id, endDate, trx);

      const priorAmt = acc.normal_balance === 'Debit' ? priorBal.debit - priorBal.credit : priorBal.credit - priorBal.debit;
      const closeAmt = acc.normal_balance === 'Debit' ? closeBal.debit - closeBal.credit : closeBal.credit - closeBal.debit;
      const diff = closeAmt - priorAmt;

      const nameLower = acc.name.toLowerCase();
      if (acc.is_control || nameLower.includes('receivable')) {
        arChange += diff;
      } else if (nameLower.includes('payable')) {
        apChange += diff;
      } else if (nameLower.includes('inventory') || nameLower.includes('stock')) {
        invChange += diff;
      }
    }

    // Operating Flow = Profit + Depreciation - Increase in AR - Increase in Inventory + Increase in AP
    const operatingFlow = netProfit + depreciation - arChange - invChange + apChange;

    return [
      { category: 'Net Income (Profit)', amount: netProfit },
      { category: 'Adjustments for Non-Cash Items (Depreciation)', amount: depreciation },
      { category: 'Decrease (Increase) in Accounts Receivable', amount: -arChange },
      { category: 'Decrease (Increase) in Inventory', amount: -invChange },
      { category: 'Increase (Decrease) in Accounts Payable', amount: apChange },
      { category: 'Net Cash from Operating Activities', amount: operatingFlow }
    ];
  }

  static async getStatementOfChangesInEquity(companyId, startDate, endDate, trx = db) {
    const priorDateObj = new Date(startDate);
    priorDateObj.setDate(priorDateObj.getDate() - 1);
    const priorDate = priorDateObj.toISOString().split('T')[0];

    const equityAccounts = await trx('accounts')
      .where({ company_id: companyId, category: 'Equity' });

    const rows = [];
    let totalOpening = 0;
    let totalAdditions = 0;
    let totalReductions = 0;
    let totalClosing = 0;

    const incomeStatement = await this.getIncomeStatement(companyId, startDate, endDate, trx);
    const netProfit = incomeStatement.netProfit || 0;

    for (const acc of equityAccounts) {
      const priorBal = await this.getAccountBalanceAsOf(companyId, acc.id, priorDate, trx);
      const closeBal = await this.getAccountBalanceAsOf(companyId, acc.id, endDate, trx);

      const opening = priorBal.credit - priorBal.debit;
      const closing = closeBal.credit - closeBal.debit;

      const periodTrans = await trx('journal_lines as l')
        .join('journal_entries as je', 'l.entry_id', 'je.id')
        .select('l.debit', 'l.credit', 'je.description')
        .where('je.entry_date', '>=', startDate)
        .andWhere('je.entry_date', '<=', endDate)
        .andWhere('l.account_id', acc.id);

      let additions = 0;
      let reductions = 0;

      if (acc.name.toLowerCase().includes('retained earnings')) {
        if (netProfit > 0) additions += netProfit;
        else reductions += Math.abs(netProfit);
      }

      for (const line of periodTrans) {
        if (line.description && line.description.includes('Year-End Closing')) continue;

        const credit = parseFloat(line.credit || 0);
        const debit = parseFloat(line.debit || 0);

        if (credit > debit) additions += (credit - debit);
        else reductions += (debit - credit);
      }

      totalOpening += opening;
      totalAdditions += additions;
      totalReductions += reductions;
      totalClosing += closing;

      rows.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        opening,
        additions,
        reductions,
        closing
      });
    }

    return {
      rows,
      summary: {
        opening: totalOpening,
        additions: totalAdditions,
        reductions: totalReductions,
        closing: totalClosing
      }
    };
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
