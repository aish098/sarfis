const db = require('./src/config/db');
const TransactionInquiryService = require('./src/services/transaction_inquiry.service');

async function run() {
  console.log('---------------------------------------------------------');
  console.log('RUNNING TRANSACTION INQUIRY SERVICE TESTS...');
  console.log('---------------------------------------------------------');

  try {
    // Fetch a company
    const company = await db('companies').first();
    if (!company) {
      console.log('No company found to test. Exiting.');
      process.exit(0);
    }
    console.log(`[TESTS] Using Company: "${company.name}" (ID: ${company.id})`);

    // Fetch a posted or draft voucher
    const voucher = await db('vouchers').where('company_id', company.id).first();
    if (!voucher) {
      console.log('No voucher found to test. Exiting.');
      process.exit(0);
    }
    console.log(`[TESTS] Testing with Voucher ID: ${voucher.id}, Number: ${voucher.voucher_number}, Type: ${voucher.type}`);

    // Call service
    const details = await TransactionInquiryService.getTransactionInquiryDetails(voucher.id, company.id);

    // Assert DTO structure
    const keys = ['document', 'financial', 'inventory', 'business', 'risk', 'audit', 'comments', 'relatedDocuments', 'attachments'];
    for (const key of keys) {
      if (!(key in details)) {
        throw new Error(`Missing expected DTO section: ${key}`);
      }
    }
    console.log('✅ PASS: Basic DTO structure validated.');

    // Assert document details
    if (details.document.voucherNumber !== voucher.voucher_number) {
      throw new Error(`Voucher number mismatch: ${details.document.voucherNumber} !== ${voucher.voucher_number}`);
    }
    console.log('✅ PASS: Voucher document details matching.');

    // Assert invalid voucher request throws
    try {
      await TransactionInquiryService.getTransactionInquiryDetails(999999, company.id);
      throw new Error('Should have thrown on invalid voucher ID');
    } catch (err) {
      if (err.message !== 'Voucher not found') {
        throw err;
      }
      console.log('✅ PASS: Correctly threw error for missing voucher.');
    }

    console.log('---------------------------------------------------------');
    console.log('🎉 ALL TRANSACTION INQUIRY TESTS PASSED! 🎉');
    console.log('---------------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

run();
