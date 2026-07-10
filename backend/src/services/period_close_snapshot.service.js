const db = require('../config/db');
const ReportModel = require('../models/report.model');

class PeriodCloseSnapshotService {
  /**
   * Captures and persists the financial snapshot of a closing period.
   */
  static async captureSnapshot(companyId, periodId, sessionId, trx = db) {
    const period = await trx('accounting_periods')
      .where({ id: periodId, company_id: companyId })
      .first();
    if (!period) throw new Error('Accounting period not found.');

    const startDate = period.start_date;
    const endDate = period.end_date;

    // 1. Fetch live report data using existing ReportModel calculations
    const trialBalance = await ReportModel.getTrialBalance(companyId, startDate, endDate, trx);
    const incomeStatement = await ReportModel.getIncomeStatement(companyId, startDate, endDate, trx);
    const balanceSheet = await ReportModel.getBalanceSheet(companyId, endDate, trx);

    // Calculate trial balance difference
    let totalDr = 0, totalCr = 0;
    for (const r of trialBalance) {
      totalDr += parseFloat(r.debit || 0);
      totalCr += parseFloat(r.credit || 0);
    }
    const tbDiff = Math.abs(totalDr - totalCr);

    // Extract key numbers
    const profit = parseFloat(incomeStatement.netProfit || 0);
    const assets = parseFloat(balanceSheet.totalAssets || 0);
    const liabilities = parseFloat(balanceSheet.totalLiabilities || 0);
    const equity = parseFloat(balanceSheet.totalEquity || 0);

    // 2. Prepare JSON snapshot payload
    const snapshotPayload = {
      trialBalance,
      balanceSheet,
      incomeStatement,
      timestamp: new Date().toISOString()
    };

    // 3. Insert snapshot record
    const [snapshot] = await trx('period_close_snapshots')
      .insert({
        session_id: sessionId,
        period_id: periodId,
        profit,
        assets,
        liabilities,
        equity,
        trial_balance_difference: tbDiff,
        snapshot_json: JSON.stringify(snapshotPayload)
      })
      .returning('*');

    return snapshot;
  }
}

module.exports = PeriodCloseSnapshotService;
