require('dotenv').config();
const db = require('./config/db');
const SubledgerService = require('./services/subledger.service');

async function run() {
  console.log('--- STARTING SUBLEDGER BACKEND SERVICE VALIDATION ---');
  const COMPANY_ID = 11; // Standard seeded demo company ID

  try {
    // 1. Receivables subledger
    console.log('\n[1] Testing Receivables Subledger...');
    const arList = await SubledgerService.getReceivablesSubledger(COMPANY_ID);
    console.log(`Successfully fetched ${arList.length} customers.`);
    if (arList.length > 0) {
      console.log('Sample Customer Row:', arList[0]);
    }

    // 2. Payables subledger
    console.log('\n[2] Testing Payables Subledger...');
    const apList = await SubledgerService.getPayablesSubledger(COMPANY_ID);
    console.log(`Successfully fetched ${apList.length} suppliers.`);
    if (apList.length > 0) {
      console.log('Sample Supplier Row:', apList[0]);
    }

    // 3. Receivables & Payables Aging
    console.log('\n[3] Testing Receivables Aging...');
    const arAging = await SubledgerService.getAgingAnalysis(COMPANY_ID, 'receivables');
    console.log('AR Aging buckets:', arAging);

    console.log('\nTesting Payables Aging...');
    const apAging = await SubledgerService.getAgingAnalysis(COMPANY_ID, 'payables');
    console.log('AP Aging buckets:', apAging);

    // 4. Statements
    if (arList.length > 0) {
      console.log(`\n[4] Testing Customer Statement for ${arList[0].name} (ID: ${arList[0].id})...`);
      const arStatement = await SubledgerService.getCustomerStatement(COMPANY_ID, arList[0].id);
      console.log(`Statement items count: ${arStatement.statement.length}`);
      console.log(`Current Balance: ${arStatement.currentBalance}`);
    }

    if (apList.length > 0) {
      console.log(`\nTesting Supplier Statement for ${apList[0].name} (ID: ${apList[0].id})...`);
      const apStatement = await SubledgerService.getVendorStatement(COMPANY_ID, apList[0].id);
      console.log(`Statement items count: ${apStatement.statement.length}`);
      console.log(`Current Balance: ${apStatement.currentBalance}`);
    }

    // 5. Summary KPIs
    console.log('\n[5] Testing Subledger Dashboard Summary KPIs...');
    const summary = await SubledgerService.getSubledgerSummary(COMPANY_ID);
    console.log('KPI Summary:', summary);

    console.log('\n✔ ✔ ✔ ALL SUBLEDGER SERVICE METHODS WORKING PERFECTLY! ✔ ✔ ✔');
  } catch (err) {
    console.error('Subledger validation failed with error:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();
