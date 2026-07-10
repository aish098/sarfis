const db = require('../src/config/db');
const JournalModel = require('../src/models/journal.model');
const AccountModel = require('../src/models/account.model');

async function recover() {
  console.log("=========================================================");
  console.log("            RECOVERING POSTED VOUCHERS INTEGRITY        ");
  console.log("=========================================================");

  try {
    // ---------------------------------------------------------
    // RECOVERY FOR JV-00001 (ID: 30) AND JV-00002 (ID: 31)
    // ---------------------------------------------------------
    console.log("\n[RECOVER] Linking JV-00001 (ID: 30) and JV-00002 (ID: 31)...");
    
    // Link voucher to journal entry 108
    await db('vouchers').where({ id: 30 }).update({
      journal_entry_id: 108,
      status: 'POSTED',
      updated_at: db.fn.now()
    });
    await db('journal_entries').where({ id: 108 }).update({
      status: 'POSTED'
    });
    console.log("- Voucher 30 linked to Journal 108 (status set to POSTED).");

    // Link voucher to journal entry 109
    await db('vouchers').where({ id: 31 }).update({
      journal_entry_id: 109,
      status: 'POSTED',
      updated_at: db.fn.now()
    });
    await db('journal_entries').where({ id: 109 }).update({
      status: 'POSTED'
    });
    console.log("- Voucher 31 linked to Journal 109 (status set to POSTED).");

    // ---------------------------------------------------------
    // RECOVERY FOR PV-00004 (ID: 14) and SV-00004 (ID: 16)
    // ---------------------------------------------------------
    console.log("\n[RECOVER] Re-creating missing Journal Entries for PV-00004 (ID: 14) and SV-00004 (ID: 16)...");

    // Get Company 1 Accounting Settings
    const settings = await db('company_accounting_settings').where({ company_id: 1 }).first();
    if (!settings) {
      throw new Error("Accounting settings for Company 1 not found.");
    }

    const {
      default_inventory_account_id: inventoryAcc,
      default_ap_account_id: apAcc,
      default_ar_account_id: arAcc,
      default_sales_account_id: salesAcc,
      default_cogs_account_id: cogsAcc
    } = settings;

    // --- RECOVER PV-00004 ---
    const pv = await db('vouchers').where({ id: 14 }).first();
    if (pv && !pv.journal_entry_id) {
      console.log("- Restoring PV-00004 Journal Entry...");
      await db.transaction(async (trx) => {
        const entryId = await JournalModel.createEntry({
          companyId: 1,
          entryDate: pv.date,
          description: `Purchase Voucher: Supplier / Vendor (Recovered)`,
          status: 'POSTED',
          userId: pv.created_by
        }, trx);

        // Lines: Dr Inventory (35,000), Cr AP (35,000)
        await JournalModel.createLine({ entryId, accountId: inventoryAcc, debit: 35000, credit: 0 }, trx);
        await JournalModel.createLine({ entryId, accountId: apAcc, debit: 0, credit: 35000 }, trx);

        // Link Voucher
        await trx('vouchers').where({ id: 14 }).update({
          journal_entry_id: entryId,
          status: 'POSTED',
          updated_at: trx.fn.now()
        });

        console.log(`  -> Created Journal Entry ID ${entryId} for PV-00004.`);
      });
    } else {
      console.log("- PV-00004 is already linked or not found.");
    }

    // --- RECOVER SV-00004 ---
    const sv = await db('vouchers').where({ id: 16 }).first();
    if (sv && !sv.journal_entry_id) {
      console.log("- Restoring SV-00004 Journal Entry...");
      await db.transaction(async (trx) => {
        const entryId = await JournalModel.createEntry({
          companyId: 1,
          entryDate: sv.date,
          description: `Sales Invoice Voucher (Recovered)`,
          status: 'POSTED',
          userId: sv.created_by
        }, trx);

        // Product WAC cost check: let's query the product cost for product ID 1
        const product = await trx('products').where({ id: 1 }).first();
        const costPrice = parseFloat(product ? product.cost_price : 0) || 1200; // fallback cost
        const cogsVal = 5 * costPrice; // 5 quantity

        // Lines: Dr AR (50,000), Cr Sales (50,000), Dr COGS (cogsVal), Cr Inventory (cogsVal)
        await JournalModel.createLine({ entryId, accountId: arAcc, debit: 50000, credit: 0 }, trx);
        await JournalModel.createLine({ entryId, accountId: salesAcc, debit: 0, credit: 50000 }, trx);
        await JournalModel.createLine({ entryId, accountId: cogsAcc, debit: cogsVal, credit: 0 }, trx);
        await JournalModel.createLine({ entryId, accountId: inventoryAcc, debit: 0, credit: cogsVal }, trx);

        // Link Voucher
        await trx('vouchers').where({ id: 16 }).update({
          journal_entry_id: entryId,
          status: 'POSTED',
          updated_at: trx.fn.now()
        });

        console.log(`  -> Created Journal Entry ID ${entryId} for SV-00004 (COGS Value: ${cogsVal}).`);
      });
    } else {
      console.log("- SV-00004 is already linked or not found.");
    }

    console.log("\n✅ Recovery successfully completed.");
  } catch (err) {
    console.error("\n❌ Recovery failed with error:", err.message);
  } finally {
    process.exit(0);
  }
}

recover();
