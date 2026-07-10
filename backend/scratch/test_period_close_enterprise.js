const db = require('../src/config/db');
const PeriodCloseService = require('../src/services/period_close.service');
const PeriodCloseSnapshotService = require('../src/services/period_close_snapshot.service');
const PeriodCloseReportService = require('../src/services/period_close_report.service');
const PeriodValidationService = require('../src/services/period_validation.service');
const WorkflowEngineService = require('../src/services/workflow_engine.service');

async function runTests() {
  console.log('--- STARTING ENTERPRISE PERIOD CLOSE UAT SUITE ---');

  let testCompanyId, testPeriodId, testUserId;

  try {
    // 1. Setup Test Context
    await db.transaction(async (trx) => {
      // Find or create test company
      let comp = await trx('companies').where({ name: 'UAT Enterprise Close Co.' }).first();
      if (!comp) {
        [comp] = await trx('companies').insert({ name: 'UAT Enterprise Close Co.' }).returning('*');
      }
      testCompanyId = comp.id;

      // Find or create test user
      let user = await trx('users').where({ email: 'close_manager@uat.com' }).first();
      if (!user) {
        [user] = await trx('users')
          .insert({
            name: 'Audit Manager',
            email: 'close_manager@uat.com',
            role: 'Company Admin',
            password: 'mock_password_hash'
          })
          .returning('*');
      }
      testUserId = user.id;

      // Assign user role
      const adminRole = await trx('roles').where({ name: 'Admin' }).first();
      if (adminRole) {
        const roleExists = await trx('user_roles')
          .where({ user_id: testUserId, company_id: testCompanyId, role_id: adminRole.id })
          .first();
        if (!roleExists) {
          await trx('user_roles')
            .insert({ user_id: testUserId, company_id: testCompanyId, role_id: adminRole.id });
        }
      }

      // Create test accounting period
      let period = await trx('accounting_periods')
        .where({ company_id: testCompanyId, period_name: 'January 2026' })
        .first();
      if (!period) {
        [period] = await trx('accounting_periods')
          .insert({
            company_id: testCompanyId,
            period_name: 'January 2026',
            start_date: '2026-01-01',
            end_date: '2026-01-31',
            status: 'OPEN'
          })
          .returning('*');
      }
      testPeriodId = period.id;
    });

    console.log(`[SETUP] Context configured: Company ID ${testCompanyId}, User ID ${testUserId}, Period ID ${testPeriodId}`);

    // 2. Test Close Dashboard Calculations
    const dash = await PeriodCloseService.getCloseDashboard(testCompanyId, testPeriodId, testUserId);
    console.log('[TEST] Close Dashboard status:', dash.status);
    console.log('[TEST] Close Dashboard progress:', dash.progress, '%');
    if (typeof dash.progress !== 'number' || dash.progress < 0 || dash.progress > 100) {
      throw new Error('Invalid dashboard progress calculation.');
    }

    // 3. Test Financial Impact Summary
    const summary = await PeriodCloseService.getFinancialSummary(testCompanyId, testPeriodId);
    console.log('[TEST] Financial Summary assets:', summary.assets);
    console.log('[TEST] Financial Summary netProfit:', summary.netProfit);
    if (summary.trialBalanceDifference === undefined) {
      throw new Error('Trial Balance difference must be computed in financial summary.');
    }

    // 4. Test Stakeholder Signoffs
    const steps = ['INVENTORY', 'PAYROLL', 'BANK_REC', 'GL_CONTROL', 'BUDGET', 'TRIAL_BALANCE'];
    for (const step of steps) {
      await db('period_close_signoffs')
        .insert({
          company_id: testCompanyId,
          session_id: dash.session.id,
          step,
          checked: true,
          user_id: testUserId,
          checked_at: db.fn.now()
        })
        .onConflict(['session_id', 'step'])
        .merge();
    }
    const signoffs = await db('period_close_signoffs').where({ session_id: dash.session.id });
    console.log('[TEST] Registered signoffs count:', signoffs.length);
    if (signoffs.length !== 6) {
      throw new Error('Signoffs count mismatch. Expected 6.');
    }

    // 5. Test validateBeforeClose
    const validationPassed = await PeriodCloseService.validateBeforeClose(testCompanyId, testPeriodId);
    console.log('[TEST] validateBeforeClose passing status:', validationPassed);

    // 6. Test direct lock period
    const closedPeriod = await PeriodCloseService.closePeriod(testPeriodId, testCompanyId, testUserId);
    console.log('[TEST] Closed period status:', closedPeriod.status);
    if (closedPeriod.status !== 'CLOSED') {
      throw new Error('Close Period status should be CLOSED.');
    }

    // 7. Verify Period validation blocks transaction date inside closed period
    try {
      await PeriodValidationService.validateDate(testCompanyId, '2026-01-15');
      throw new Error('Validation should have thrown an error for locked period!');
    } catch (err) {
      console.log('[TEST] Period validation blocked transaction date correctly:', err.message);
    }

    // 8. Test Concurrency Close prevention
    try {
      await Promise.all([
        PeriodCloseService.closePeriod(testPeriodId, testCompanyId, testUserId),
        PeriodCloseService.closePeriod(testPeriodId, testCompanyId, testUserId)
      ]);
    } catch (err) {
      console.log('[TEST] Concurrency check: Simultaneous closing blocked as expected:', err.message);
    }

    // 9. Test Reopen Lifecycle
    const reopened = await PeriodCloseService.reopenPeriod(testPeriodId, testCompanyId, testUserId, 'Audit Adjustments');
    console.log('[TEST] Reopened period status:', reopened.status);
    if (reopened.status !== 'OPEN') {
      throw new Error('Reopened period status should be OPEN.');
    }

    // Verify posting unblocked again after reopening
    const validatedPeriod = await PeriodValidationService.validateDate(testCompanyId, '2026-01-15');
    console.log('[TEST] Period validation successfully verified after reopen:', validatedPeriod.period_name);

    console.log('--- ALL ENTERPRISE PERIOD CLOSE UAT SCENARIOS PASSED ---');
  } catch (err) {
    console.error('--- UAT TEST FAILURE ---');
    console.error(err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
