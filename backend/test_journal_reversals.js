require('dotenv').config();
const db = require('./src/config/db');
const JournalService = require('./src/services/journal.service');
const JournalPostingService = require('./src/services/journal_posting.service');
const JournalValidationService = require('./src/services/journal_validation.service');

async function runTests() {
  console.log("---------------------------------------------------------");
  console.log("RUNNING JOURNAL POSTING & REVERSAL SUB-SYSTEM TESTS...");
  console.log("---------------------------------------------------------");

  const companyId = 9; // Local test company
  const userId = 9;

  let testHeaderAccId = null;
  let testPeriodId = null;
  let postedEntryId = null;
  let reversalEntryId = null;

  try {
    // 1. Fetch postable accounts
    const accounts = await db('accounts')
      .where({ company_id: companyId, is_postable: true })
      .limit(2);
    
    if (accounts.length < 2) {
      throw new Error("Test requires at least two postable accounts in Company 9.");
    }
    const [acc1, acc2] = accounts;
    console.log(`[SETUP] Using postable accounts: ${acc1.name} (${acc1.code}) and ${acc2.name} (${acc2.code})`);

    // 2. Fetch or create an OPEN period
    let openPeriod = await db('accounting_periods')
      .where({ company_id: companyId, status: 'OPEN' })
      .first();

    if (!openPeriod) {
      console.log("[SETUP] No open period found. Creating test open period...");
      const [newPeriod] = await db('accounting_periods')
        .insert({
          company_id: companyId,
          period_name: '2026-07',
          start_date: '2026-07-01',
          end_date: '2026-07-31',
          status: 'OPEN'
        })
        .returning('id');
      testPeriodId = typeof newPeriod === 'object' ? newPeriod.id : newPeriod;
      openPeriod = await db('accounting_periods').where({ id: testPeriodId }).first();
    }
    console.log(`[SETUP] Using open period: ${openPeriod.period_name}`);

    // Parse a date that is guaranteed to fall inside the open period
    const testDate = new Date(openPeriod.start_date);
    testDate.setDate(testDate.getDate() + 5); // Add 5 days to be safe
    const testDateStr = testDate.toISOString().split('T')[0];
    console.log(`[SETUP] Using test transaction date: ${testDateStr}`);

    // 3. Create a non-postable summary account for validation testing
    console.log("[TEST] Creating non-postable summary account...");
    const [headerAcc] = await db('accounts')
      .insert({
        company_id: companyId,
        code: 'HDR99',
        name: 'Summary Asset Header',
        category: 'Asset',
        normal_balance: 'Debit',
        balance: 0,
        is_postable: false
      })
      .returning('id');
    testHeaderAccId = typeof headerAcc === 'object' ? headerAcc.id : headerAcc;
    console.log("✅ Created summary account ID:", testHeaderAccId);

    // 4. Test Validation: Closed Period
    console.log("\n[TEST] Verifying Closed Period validation...");
    try {
      await JournalValidationService.validatePeriod(companyId, '2026-01-01', db);
      throw new Error("FAIL: Validation should have rejected closed/missing period.");
    } catch (err) {
      console.log("✅ Validation successfully caught closed period:", err.message);
    }

    // 5. Test Validation: Non-Postable Account
    console.log("\n[TEST] Verifying Non-Postable account validation...");
    try {
      await JournalValidationService.validateAccounts(companyId, [
        { accountId: testHeaderAccId, debit: 1000, credit: 0 },
        { accountId: acc2.id, debit: 0, credit: 1000 }
      ], db);
      throw new Error("FAIL: Validation should have rejected posting to summary account.");
    } catch (err) {
      console.log("✅ Validation successfully caught summary account:", err.message);
    }

    // 6. Test Validation: Uneven Journal Balance
    console.log("\n[TEST] Verifying Uneven balance validation...");
    try {
      JournalValidationService.validateBalance([
        { accountId: acc1.id, debit: 1000, credit: 0 },
        { accountId: acc2.id, debit: 0, credit: 900 }
      ]);
      throw new Error("FAIL: Validation should have rejected uneven debits & credits.");
    } catch (err) {
      console.log("✅ Validation successfully caught uneven balance:", err.message);
    }

    // 7. Draft and Post a Journal Entry successfully
    console.log("\n[TEST] Posting valid manual journal entry...");
    const refCode = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
    
    // Create draft first
    const draftId = await JournalService.createDraft({
      companyId,
      userId,
      entryDate: testDateStr,
      description: 'Integration Test Entry',
      reference: refCode,
      lines: [
        { accountId: acc1.id, debit: 5000, credit: 0 },
        { accountId: acc2.id, debit: 0, credit: 5000 }
      ]
    });
    console.log("✅ Draft created with ID:", draftId);

    // Post draft
    const postSuccess = await JournalService.postJournalEntry(draftId, companyId, userId);
    console.log("✅ Draft posted to general ledger:", postSuccess);
    postedEntryId = draftId;

    // Verify journal_posting_logs
    const postLog = await db('journal_posting_logs')
      .where({ journal_entry_id: draftId, status: 'POSTED' })
      .first();
    
    if (!postLog) {
      throw new Error("FAIL: No POSTED log found in journal_posting_logs.");
    }
    console.log("✅ posting logs correctly written. Duration:", postLog.duration_ms, "ms");

    // Test duplicate reference check
    console.log("\n[TEST] Verifying duplicate reference validation...");
    try {
      await JournalValidationService.validateReference(companyId, refCode, db);
      throw new Error("FAIL: Validation should have caught duplicate reference.");
    } catch (err) {
      console.log("✅ Validation successfully caught duplicate reference:", err.message);
    }

    // 8. Reversal Flow
    console.log("\n[TEST] Reversing posted journal entry...");
    await JournalPostingService.reverse(postedEntryId, companyId, userId, "Incorrect amount recorded");
    console.log("✅ Reversal method finished.");

    // Fetch updated original entry to assert status is REVERSED and linked
    const originalEntry = await db('journal_entries').where({ id: postedEntryId }).first();
    console.log(`Original Entry status: ${originalEntry.status}, reversed_by_id: ${originalEntry.reversed_by_id}`);
    
    if (originalEntry.status !== 'REVERSED') {
      throw new Error(`Original Entry expected REVERSED status, got: ${originalEntry.status}`);
    }
    if (!originalEntry.reversed_by_id) {
      throw new Error("Original Entry should link to reversed_by_id.");
    }
    reversalEntryId = originalEntry.reversed_by_id;

    // Fetch reversal entry
    const reversalEntry = await db('journal_entries').where({ id: reversalEntryId }).first();
    console.log(`Reversal Entry status: ${reversalEntry.status}, reversal_of_id: ${reversalEntry.reversal_of_id}, reason: ${reversalEntry.reversal_reason}`);
    
    if (reversalEntry.status !== 'POSTED') {
      throw new Error(`Reversal Entry expected POSTED status, got: ${reversalEntry.status}`);
    }
    if (reversalEntry.reversal_of_id !== postedEntryId) {
      throw new Error("Reversal Entry does not point back to reversal_of_id.");
    }

    // Verify reversal lines are inverted
    const originalLines = await db('journal_lines').where({ entry_id: postedEntryId }).orderBy('id');
    const reversedLines = await db('journal_lines').where({ entry_id: reversalEntryId }).orderBy('id');

    console.log("Original lines:", originalLines.map(l => ({ acc: l.account_id, dr: l.debit, cr: l.credit })));
    console.log("Reversal lines:", reversedLines.map(l => ({ acc: l.account_id, dr: l.debit, cr: l.credit })));

    const l1 = originalLines[0];
    const r1 = reversedLines.find(l => l.account_id === l1.account_id);
    if (parseFloat(r1.credit) !== parseFloat(l1.debit)) {
      throw new Error(`Reversal line credits (${r1.credit}) do not balance original line debits (${l1.debit}).`);
    }

    // Verify reversal log
    const revLog = await db('journal_posting_logs')
      .where({ journal_entry_id: reversalEntryId, status: 'REVERSED' })
      .first();
    if (!revLog) {
      throw new Error("FAIL: No REVERSED log found in journal_posting_logs.");
    }
    console.log("✅ Reversal audit log recorded successfully.");

    console.log("\n---------------------------------------------------------");
    console.log("ALL SUB-SYSTEM TESTS PASSED SUCCESSFULLY! ✅");
    console.log("---------------------------------------------------------");
    cleanupAndExit(0);

  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(error);
    cleanupAndExit(1);
  }

  async function cleanupAndExit(code) {
    console.log("\n[CLEANUP] Cleaning up test data...");
    try {
      if (reversalEntryId) {
        await db('journal_lines').where({ entry_id: reversalEntryId }).del();
        await db('journal_entries').where({ id: reversalEntryId }).del();
      }
      if (postedEntryId) {
        await db('journal_lines').where({ entry_id: postedEntryId }).del();
        await db('journal_entries').where({ id: postedEntryId }).del();
      }
      if (testHeaderAccId) {
        await db('accounts').where({ id: testHeaderAccId }).del();
      }
      if (testPeriodId) {
        await db('accounting_periods').where({ id: testPeriodId }).del();
      }
      await db('journal_posting_logs').where({ company_id: companyId }).del();
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    process.exit(code);
  }
}

runTests();
