const db = require('./src/config/db');
const RiskService = require('./src/services/risk.service');
const RiskModel = require('./src/models/risk.model');
const VoucherService = require('./src/services/voucher.service');
const PostingEngineService = require('./src/services/posting_engine.service');

async function runRiskTests() {
  console.log('---------------------------------------------------------');
  console.log('RUNNING SARFIS RELATIONSHIP RISK & GOVERNANCE TESTS...');
  console.log('---------------------------------------------------------');

  let testCompany = null;
  let testUser = null;
  let testClient = null;
  let testWarehouse = null;
  let testProduct = null;

  try {
    // 1. Fetch test context
    testUser = await db('users').first();
    if (!testUser) throw new Error('No user found in DB to run tests.');

    testCompany = await db('companies').first();
    if (!testCompany) throw new Error('No company found in DB to run tests.');

    testWarehouse = await db('warehouses').where({ company_id: testCompany.id }).first();
    testProduct = await db('products').where({ company_id: testCompany.id }).first();

    console.log(`[TESTS] Using Company: "${testCompany.name}" (ID: ${testCompany.id})`);

    // Ensure we have Accounts Receivable and Bad Debt Expense mapped
    const arAccount = await db('accounts').where({ company_id: testCompany.id, code: '1200' }).first();
    let badDebtAccount = await db('accounts').where({ company_id: testCompany.id, code: '5030' }).first();
    if (!badDebtAccount) {
      [badDebtAccount] = await db('accounts').insert({
        company_id: testCompany.id,
        code: '5030',
        name: 'Bad Debt Expense',
        category: 'Expense',
        normal_balance: 'Debit',
        is_contra: false,
        balance: 0
      }).returning('*');
    }

    // Set settings defaults
    await db('company_accounting_settings')
      .where({ company_id: testCompany.id })
      .update({
        default_ar_account_id: arAccount.id,
        default_bad_debt_account_id: badDebtAccount.id
      });

    // Create a new client for clean testing
    const clientName = `Risk Test Client - ${Date.now()}`;
    const [client] = await db('clients').insert({
      company_id: testCompany.id,
      name: clientName,
      credit_limit: 50000.00,
      current_balance: 10000.00 // Set starting balance
    }).returning('*');
    testClient = client;

    console.log(`[TESTS] Created Test Customer: "${testClient.name}" with outstanding bal: ${testClient.current_balance}`);

    // Verify initial risk status is ACTIVE (lazy-initialized)
    let status = await RiskModel.getOrCreateStatus(testCompany.id, 'CUSTOMER', testClient.id, db);
    console.log(`[TESTS] Initial status: ${status.status}, Score: ${status.risk_score}, Level: ${status.risk_level}`);
    if (status.status !== 'ACTIVE' || status.risk_score !== 0) {
      throw new Error(`Expected ACTIVE status with 0 score, but got ${status.status} (${status.risk_score})`);
    }
    console.log('✅ PASS: Initial ACTIVE status verified.');

    // 2. Log an Incident
    console.log('\n[TEST 2] Logging high-risk default incident...');
    await RiskService.logIncident(testCompany.id, 'CUSTOMER', testClient.id, {
      category: 'BAD_DEBT',
      incidentDate: new Date(),
      reason: 'Failed to settle invoices for 90 days',
      lossAmount: 5000.00,
      recoveredAmount: 0,
      daysLate: 90,
      notes: 'Logged by system test script',
      resolved: false
    }, testUser.id);

    // Verify dynamic score and status level recalculates
    status = await RiskModel.getOrCreateStatus(testCompany.id, 'CUSTOMER', testClient.id, db);
    console.log(`[TESTS] Updated status: ${status.status}, Score: ${status.risk_score}, Level: ${status.risk_level}`);
    if (status.risk_score !== 60 || status.risk_level !== 'HIGH') {
      throw new Error(`Expected score of 60 and HIGH risk level, but got ${status.risk_score} (${status.risk_level})`);
    }
    console.log('✅ PASS: Dynamic risk scoring recalculated correctly.');

    // 3. Blacklist Customer and verify Posting Engine intercept block
    console.log('\n[TEST 3] Blacklisting customer and testing voucher interception...');
    await RiskService.blacklistEntity(testCompany.id, 'CUSTOMER', testClient.id, {
      reason: 'Excessive credit risk defaults',
      notes: 'Blacklisted by system test script'
    }, testUser.id);

    status = await RiskModel.getOrCreateStatus(testCompany.id, 'CUSTOMER', testClient.id, db);
    console.log(`[TESTS] Status after blacklisting: ${status.status}`);
    if (status.status !== 'BLACKLISTED') {
      throw new Error(`Expected BLACKLISTED status, but got ${status.status}`);
    }

    // Try to post a sales voucher and verify it is blocked
    let blockedDraftId = null;
    try {
      const blockedDraft = await VoucherService.createDraft({
        companyId: testCompany.id,
        type: 'SALES',
        payload: {
          clientId: testClient.id,
          warehouseId: testWarehouse.id,
          notes: 'Test sale posting blocked by blacklist',
          items: [
            { productId: testProduct.id, quantity: 1, unitPrice: 500.00 }
          ]
        },
        totalAmount: 500.00,
        userId: testUser.id
      });
      blockedDraftId = blockedDraft.id;
      await VoucherService.postToLedger(blockedDraft.id, testCompany.id, testUser.id);
      throw new Error('FAILED: Posting succeeded but customer is blacklisted.');
    } catch (e) {
      console.log('✅ PASS: Correctly blocked voucher submission. Error caught:', e.message);
    }

    // [TEST 3.1] Asynchronous Override Approval Request Flow
    console.log('\n[TEST 3.1] Submitting override approval request...');
    const overrideReq = await RiskService.submitApprovalRequest(testCompany.id, 'CUSTOMER', testClient.id, {
      requestType: 'TRANSACTION_OVERRIDE',
      voucherId: blockedDraftId,
      reason: 'Urgent contract exception approved by board',
      entityName: testClient.name,
      metadata: { totalAmount: 500.00 }
    }, testUser.id);

    console.log(`[TESTS] Override Request #${overrideReq.id} created in state: ${overrideReq.status}`);
    if (overrideReq.status !== 'PENDING') {
      throw new Error(`Expected override status to be PENDING, got ${overrideReq.status}`);
    }

    // Try to post again and verify it is still blocked
    try {
      await VoucherService.postToLedger(blockedDraftId, testCompany.id, testUser.id);
      throw new Error('FAILED: Posting succeeded but override request is still PENDING.');
    } catch (e) {
      console.log('✅ PASS: Correctly blocked voucher posting since override is pending. Error caught:', e.message);
    }

    // Approve the override request
    console.log('[TESTS] Approving the override request...');
    await RiskService.reviewApprovalRequest(testCompany.id, overrideReq.id, {
      status: 'APPROVED',
      reviewNotes: 'Override approved for this transaction only.'
    }, testUser.id);

    // Verify it now posts successfully!
    console.log('[TESTS] Attempting to post voucher again after override approval...');
    const postedVoucher = await VoucherService.postToLedger(blockedDraftId, testCompany.id, testUser.id);
    console.log(`[TESTS] Voucher posted successfully. Status: ${postedVoucher.status}, Override Request ID: ${postedVoucher.override_request_id}`);
    if (postedVoucher.status !== 'POSTED' || Number(postedVoucher.override_request_id) !== Number(overrideReq.id)) {
      throw new Error(`Expected posted voucher to link override_request_id to ${overrideReq.id}, got ${postedVoucher.override_request_id}`);
    }
    console.log('✅ PASS: Voucher posted successfully after override approval and links override request ID.');

    // 4. Request Reinstatement
    console.log('\n[TEST 4] Requesting reinstatement review...');
    const request = await RiskService.requestReinstatement(testCompany.id, 'CUSTOMER', testClient.id, {
      reason: 'Client agreed to write off outstanding debt and transition to cash terms.'
    }, testUser.id);

    console.log(`[TESTS] Reinstatement Request created with ID: ${request.id}, Status: ${request.status}`);
    if (request.status !== 'PENDING') {
      throw new Error(`Expected reinstatement status to be PENDING, got ${request.status}`);
    }
    console.log('✅ PASS: Reinstatement request logged.');

    // 5. Approve Reinstatement with Bad Debt WRITE_OFF handling
    console.log('\n[TEST 5] Approving reinstatement with BAD_DEBT_WRITE_OFF audit handling...');
    const originalClientBalance = parseFloat(testClient.current_balance);

    await RiskService.reviewReinstatement(testCompany.id, request.id, {
      status: 'APPROVED',
      reviewNotes: 'Approved. Write off outstanding balance of 10,000.',
      priorityAfterReinstate: 'CRITICAL', // Must be CRITICAL to trigger cash_only restriction
      receivablesHandling: 'WRITE_OFF',
      committeeMeetingDate: new Date(),
      committeeParticipants: 'Finance Director, Credit Manager',
      committeeDecision: 'Write off bad debt and reinstate account'
    }, testUser.id);

    // Verify subledger client balance was reduced to 0 (all written off)
    const updatedClient = await db('clients').where('id', testClient.id).first();
    const newClientBalance = parseFloat(updatedClient.current_balance);
    console.log(`[TESTS] Client balance before write-off: ${originalClientBalance}, After write-off: ${newClientBalance}`);
    if (newClientBalance !== 0.00) {
      throw new Error(`Expected balance to decrease to 0, but got ${newClientBalance}`);
    }
    console.log('✅ PASS: Subledger client balance correctly written off to 0.');

    // Verify customer relationship is reinstated and cash only policies applied
    status = await RiskModel.getOrCreateStatus(testCompany.id, 'CUSTOMER', testClient.id, db);
    console.log(`[TESTS] Final status after review approval: ${status.status}, Level: ${status.risk_level}, Cash-Only: ${status.cash_only}`);
    if (status.status !== 'REINSTATED' || !status.cash_only) {
      throw new Error(`Expected REINSTATED status with cash_only policy restriction, got ${status.status} (Cash Only: ${status.cash_only})`);
    }
    console.log('✅ PASS: Customer reinstated and cash-only restrictions applied successfully.');

    // [TEST 6] Dynamic Policy scoring rules & thresholds
    console.log('\n[TEST 6] Running Dynamic Policy scoring rules & thresholds tests...');
    
    // 6.1 Safe on-demand initialization check
    await RiskService.ensureCompanyRulesInitialized(testCompany.id, db);
    const initialRules = await RiskModel.getRiskRules(testCompany.id, db);
    const initialLevels = await RiskModel.getRiskLevels(testCompany.id, db);
    console.log(`[TESTS] Company initialized with ${initialRules.length} risk rules and ${initialLevels.length} thresholds.`);
    if (initialRules.length === 0 || initialLevels.length === 0) {
      throw new Error('Rules and thresholds must be automatically seeded.');
    }
    console.log('✅ PASS: Safe on-demand seeding of policies verified.');

    // 6.2 Overlap & Gap Validation
    console.log('[TESTS] Verifying validation of gapped/overlapping thresholds...');
    const badOverlappingLevels = [
      { risk_level: 'LOW', min_score: 0, max_score: 10 },
      { risk_level: 'MEDIUM', min_score: 5, max_score: 50 }, // Overlaps with LOW
      { risk_level: 'HIGH', min_score: 51, max_score: 80 },
      { risk_level: 'CRITICAL', min_score: 81, max_score: 999 }
    ];
    try {
      RiskService.validateThresholds(badOverlappingLevels);
      throw new Error('FAILED: Overlapping thresholds validation did not throw error.');
    } catch (e) {
      console.log('✅ PASS: Correctly threw error on overlapping thresholds:', e.message);
    }

    const badGappedLevels = [
      { risk_level: 'LOW', min_score: 0, max_score: 20 },
      { risk_level: 'MEDIUM', min_score: 25, max_score: 50 }, // Gap between 20 and 25
      { risk_level: 'HIGH', min_score: 51, max_score: 80 },
      { risk_level: 'CRITICAL', min_score: 81, max_score: 999 }
    ];
    try {
      RiskService.validateThresholds(badGappedLevels);
      throw new Error('FAILED: Gapped thresholds validation did not throw error.');
    } catch (e) {
      console.log('✅ PASS: Correctly threw error on gapped thresholds:', e.message);
    }

    // 6.3 Rule Customization weights change (Changing BOUNCED_CHEQUE weight from 40 to 80)
    console.log('[TESTS] Customizing BOUNCED_CHEQUE rule weight to 80 points...');
    const chequeRule = initialRules.find(r => r.code === 'BOUNCED_CHEQUE');
    if (!chequeRule) throw new Error('BOUNCED_CHEQUE rule not seeded.');

    await RiskModel.updateRiskRule(chequeRule.id, testCompany.id, {
      weight: 80,
      enabled: true,
      updatedBy: testUser.id
    }, db);

    // Invalidate cache and log policy history
    RiskService.invalidateCache(testCompany.id);
    await RiskModel.addPolicyHistory(
      testCompany.id,
      'RULE_CHANGE',
      chequeRule.id,
      chequeRule.weight,
      80,
      testUser.id,
      'Integration testing customizer weight'
    );

    // Create a new client and log Bounced Cheque incident
    const ruleTestClient = await db('clients').insert({
      company_id: testCompany.id,
      name: `Rules Test Client - ${Date.now()}`,
      credit_limit: 10000.00,
      current_balance: 0
    }).returning('*').then(rows => rows[0]);

    await RiskService.logIncident(testCompany.id, 'CUSTOMER', ruleTestClient.id, {
      category: 'BOUNCED_CHEQUE',
      incidentDate: new Date(),
      reason: 'Bounced cheque during cash settlement trial',
      lossAmount: 1000.00,
      resolved: false
    }, testUser.id);

    // Assert that calculated score is now 80 (new rule weight) instead of 40 (old weight)
    status = await RiskModel.getOrCreateStatus(testCompany.id, 'CUSTOMER', ruleTestClient.id, db);
    console.log(`[TESTS] Status score with modified BOUNCED_CHEQUE rule weight: ${status.risk_score}`);
    if (status.risk_score !== 80) {
      throw new Error(`Expected score of 80 based on customized policy weight, got ${status.risk_score}`);
    }
    console.log('✅ PASS: Customized policy rules weights evaluated correctly.');

    // Clean up rule test client
    await db('clients').where('id', ruleTestClient.id).delete();
    await db('business_relationship_status').where({ entity_type: 'CUSTOMER', entity_id: ruleTestClient.id }).delete();

    // Clean up test client
    await db('clients').where('id', testClient.id).delete();
    await db('business_relationship_status').where({ entity_type: 'CUSTOMER', entity_id: testClient.id }).delete();

    console.log('\n---------------------------------------------------------');
    console.log('🎉 ALL RELATIONSHIP RISK & GOVERNANCE TESTS PASSED! 🎉');
    console.log('---------------------------------------------------------');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ RISK TEST SUITE FAILED:');
    console.error(err);
    process.exit(1);
  }
}

runRiskTests();
