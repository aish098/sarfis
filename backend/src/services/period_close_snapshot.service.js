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
    const cashFlow = await ReportModel.getCashFlow(companyId, startDate, endDate, trx);

    // 2. Fetch aging reports
    const ReportService = require('./report.service');
    const ar = await ReportService.getARAging(companyId, trx);
    const ap = await ReportService.getAPAging(companyId, trx);

    // 3. Fetch Inventory status
    const inventory = await trx('inventory as i')
      .join('products as p', 'i.product_id', 'p.id')
      .join('warehouses as w', 'i.warehouse_id', 'w.id')
      .select('p.sku', 'p.name as product_name', 'w.name as warehouse_name', 'i.quantity')
      .where('p.company_id', companyId);

    // 4. Fetch Budgets
    const budget = await trx('budgets')
      .where({ company_id: companyId });

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

    // 5. Prepare JSON snapshot payload
    const snapshotPayload = {
      trialBalance,
      balanceSheet,
      incomeStatement,
      cashFlow,
      aging: { ar, ap },
      inventory,
      budget,
      timestamp: new Date().toISOString()
    };

    // 6. Insert snapshot record
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
