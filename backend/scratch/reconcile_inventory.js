const db = require('../src/config/db');
const JournalModel = require('../src/models/journal.model');
const AccountModel = require('../src/models/account.model');

async function reconcile() {
  console.log("=========================================================");
  console.log("             RECONCILING WAREHOUSE STOCKS & GL           ");
  console.log("=========================================================");

  const configs = [
    { companyId: 1, inventoryAccId: 5, retainedEarningsAccId: 36 },
    { companyId: 11, inventoryAccId: 635, retainedEarningsAccId: 666 }
  ];

  try {
    for (const cfg of configs) {
      const { companyId, inventoryAccId, retainedEarningsAccId } = cfg;
      console.log(`\nProcessing Company ID: ${companyId}`);

      // 1. Correct the default mapping in settings
      await db('company_accounting_settings')
        .where({ company_id: companyId })
        .update({ default_inventory_account_id: inventoryAccId });
      console.log(`- Mapped default_inventory_account_id to Account ID ${inventoryAccId}.`);

      // 2. Fetch current physical stock valuation
      const val = await db('v_stock_summary')
        .where({ company_id: companyId })
        .select(db.raw('SUM(total_qty * cost_price) as value'))
        .first();
      const stockValue = parseFloat(val.value) || 0;
      console.log(`- Physical stock valuation: PKR ${stockValue.toLocaleString()}`);

      // 3. Fetch current GL balance
      const acc = await db('accounts').where({ id: inventoryAccId }).first();
      const glBalance = parseFloat(acc.balance) || 0;
      console.log(`- Current GL Account Balance: PKR ${glBalance.toLocaleString()}`);

      const diff = stockValue - glBalance;
      console.log(`- Difference to reconcile: PKR ${diff.toLocaleString()}`);

      if (Math.abs(diff) < 0.01) {
        console.log("- Stock and GL are already reconciled. No adjusting entries needed.");
        continue;
      }

      // 4. Post adjusting journal entry
      await db.transaction(async (trx) => {
        const entryId = await JournalModel.createEntry({
          companyId,
          entryDate: new Date(),
          description: `Inventory Reconciliation Adjustment: Reconciling stock ledger with physical stock valuation`,
          status: 'POSTED',
          userId: 1
        }, trx);

        if (diff > 0) {
          // Debit Inventory (increase asset), Credit Retained Earnings
          await JournalModel.createLine({ entryId, accountId: inventoryAccId, debit: diff, credit: 0 }, trx);
          await JournalModel.createLine({ entryId, accountId: retainedEarningsAccId, debit: 0, credit: diff }, trx);
          console.log(`  -> Posted Adjusting JE #${entryId}: Dr Inventory (PKR ${diff}), Cr Retained Earnings (PKR ${diff})`);
        } else {
          // Credit Inventory (decrease asset), Debit Retained Earnings
          const absoluteDiff = Math.abs(diff);
          await JournalModel.createLine({ entryId, accountId: inventoryAccId, debit: 0, credit: absoluteDiff }, trx);
          await JournalModel.createLine({ entryId, accountId: retainedEarningsAccId, debit: absoluteDiff, credit: 0 }, trx);
          console.log(`  -> Posted Adjusting JE #${entryId}: Dr Retained Earnings (PKR ${absoluteDiff}), Cr Inventory (PKR ${absoluteDiff})`);
        }

        // 5. Update Cached Balances
        if (diff > 0) {
          await AccountModel.updateBalance(inventoryAccId, companyId, diff, 0, trx);
          await AccountModel.updateBalance(retainedEarningsAccId, companyId, 0, diff, trx);
        } else {
          const absoluteDiff = Math.abs(diff);
          await AccountModel.updateBalance(inventoryAccId, companyId, 0, absoluteDiff, trx);
          await AccountModel.updateBalance(retainedEarningsAccId, companyId, absoluteDiff, 0, trx);
        }
      });

      console.log("- Reconciliation adjustment successfully posted.");
    }

    console.log("\n=========================================================");
    console.log("            ALL INVENTORY RECONCILIATIONS COMPLETE       ");
    console.log("=========================================================");

  } catch (err) {
    console.error("\n❌ Reconciliation failed with error:", err.message);
  } finally {
    process.exit(0);
  }
}

reconcile();
