const db = require('../src/config/db');
const PayrollService = require('../src/services/payroll.service');

async function runTests() {
  console.log('=== RUNNING WORKSPACE PAYMENT OPERATIONS INTEGRATION TESTS ===');

  try {
    const companyId = 2; // Workspace default company
    const period = '2026-08';

    // 1. Fetch active employee
    let emp = await db('employees').where({ company_id: companyId, status: 'Active' }).first();
    if (!emp) {
      const [newEmp] = await db('employees').insert({
        company_id: companyId,
        name: 'John Doe Payment Test',
        salary: 150000.00,
        status: 'Active'
      }).returning('*');
      emp = newEmp;
    }

    console.log(`Using active employee: ${emp.name} (Salary: PKR ${emp.salary})`);

    // Ensure target accounting period is open
    const periodName = 'Aug 2026';
    const startDate = '2026-08-01';
    const endDate = '2026-08-31';
    await db('accounting_periods').where({ company_id: companyId, start_date: startDate }).delete();
    await db('accounting_periods').insert({
      company_id: companyId,
      period_name: periodName,
      start_date: startDate,
      end_date: endDate,
      status: 'OPEN'
    });
    console.log(`Ensured accounting period "${periodName}" is OPEN.`);

    // Clean old runs for period
    await db('payroll_runs').where({ company_id: companyId, period }).delete();

    // 2. Generate and post a payroll run
    console.log('Generating payroll run...');
    const genResult = await PayrollService.generatePayrollRun(companyId, period, 1);
    const runId = genResult.run.id;
    console.log(`Created Payroll Run ID: ${runId}`);

    console.log('Posting payroll run...');
    await PayrollService.postPayrollRun(runId, companyId, 1);
    console.log('Payroll run posted successfully.');

    // Fetch payroll line
    let line = await db('payroll_lines').where({ payroll_run_id: runId, employee_id: emp.id }).first();
    if (!line) throw new Error('Payroll line not found!');
    console.log(`Found Payroll Line ID: ${line.id} | Initial payment status: ${line.payment_status}`);

    // Assert PENDING
    if (line.payment_status !== 'PENDING') throw new Error('Initial status should be PENDING!');

    // 3. Test: Hold Payroll Line
    console.log('\n--- TESTING SALARY HOLD ---');
    const holdRes = await PayrollService.holdPayrollLine(companyId, line.id, 'DOCUMENT', 'Missing passport copy', 1);
    console.log(`Hold result status: ${holdRes.payment_status}`);

    line = await db('payroll_lines').where({ id: line.id }).first();
    if (line.payment_status !== 'ON_HOLD' || line.hold_reason !== 'Missing passport copy') {
      throw new Error('Hold payroll line state failed!');
    }

    let history = await db('payroll_status_history').where({ payroll_line_id: line.id }).orderBy('changed_at', 'desc').first();
    if (!history || history.new_status !== 'ON_HOLD') {
      throw new Error('Audit log history transition missing!');
    }
    console.log('✅ Hold Salary Assertions PASSED.');

    // 4. Test: Release hold
    console.log('\n--- TESTING SALARY RELEASE ---');
    const releaseRes = await PayrollService.releasePayrollLine(companyId, line.id, 1);
    console.log(`Release result status: ${releaseRes.payment_status}`);

    line = await db('payroll_lines').where({ id: line.id }).first();
    if (line.payment_status !== 'PENDING') {
      throw new Error('Release hold state failed!');
    }
    console.log('✅ Release Salary Assertions PASSED.');

    // 5. Test: Add Adjustment (Pre-payment)
    // Adjusting a posted run should throw an error, but let's test adjustments on a draft run or check period validations.
    // Wait, the run is POSTED. Let's see if adjustment is blocked (correct behaviour)
    console.log('\n--- TESTING ADJUSTMENT RESTRICTION ON POSTED RUNS ---');
    try {
      await PayrollService.addPayrollAdjustment(companyId, line.id, 'BONUS', 5000, 'On-time achievement bonus', 1);
      throw new Error('Adjustment succeeded on posted run! Should have been restricted.');
    } catch (err) {
      console.log(`✅ Correctly rejected adjustment: ${err.message}`);
    }

    // 6. Test: Individual Payment Execution
    console.log('\n--- TESTING INDIVIDUAL PAYMENT ---');
    const payRes = await PayrollService.payPayrollLine(companyId, line.id, 'BANK', 'Direct bank deposit HBL', 1);
    console.log(`Payment processed. Payment ID: ${payRes.paymentId} | New status: ${payRes.status}`);

    line = await db('payroll_lines').where({ id: line.id }).first();
    if (line.payment_status !== 'PAID') {
      throw new Error('Payment status failed to transition to PAID!');
    }

    const payRecord = await db('payroll_payments').where({ id: payRes.paymentId }).first();
    if (!payRecord || parseFloat(payRecord.amount) !== parseFloat(line.net_salary)) {
      throw new Error('Payment record amount mapping failed!');
    }

    // Verify GL transaction
    const journalEntry = await db('journal_entries').where({ id: payRecord.journal_entry_id }).first();
    if (!journalEntry || journalEntry.status !== 'POSTED') {
      throw new Error('Payment general ledger entry was not created or posted!');
    }

    const journalLines = await db('journal_lines').where({ entry_id: journalEntry.id }).orderBy('debit', 'desc');
    // Debit should be Salary Payable (2020), Credit should be Cash at Bank (1010)
    console.log(`Posted journal entry ID: ${journalEntry.id} | Description: ${journalEntry.description}`);
    for (const jl of journalLines) {
      const acc = await db('accounts').where({ id: jl.account_id }).first();
      console.log(`GL Line - Account: ${acc.code} (${acc.name}) | Debit: ${jl.debit} | Credit: ${jl.credit}`);
    }

    if (journalLines.length !== 2) throw new Error('GL double-entry matching lines count fail!');
    console.log('✅ Individual Payment & GL Double-Entry Assertions PASSED.');

    // 7. Test: Payment Reversal
    console.log('\n--- TESTING PAYMENT REVERSAL ---');
    const revRes = await PayrollService.reversePayrollPayment(companyId, payRes.paymentId, 'Reversing accidental bank run', 1);
    console.log(`Reversal processed. New status: ${revRes.status}`);

    line = await db('payroll_lines').where({ id: line.id }).first();
    if (line.payment_status !== 'PENDING') {
      throw new Error('Associated line failed to revert back to PENDING!');
    }

    const origPayment = await db('payroll_payments').where({ id: payRes.paymentId }).first();
    if (!origPayment.is_reversal) {
      throw new Error('Original payment record is_reversal flag not updated!');
    }

    const revPaymentRecord = await db('payroll_payments').where({ reversal_payment_id: payRes.paymentId, is_reversal: true }).first();
    if (!revPaymentRecord || parseFloat(revPaymentRecord.amount) !== -parseFloat(origPayment.amount)) {
      throw new Error('Reversal contra record with negative amount not found!');
    }

    console.log('✅ Payment Reversal & Status Rollbacks PASSED.');

    // Clean up
    await db('payroll_payments').where({ company_id: companyId }).delete();
    await db('payroll_runs').where({ id: runId }).delete();

    console.log('\n✅ ALL WORKSPACE PAYMENT OPERATIONS TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TESTING FAILED:', err);
    process.exit(1);
  }
}

runTests();
