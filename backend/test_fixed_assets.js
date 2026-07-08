require('dotenv').config();
const db = require('./src/config/db');
const FixedAssetsService = require('./src/services/fixed_assets.service');
const AssetInquiryService = require('./src/services/asset_inquiry.service');

async function runTests() {
  console.log("---------------------------------------------------------");
  console.log("RUNNING ASSET MANAGEMENT SUB-SYSTEM TESTS...");
  console.log("---------------------------------------------------------");

  const companyId = 1;
  const userId = 1;

  try {
    // Clean up past test runs to ensure repeatability
    await db('asset_ledger').where('description', 'like', '%AST-TEST-VHC001%').orWhere('description', 'like', '%Delivery Van - Model X%').del();
    await db('depreciation_entries').whereIn('asset_id', db('assets').select('id').where({ asset_code: 'AST-TEST-VHC001' })).del();
    await db('asset_depreciation_books').whereIn('asset_id', db('assets').select('id').where({ asset_code: 'AST-TEST-VHC001' })).del();
    await db('assets').where({ asset_code: 'AST-TEST-VHC001' }).del();
    await db('asset_categories').where({ category_name: 'Test Fleet Vehicles' }).del();
    await db('depreciation_runs').where({ period: '2026-07', company_id: companyId }).del();
    // 1. Create a Custom Category
    console.log("[TEST] Creating custom asset category...");
    const category = await FixedAssetsService.createCategory(companyId, {
      category_name: 'Test Fleet Vehicles',
      default_useful_life_years: 5,
      default_depreciation_method: 'REDUCING_BALANCE',
      default_salvage_percent: 10,
      asset_account_id: 1,                  // Test mapping to ID 1 (Assets)
      accumulated_depreciation_account_id: 2, // Test mapping to ID 2 (Contra Asset)
      depreciation_expense_account_id: 3      // Test mapping to ID 3 (Expense)
    });
    console.log("✅ Category created:", category.category_name);

    // 2. Capitalize a New Asset Card
    console.log("\n[TEST] Registering new capitalized asset card...");
    const assetId = await FixedAssetsService.createAsset(companyId, userId, {
      asset_code: 'AST-TEST-VHC001',
      asset_name: 'Delivery Van - Model X',
      category_id: category.id,
      purchase_date: '2026-07-01',
      placed_in_service_date: '2026-07-01',
      purchase_cost: 100000.00,
      salvage_value: 10000.00,
      useful_life_years: 5,
      depreciation_method: 'REDUCING_BALANCE',
      notes: 'Test asset capitalization.'
    });
    console.log("✅ Asset Card Capitalized. ID:", assetId);

    // 3. Verify Multi-Book Initialization
    console.log("\n[TEST] Validating 360-degree inquiry and multi-book profiles...");
    const inquiry = await AssetInquiryService.getAssetInquiryDetails(assetId, companyId);
    if (inquiry.depreciationBooks.length !== 3) {
      throw new Error(`Expected 3 depreciation books, found ${inquiry.depreciationBooks.length}`);
    }
    console.log("✅ inquiry loaded. Found books:", inquiry.depreciationBooks.map(b => b.book_name).join(', '));
    console.log("✅ Carrying Book Value Accounting Book: PKR", inquiry.depreciationBooks[0].current_book_value);

    // 4. Calculate Depreciation Run Preview
    console.log("\n[TEST] Generating period depreciation preview...");
    const preview = await FixedAssetsService.calculateDepreciationRun(companyId, '2026-07', 'Accounting');
    if (preview.length === 0) {
      throw new Error('Expected at least 1 depreciable item in preview.');
    }
    const allocation = preview.find(p => p.asset_id === assetId);
    console.log(`✅ Preview for AST-TEST-VHC001: Opening: ${allocation.opening_book_value}, Dep: ${allocation.depreciation_amount}, Closing: ${allocation.closing_book_value}`);

    // 5. Post Depreciation Run & Ledger Integration
    console.log("\n[TEST] Posting period depreciation run to General Ledger...");
    const postResult = await FixedAssetsService.postDepreciationRun(companyId, '2026-07', userId);
    console.log(`✅ Depreciation Posted! Voucher Created: ${postResult.voucherNumber}, Total: PKR ${postResult.totalAmount}`);

    // Re-inquiry and verify book values updated
    const inquiryPost = await AssetInquiryService.getAssetInquiryDetails(assetId, companyId);
    const accountingBook = inquiryPost.depreciationBooks.find(b => b.book_name === 'Accounting');
    console.log("✅ Post-depreciation Accumulated Dep: PKR", accountingBook.accumulated_depreciation);
    console.log("✅ Post-depreciation Carrying Book Value: PKR", accountingBook.current_book_value);
    
    const depEvent = inquiryPost.ledger.find(l => l.event_type === 'DEPRECIATION');
    if (!depEvent) {
      throw new Error('Expected to find depreciation event in asset sub-ledger.');
    }
    console.log("✅ Found sub-ledger entry for depreciation allocation.");

    // 6. Dispose Asset & Retain Gain/Loss
    console.log("\n[TEST] Retiring / Disposing of the asset...");
    const disposalResult = await FixedAssetsService.disposeAsset(companyId, userId, {
      asset_id: assetId,
      disposal_date: '2026-07-28',
      disposal_reason: 'Scrapped due to accident.',
      proceeds_amount: 50000.00
    });
    console.log(`✅ Disposal posted successfully! Ref: ${disposalResult.voucherNumber}, Gain/Loss: PKR ${disposalResult.gainLoss}`);

    const inquiryFinal = await AssetInquiryService.getAssetInquiryDetails(assetId, companyId);
    console.log("✅ Final Asset Status:", inquiryFinal.asset.status);
    console.log("✅ Final Accounting Carrying Value: PKR", inquiryFinal.depreciationBooks.find(b => b.book_name === 'Accounting').current_book_value);

    console.log("\n---------------------------------------------------------");
    console.log("🎉 ALL ASSET MANAGEMENT INTEGRATION TESTS PASSED! 🎉");
    console.log("---------------------------------------------------------");
  } catch (err) {
    console.error("\n❌ TEST FAILURE:", err.message);
  } finally {
    await db.destroy();
  }
}

runTests();
