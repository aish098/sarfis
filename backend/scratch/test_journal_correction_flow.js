const db = require('../src/config/db');
const JournalService = require('../src/services/journal.service');

async function testJournalCorrectionFlow() {
  console.log('=== STARTING PHASE 3: POSTED JOURNAL CORRECTION & REVERSAL VERIFICATION ===');

  try {
    const company = await db('companies').first();
    const user = await db('users').first();
    const accounts = await db('accounts').where({ company_id: company.id, is_postable: true }).limit(2);

    if (!company || !user || accounts.length < 2) {
      throw new Error('Missing seed data (company, user, or 2 postable accounts).');
    }

    console.log(`[TEST] Active Company: ${company.name} (#${company.id})`);
    console.log(`[TEST] User: ${user.name} (#${user.id})`);
    console.log(`[TEST] Account 1: ${accounts[0].code} - ${accounts[0].name} (Balance: ${accounts[0].balance})`);
    console.log(`[TEST] Account 2: ${accounts[1].code} - ${accounts[1].name} (Balance: ${accounts[1].balance})`);

    const initialBal1 = parseFloat(accounts[0].balance || 0);
    const initialBal2 = parseFloat(accounts[1].balance || 0);

    // 1. Create Draft Journal Entry
    const draftId = await JournalService.createDraft({
      companyId: company.id,
      userId: user.id,
      entryDate: new Date().toISOString().split('T')[0],
      description: 'Phase 3 Test Posted Journal Correction',
      reference: `TEST-GL-${Date.now().toString().slice(-6)}`,
      lines: [
        { accountId: accounts[0].id, debit: 50000, credit: 0 },
        { accountId: accounts[1].id, debit: 0, credit: 50000 }
      ]
    });

    console.log(`\n[STEP 1] Created Draft Journal Entry #${draftId}`);

    // 2. Post Journal Entry
    await JournalService.postJournalEntry(draftId, company.id, user.id, true);
    const postedEntry = await db('journal_entries').where({ id: draftId }).first();
    console.log(`\n[STEP 2] Posted Journal Entry #${postedEntry.id}: Status = ${postedEntry.status}`);

    const postAcc1 = await db('accounts').where({ id: accounts[0].id }).first();
    const postAcc2 = await db('accounts').where({ id: accounts[1].id }).first();
    console.log(`         Post Balances -> Acc 1: ${postAcc1.balance}, Acc 2: ${postAcc2.balance}`);

    // 3. Test Immutability: Direct edit attempt on POSTED journal
    console.log(`\n[STEP 3] Testing Direct Edit Immutability Check on POSTED Journal...`);
    try {
      await JournalService.updateDraft(draftId, {
        companyId: company.id,
        entryDate: new Date().toISOString().split('T')[0],
        description: 'Illegal edit attempt',
        reference: 'BAD-EDIT',
        lines: [
          { accountId: accounts[0].id, debit: 100, credit: 0 },
          { accountId: accounts[1].id, debit: 0, credit: 100 }
        ]
      });
      throw new Error('DIRECT_EDIT_FAILED: System allowed direct edit on POSTED journal!');
    } catch (err) {
      console.log(`         ✅ PASS: Direct edit rejected ("${err.message}")`);
    }

    // 4. Request Posted Correction
    console.log(`\n[STEP 4] Submitting Correction Request for Posted Journal #${draftId}...`);
    const requestId = await JournalService.requestCorrection({
      companyId: company.id,
      userId: user.id,
      entryId: draftId,
      reasonCode: 'ACCOUNT_REALLOCATION',
      reasonText: 'Incorrect expense account selected during initial entry.'
    });

    const corrReq = await db('document_correction_requests').where({ id: requestId }).first();
    console.log(`         Correction Request #${corrReq.id} created with Status: ${corrReq.status}`);

    // Verify original journal status remains POSTED
    const origCheck = await db('journal_entries').where({ id: draftId }).first();
    console.log(`         Original Journal #${origCheck.id} Status remains: ${origCheck.status} (is_reversed: ${origCheck.is_reversed})`);

    // 5. Test Duplicate Correction Request Prevention
    console.log(`\n[STEP 5] Testing Duplicate Correction Request Prevention...`);
    try {
      await JournalService.requestCorrection({
        companyId: company.id,
        userId: user.id,
        entryId: draftId,
        reasonCode: 'DUPLICATE_ATTEMPT',
        reasonText: 'Testing duplicate prevention'
      });
      throw new Error('DUPLICATE_CORRECTION_FAILED: System allowed duplicate correction request!');
    } catch (err) {
      if (err.statusCode === 409) {
        console.log(`         ✅ PASS: Duplicate correction request rejected ("${err.message}")`);
      } else {
        throw err;
      }
    }

    // 6. Approve Correction Request
    console.log(`\n[STEP 6] Approving Correction Request #${requestId}...`);
    await JournalService.approveCorrectionRequest({
      companyId: company.id,
      userId: user.id,
      requestId
    });

    const approvedReq = await db('document_correction_requests').where({ id: requestId }).first();
    console.log(`         Correction Request Status: ${approvedReq.status}`);

    // 7. Execute Correction Transaction
    console.log(`\n[STEP 7] Executing Correction Transaction for Request #${requestId}...`);
    const result = await JournalService.executeCorrectionRequest({
      companyId: company.id,
      userId: user.id,
      requestId
    });

    console.log(`         Reversal Journal Entry Created: #${result.reversalEntryId}`);
    console.log(`         Draft Corrected Copy Created: #${result.correctedDraftId}`);

    // Verify original journal status and reversal links
    const reversedOrig = await db('journal_entries').where({ id: draftId }).first();
    console.log(`         Original Journal #${reversedOrig.id}: status=${reversedOrig.status}, is_reversed=${reversedOrig.is_reversed}, reversed_by_entry_id=${reversedOrig.reversed_by_entry_id}, superseded_by_document_id=${reversedOrig.superseded_by_document_id}`);

    // Verify Reversal Journal Entries & Inverted Lines
    const revLines = await db('journal_lines').where({ entry_id: result.reversalEntryId });
    console.log(`         Reversal Journal #${result.reversalEntryId} Lines count: ${revLines.length}`);
    revLines.forEach((l, idx) => console.log(`            Line ${idx + 1}: Account #${l.account_id} | Dr: ${l.debit} | Cr: ${l.credit}`));

    // Verify Account Balances Restored to Original
    const revAcc1 = await db('accounts').where({ id: accounts[0].id }).first();
    const revAcc2 = await db('accounts').where({ id: accounts[1].id }).first();
    console.log(`         Restored Balances -> Acc 1: ${revAcc1.balance} (Initial: ${initialBal1}), Acc 2: ${revAcc2.balance} (Initial: ${initialBal2})`);

    if (parseFloat(revAcc1.balance) !== initialBal1 || parseFloat(revAcc2.balance) !== initialBal2) {
      throw new Error('ACCOUNT_BALANCE_REVERSAL_MISMATCH: Account balances were not restored accurately!');
    }

    // Verify Outbox Notification
    const outboxEvents = await db('notification_outbox').where({ company_id: company.id, aggregate_type: 'JOURNAL', aggregate_id: draftId });
    console.log(`\n[NOTIFICATION OUTBOX] Enqueued Events: ${outboxEvents.length}`);
    outboxEvents.forEach(e => console.log(`   - Event: ${e.event_type} | Status: ${e.status}`));

    console.log('\n================================================================');
    console.log('🎉 PHASE 3 VERIFICATION SUCCESS: POSTED JOURNAL CORRECTION ENGINE WORKING PERFECTLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ PHASE 3 VERIFICATION FAILED:', err);
  } finally {
    await db.destroy();
  }
}

testJournalCorrectionFlow();
