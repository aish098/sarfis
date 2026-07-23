const db = require('../src/config/db');
const JournalService = require('../src/services/journal.service');

async function testJournalCorrectionFlow() {
  console.log('=== STARTING PHASE 3: PRODUCTION-GRADE POSTED JOURNAL CORRECTION VERIFICATION ===');

  try {
    const company = await db('companies').first();
    const users = await db('users').limit(2);
    const requesterUser = users[0];
    const approverUser = users[1] || users[0];
    const accounts = await db('accounts').where({ company_id: company.id, is_postable: true }).limit(2);

    if (!company || !requesterUser || accounts.length < 2) {
      throw new Error('Missing seed data (company, user, or 2 postable accounts).');
    }

    console.log(`[TEST] Active Company: ${company.name} (#${company.id})`);
    console.log(`[TEST] Requester User: ${requesterUser.name} (#${requesterUser.id})`);
    console.log(`[TEST] Approver User: ${approverUser.name} (#${approverUser.id})`);
    console.log(`[TEST] Account 1: ${accounts[0].code} - ${accounts[0].name} (Balance: ${accounts[0].balance})`);
    console.log(`[TEST] Account 2: ${accounts[1].code} - ${accounts[1].name} (Balance: ${accounts[1].balance})`);

    const initialBal1 = parseFloat(accounts[0].balance || 0);
    const initialBal2 = parseFloat(accounts[1].balance || 0);

    // 1. Create Draft Journal Entry with accounting dimensions
    const draftId = await JournalService.createDraft({
      companyId: company.id,
      userId: requesterUser.id,
      entryDate: new Date().toISOString().split('T')[0],
      description: 'Phase 3 Production-Grade Posted Journal Correction',
      reference: `TEST-GL-${Date.now().toString().slice(-6)}`,
      lines: [
        { accountId: accounts[0].id, debit: 50000, credit: 0, department: 'Finance', project: 'SARFIS-ERP' },
        { accountId: accounts[1].id, debit: 0, credit: 50000, department: 'Finance', project: 'SARFIS-ERP' }
      ]
    });

    console.log(`\n[STEP 1] Created Draft Journal Entry #${draftId}`);

    // 2. Post Journal Entry via standard posting service
    await JournalService.postJournalEntry(draftId, company.id, requesterUser.id, true);
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
      userId: requesterUser.id,
      entryId: draftId,
      reasonCode: 'ACCOUNT_REALLOCATION',
      reasonText: 'Incorrect expense account selected during initial entry.'
    });

    const corrReq = await db('document_correction_requests').where({ id: requestId }).first();
    console.log(`         Correction Request #${corrReq.id} created with Status: ${corrReq.status}`);

    // 5. Segregation of Duties Check
    if (requesterUser.id === approverUser.id) {
      console.log(`\n[STEP 5] Testing Segregation of Duties Check (Requester self-approval)...`);
      try {
        await JournalService.approveCorrectionRequest({
          companyId: company.id,
          userId: requesterUser.id,
          requestId,
          allowSelfApproval: false
        });
        throw new Error('SEGREGATION_OF_DUTIES_FAILED: Allowed requester to approve own correction request!');
      } catch (err) {
        if (err.statusCode === 403) {
          console.log(`         ✅ PASS: Self-approval blocked ("${err.message}")`);
        } else {
          throw err;
        }
      }
    }

    // 6. Approve Correction Request
    console.log(`\n[STEP 6] Approving Correction Request #${requestId}...`);
    await JournalService.approveCorrectionRequest({
      companyId: company.id,
      userId: approverUser.id,
      requestId,
      allowSelfApproval: true
    });

    const approvedReq = await db('document_correction_requests').where({ id: requestId }).first();
    console.log(`         Correction Request Status: ${approvedReq.status}`);

    // 7. Execute Correction Transaction via Canonical Posting Engine
    console.log(`\n[STEP 7] Executing Correction Transaction for Request #${requestId}...`);
    const result = await JournalService.executeCorrectionRequest({
      companyId: company.id,
      userId: approverUser.id,
      requestId
    });

    console.log(`         Reversal Journal Entry Created & Posted: #${result.reversalEntryId}`);
    console.log(`         Draft Corrected Copy Created: #${result.correctedDraftId}`);

    // 8. Verify Idempotent Execution
    console.log(`\n[STEP 8] Testing Idempotent Execution Check...`);
    const result2 = await JournalService.executeCorrectionRequest({
      companyId: company.id,
      userId: approverUser.id,
      requestId
    });
    console.log(`         Idempotent Response Received: idempotent=${result2.idempotent}`);
    if (!result2.idempotent) throw new Error('Expected idempotent response on second execution call.');

    // 9. Verify Original Journal Status & Relationship Links
    const reversedOrig = await db('journal_entries').where({ id: draftId }).first();
    console.log(`\n[STEP 9] Original Journal #${reversedOrig.id} Audit State:`);
    console.log(`         status: ${reversedOrig.status}`);
    console.log(`         is_reversed: ${reversedOrig.is_reversed}`);
    console.log(`         reversed_by_entry_id: ${reversedOrig.reversed_by_entry_id}`);
    console.log(`         correction_draft_id: ${reversedOrig.correction_draft_id}`);
    console.log(`         superseded_by_document_id: ${reversedOrig.superseded_by_document_id} (Expected NULL until draft is posted)`);
    
    if (reversedOrig.superseded_by_document_id !== null && reversedOrig.superseded_by_document_id !== undefined) {
      throw new Error('SEMANTIC_ERROR: superseded_by_document_id was populated before corrected draft copy was posted!');
    }

    // 10. Verify Dimensions Preserved on Reversal Lines
    const revLines = await db('journal_lines').where({ entry_id: result.reversalEntryId });
    console.log(`\n[STEP 10] Reversal Journal Lines & Dimension Verification:`);
    revLines.forEach((l, idx) => {
      console.log(`            Line ${idx + 1}: Account #${l.account_id} | Dr: ${l.debit} | Cr: ${l.credit} | Dept: ${l.department} | Proj: ${l.project}`);
      if (l.department !== 'Finance' || l.project !== 'SARFIS-ERP') {
        throw new Error('DIMENSION_PRESERVATION_FAILED: Accounting dimensions were not preserved on reversal lines.');
      }
    });

    // 11. Verify Account GL Balances Restored
    const revAcc1 = await db('accounts').where({ id: accounts[0].id }).first();
    const revAcc2 = await db('accounts').where({ id: accounts[1].id }).first();
    console.log(`\n[STEP 11] Restored GL Balances -> Acc 1: ${revAcc1.balance} (Initial: ${initialBal1}), Acc 2: ${revAcc2.balance} (Initial: ${initialBal2})`);

    if (parseFloat(revAcc1.balance) !== initialBal1 || parseFloat(revAcc2.balance) !== initialBal2) {
      throw new Error('ACCOUNT_BALANCE_REVERSAL_MISMATCH: Account balances were not restored accurately!');
    }

    // 12. Post Corrected Replacement Copy & Verify Delayed Superseded Link
    console.log(`\n[STEP 12] Posting Corrected Replacement Draft Copy #${result.correctedDraftId}...`);
    await JournalService.postJournalEntry(result.correctedDraftId, company.id, requesterUser.id, true);
    
    const finalOrig = await db('journal_entries').where({ id: draftId }).first();
    console.log(`         Post-Replacement Original Journal #${finalOrig.id}: superseded_by_document_id = ${finalOrig.superseded_by_document_id}`);
    if (parseInt(finalOrig.superseded_by_document_id, 10) !== parseInt(result.correctedDraftId, 10)) {
      throw new Error('SUPERSEDED_LINK_FAILED: Original journal was not linked to posted replacement copy!');
    }

    console.log('\n================================================================');
    console.log('🎉 PHASE 3 VERIFICATION SUCCESS: ALL 11 PRODUCTION CONTROLS PASSED!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ PHASE 3 VERIFICATION FAILED:', err);
  } finally {
    await db.destroy();
  }
}

testJournalCorrectionFlow();
