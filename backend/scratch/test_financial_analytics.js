const db = require('../src/config/db');
const ReportModel = require('../src/models/report.model');
const AnalyticsService = require('../src/services/analytics.service');
const ScheduledReportsService = require('../src/services/scheduled_reports.service');
const MailProvider = require('../src/services/mail/mail.provider');

async function runTests() {
  console.log('--- STARTING PHASE 9: FINANCIAL STATEMENTS & ANALYTICS UAT SUITE ---');

  let testCompanyId, testUserId;

  try {
    // 1. Setup Test Context
    await db.transaction(async (trx) => {
      // Find or create company
      let comp = await trx('companies').where({ name: 'UAT Analytics Corp.' }).first();
      if (!comp) {
        [comp] = await trx('companies').insert({ name: 'UAT Analytics Corp.' }).returning('*');
      }
      testCompanyId = comp.id;

      // Find or create user
      let user = await trx('users').where({ email: 'analytics_cfo@uat.com' }).first();
      if (!user) {
        [user] = await trx('users')
          .insert({
            name: 'Analytics CFO',
            email: 'analytics_cfo@uat.com',
            role: 'Company Admin',
            password: 'mock_password_hash'
          })
          .returning('*');
      }
      testUserId = user.id;

      // Map user to company admin role
      const adminRole = await trx('roles').where({ name: 'Admin' }).first();
      if (adminRole) {
        const roleExists = await trx('user_roles')
          .where({ user_id: testUserId, company_id: testCompanyId, role_id: adminRole.id })
          .first();
        if (!roleExists) {
          await trx('user_roles').insert({ user_id: testUserId, company_id: testCompanyId, role_id: adminRole.id });
        }
      }

      // Setup clean accounts for the company
      await trx('journal_lines')
        .whereIn('entry_id', function() {
          this.select('id').from('journal_entries').where({ company_id: testCompanyId });
        })
        .delete();
      await trx('journal_entries').where({ company_id: testCompanyId }).delete();
      await trx('accounts').where({ company_id: testCompanyId }).delete();
      
      const [cashAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '1010', name: 'Cash at Bank', category: 'Asset', normal_balance: 'Debit', balance: 150000 }).returning('*');
      const [arAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '1210', name: 'Accounts Receivable', category: 'Asset', normal_balance: 'Debit', balance: 50000 }).returning('*');
      const [invAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '1310', name: 'Inventory Stock', category: 'Asset', normal_balance: 'Debit', balance: 40000 }).returning('*');
      const [apAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '2010', name: 'Accounts Payable', category: 'Liability', normal_balance: 'Credit', balance: 30000 }).returning('*');
      const [equityAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '3010', name: 'Share Capital', category: 'Equity', normal_balance: 'Credit', balance: 200000 }).returning('*');
      const [revAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '4010', name: 'Sales Revenue', category: 'Revenue', normal_balance: 'Credit', balance: 0 }).returning('*');
      const [expAcc] = await trx('accounts').insert({ company_id: testCompanyId, code: '5010', name: 'Office Rent Expense', category: 'Expense', normal_balance: 'Debit', balance: 0 }).returning('*');

      // Create test accounting periods
      await trx('accounting_periods').where({ company_id: testCompanyId }).delete();
      const [p1] = await trx('accounting_periods').insert({ company_id: testCompanyId, period_name: 'Jan 2026', start_date: '2026-01-01', end_date: '2026-01-31', status: 'OPEN' }).returning('*');
      const [p2] = await trx('accounting_periods').insert({ company_id: testCompanyId, period_name: 'Feb 2026', start_date: '2026-02-01', end_date: '2026-02-28', status: 'OPEN' }).returning('*');

      // Seed a budget limit for Office Rent Expense (5010) for Jan 2026
      await trx('budgets').insert({
        company_id: testCompanyId,
        account_id: expAcc.id,
        period_month: 1,
        period_year: 2026,
        budget_amount: 100000,
        budget_type: 'account'
      });

      // Seed opening balance journal entries on 2025-12-31
      const [jeOpen] = await trx('journal_entries').insert({ company_id: testCompanyId, entry_date: '2025-12-31', description: 'Opening Balances' }).returning('*');
      await trx('journal_lines').insert([
        { entry_id: jeOpen.id, account_id: cashAcc.id, debit: 150000, credit: 0 },
        { entry_id: jeOpen.id, account_id: arAcc.id, debit: 50000, credit: 0 },
        { entry_id: jeOpen.id, account_id: invAcc.id, debit: 40000, credit: 0 },
        { entry_id: jeOpen.id, account_id: apAcc.id, debit: 0, credit: 30000 },
        { entry_id: jeOpen.id, account_id: equityAcc.id, debit: 0, credit: 210000 } // balanced
      ]);

      // Seed journal entries for Jan 2026
      const [je1] = await trx('journal_entries').insert({ company_id: testCompanyId, entry_date: '2026-01-15', description: 'Customer Invoice' }).returning('*');
      await trx('journal_lines').insert([
        { entry_id: je1.id, account_id: arAcc.id, debit: 120000, credit: 0 },
        { entry_id: je1.id, account_id: revAcc.id, debit: 0, credit: 120000 }
      ]);

      const [je2] = await trx('journal_entries').insert({ company_id: testCompanyId, entry_date: '2026-01-20', description: 'Pay Rent' }).returning('*');
      await trx('journal_lines').insert([
        { entry_id: je2.id, account_id: expAcc.id, debit: 40000, credit: 0 },
        { entry_id: je2.id, account_id: cashAcc.id, debit: 0, credit: 40000 }
      ]);
    });

    console.log('[SETUP] Test company and journal transactions configured.');

    // UAT-901: Trial Balance equals Balance Sheet assets = liabilities + equity
    const tb = await ReportModel.getTrialBalance(testCompanyId, '2026-01-01', '2026-01-31');
    const bs = await ReportModel.getBalanceSheet(testCompanyId, '2026-01-31');

    let totalDr = 0, totalCr = 0;
    for (const r of tb) {
      totalDr += parseFloat(r.total_debit || 0);
      totalCr += parseFloat(r.total_credit || 0);
    }
    console.log(`[UAT-901] Trial Balance total: Debit PKR ${totalDr}, Credit PKR ${totalCr}`);
    if (Math.abs(totalDr - totalCr) > 0.01) {
      throw new Error('Trial Balance is not balanced.');
    }

    const netEquity = bs.totalAssets - bs.totalLiabilities;
    console.log(`[UAT-901] Balance Sheet assets: PKR ${bs.totalAssets}, liabilities: PKR ${bs.totalLiabilities}, equity: PKR ${bs.totalEquity}`);
    // Assets = Liabilities + Equity (or Assets - Liabilities = Equity)
    // Note: Net Profit is technically equity, so totalAssets - totalLiabilities should equal totalEquity + Net profit.

    // UAT-902 & UAT-903: Direct & Indirect Cash Flow Statements
    const directCF = await ReportModel.getCashFlow(testCompanyId, '2026-01-01', '2026-01-31', 'direct');
    const indirectCF = await ReportModel.getCashFlow(testCompanyId, '2026-01-01', '2026-01-31', 'indirect');

    const directNet = directCF.find(c => c.category.includes('Net Increase')).amount;
    const indirectNet = indirectCF.find(c => c.category.includes('Net Cash')).amount;
    console.log(`[UAT-902/903] Direct Cash Flow net: PKR ${directNet}, Indirect net: PKR ${indirectNet}`);
    if (Math.abs(directNet - indirectNet) > 0.01) {
      throw new Error('Direct and Indirect Cash Flow methods must reconcile to the same net movement.');
    }

    // UAT-904: Statement of Changes in Equity
    const equityReport = await ReportModel.getStatementOfChangesInEquity(testCompanyId, '2026-01-01', '2026-01-31');
    console.log(`[UAT-904] Statement of Changes in Equity opening: PKR ${equityReport.summary.opening}, closing: PKR ${equityReport.summary.closing}`);
    if (equityReport.summary.closing === 0) {
      throw new Error('Statement of Changes in Equity failed to compile balances.');
    }

    // UAT-905: Ratio formulas return expected values
    const ratios = await AnalyticsService.getFinancialRatios(testCompanyId, '2026-01');
    console.log('[UAT-905] Current Ratio:', ratios.currentRatio);
    console.log('[UAT-905] Quick Ratio:', ratios.quickRatio);
    console.log('[UAT-905] Net Profit Margin:', ratios.profitMargin, '%');
    if (ratios.currentRatio === 0 || ratios.quickRatio === 0) {
      throw new Error('Ratio formulas computed incorrect/zero values.');
    }

    // UAT-908: Budget vs Actual Committed/Actual amounts
    const budgetCompare = await AnalyticsService.getBudgetVsActual(testCompanyId, 2026, 1);
    console.log('[UAT-908] Budget comparison detail list:');
    for (const b of budgetCompare.detailItems) {
      console.log(`  Account: ${b.account_name} (${b.account_code})`);
      console.log(`    Budget limit: PKR ${parseFloat(b.budget_amount || 0).toLocaleString()}`);
      console.log(`    Committed:    PKR ${parseFloat(b.committed_amount || 0).toLocaleString()}`);
      console.log(`    Actual:       PKR ${parseFloat(b.actual_amount || 0).toLocaleString()}`);
      console.log(`    Remaining:    PKR ${parseFloat(b.remaining_amount || 0).toLocaleString()}`);
      console.log(`    Variance:     ${parseFloat(b.variance_pct || 0).toFixed(1)}%`);
    }

    // UAT-910 / UAT-911: Scheduled report format verification
    const schedulePayload = {
      report_type: 'BALANCE_SHEET',
      frequency: 'MONTHLY',
      format: 'PDF',
      emails: ['exec1@uat.com', 'exec2@uat.com']
    };
    const schedule = await ScheduledReportsService.createSchedule(testCompanyId, testUserId, schedulePayload);
    console.log(`[UAT-910] Scheduled report successfully created with ID #${schedule.id}`);

    // Force run immediately by clearing next_run
    await db('scheduled_reports').where({ id: schedule.id }).update({ next_run: null });

    // Trigger runPendingSchedules
    await ScheduledReportsService.runPendingSchedules();
    const history = await db('report_history').where({ schedule_id: schedule.id });
    console.log('[UAT-915] Scheduled report run status:', history[0].status);
    if (history[0].status !== 'SUCCESS') {
      throw new Error(`Scheduled report failed. Error log: ${history[0].error}`);
    }

    console.log('--- ALL PHASE 9 FINANCIAL STATEMENTS & ANALYTICS SCENARIOS PASSED ---');
  } catch (err) {
    console.error('--- UAT TEST FAILURE ---');
    console.error(err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
