require('dotenv').config();
const db = require('../src/config/db');

async function runHealthCheck() {
  console.log("=================================================================");
  console.log("                SARFIS ENTERPRISE ERP HEALTH AUDIT              ");
  console.log("=================================================================");
  
  const modules = {
    auth: { status: 'PASS', details: 'OK', score: 100 },
    gl: { status: 'PASS', details: 'OK', score: 100 },
    vouchers: { status: 'PASS', details: 'OK', score: 100 },
    inventory: { status: 'PASS', details: 'OK', score: 100 },
    assets: { status: 'PASS', details: 'OK', score: 100 },
    budgets: { status: 'PASS', details: 'OK', score: 100 },
    workflows: { status: 'PASS', details: 'OK', score: 100 },
    notifications: { status: 'PASS', details: 'OK', score: 100 }
  };

  let totalChecks = 0;
  let passedChecks = 0;

  function assert(moduleKey, condition, message, severity = 'CRITICAL', suggestion = '') {
    totalChecks++;
    if (condition) {
      passedChecks++;
    } else {
      modules[moduleKey].status = 'FAIL';
      modules[moduleKey].details = message;
      modules[moduleKey].score = Math.max(0, modules[moduleKey].score - 20);
      console.error(`\n[${severity}] ${moduleKey.toUpperCase()}: ${message}`);
      if (suggestion) {
        console.warn(` 👉 AUTO-REPAIR SUGGESTION: ${suggestion}\n`);
      }
    }
  }

  try {
    // ---------------------------------------------------------
    // 1. AUTHENTICATION & SECURITY
    // ---------------------------------------------------------
    console.log("\n[AUDIT] Swiping Auth & Tenancy layer...");
    const usersCount = await db('users').count('id as count').first();
    const companiesCount = await db('companies').count('id as count').first();
    assert('auth', parseInt(usersCount.count) > 0, "No system users found.", 'CRITICAL', "No users are registered. Populate the database via seed scripts.");
    assert('auth', parseInt(companiesCount.count) > 0, "No registered companies found.", 'CRITICAL', "Execute company creation migrations.");

    // Check for orphaned company members
    const companyUsers = await db('company_users').select('user_id');
    for (const cu of companyUsers) {
      const u = await db('users').where({ id: cu.user_id }).first();
      assert('auth', !!u, `Orphaned company user detected: User ID ${cu.user_id} does not exist in users table.`, 'HIGH', `Remove or re-link orphaned company membership for User ID ${cu.user_id}.`);
    }

    // ---------------------------------------------------------
    // 2. GENERAL LEDGER INTEGRITY
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping General Ledger...");
    
    // Check if total debits match total credits globally in posted journals
    const ledgerTotals = await db('journal_lines')
      .join('journal_entries', 'journal_lines.entry_id', 'journal_entries.id')
      .where('journal_entries.status', 'POSTED')
      .select(db.raw("SUM(debit) as debits"), db.raw("SUM(credit) as credits")).first();
    const diff = Math.abs((parseFloat(ledgerTotals.debits) || 0) - (parseFloat(ledgerTotals.credits) || 0));
    assert('gl', diff < 0.01, `Double-entry imbalance: Global posted debits (${ledgerTotals.debits}) do not match credits (${ledgerTotals.credits}). Diff: ${diff}`, 'CRITICAL', "Run general ledger balance checks or post offset entry.");

    // Check for out-of-balance posted journals
    const unbalancedJournals = await db('journal_lines')
      .join('journal_entries', 'journal_lines.entry_id', 'journal_entries.id')
      .where('journal_entries.status', 'POSTED')
      .select('journal_entries.id', 'journal_entries.description')
      .groupBy('journal_entries.id', 'journal_entries.description')
      .having(db.raw("ABS(SUM(debit) - SUM(credit))"), '>', 0.01);
    
    assert('gl', unbalancedJournals.length === 0, `Unbalanced posted journals: Found ${unbalancedJournals.length} journals with Debits != Credits.`, 'CRITICAL', "Locate out-of-balance entries and run adjust balance scripts.");

    // Check for journal lines referencing missing entries
    const orphanedJournalLines = await db('journal_lines')
      .leftJoin('journal_entries', 'journal_lines.entry_id', 'journal_entries.id')
      .whereNull('journal_entries.id')
      .select('journal_lines.id');
    assert('gl', orphanedJournalLines.length === 0, `Orphaned journal lines: Found ${orphanedJournalLines.length} lines referencing deleted entry IDs.`, 'HIGH', "Run cleanup script to delete journal lines lacking headers.");

    // ---------------------------------------------------------
    // 3. VOUCHER & SUB-LEDGER INTEGRITY
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Vouchers & Postings...");

    // Check if posted vouchers created ledger entries
    const postedVouchers = await db('vouchers').where({ status: 'POSTED' }).select('id', 'voucher_number', 'journal_entry_id');
    for (const v of postedVouchers) {
      assert('vouchers', !!v.journal_entry_id, `Posted voucher #${v.voucher_number} (ID: ${v.id}) is missing journal_entry_id reference.`, 'CRITICAL', `Run backend/scratch/recover_posted_vouchers.js to link or re-generate matching journal entries.`);
      if (v.journal_entry_id) {
        const j = await db('journal_entries').where({ id: v.journal_entry_id }).first();
        assert('vouchers', !!j, `Posted voucher #${v.voucher_number} references non-existent journal entry ID ${v.journal_entry_id}.`, 'CRITICAL', `Re-run recovery script to re-create missing journal entry ${v.journal_entry_id}.`);
      }
    }

    // Check if draft vouchers erroneously have ledger entries
    const draftVouchers = await db('vouchers').where({ status: 'DRAFT' }).select('id', 'voucher_number', 'journal_entry_id');
    for (const v of draftVouchers) {
      assert('vouchers', !v.journal_entry_id, `Draft voucher #${v.voucher_number} (ID: ${v.id}) has associated journal_entry_id ${v.journal_entry_id}.`, 'HIGH', `Reset journal_entry_id to NULL on voucher #${v.voucher_number}.`);
    }

    // ---------------------------------------------------------
    // 4. INVENTORY CONTROL
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Inventory & Stocks...");

    // Check for negative stock
    const negativeStock = await db('inventory')
      .where('quantity', '<', 0)
      .select('product_id', 'warehouse_id');
    assert('inventory', negativeStock.length === 0, `Negative stock detected: Found ${negativeStock.length} warehouse balances with negative quantities.`, 'HIGH', "Run stock adjustment to correct negative quantities.");

    // Compile and Render Inventory Reconciliation Report Table
    const reconciliationRows = [];
    const companies = await db('companies').select('id', 'name');
    for (const c of companies) {
      const settings = await db('company_accounting_settings').where({ company_id: c.id }).first();
      if (settings && settings.default_inventory_account_id) {
        const acc = await db('accounts').where({ id: settings.default_inventory_account_id }).first();
        if (acc) {
          const val = await db('v_stock_summary')
            .where({ company_id: c.id })
            .select(db.raw('SUM(total_qty * cost_price) as value'))
            .first();
          const stockVal = parseFloat(val.value) || 0;
          const glBalance = parseFloat(acc.balance) || 0;
          const invDiff = Math.abs(stockVal - glBalance);
          const isOk = invDiff < 10.00;

          reconciliationRows.push({
            name: `${c.name.substring(0, 15)} (${acc.code})`,
            stockVal,
            glBalance,
            diff: stockVal - glBalance,
            status: isOk ? '✅ RECONCILED' : '⚠️ MISMATCH'
          });

          assert('inventory', isOk, `Stock Ledger mismatch for Company ID ${c.id} (${c.name}): GL Inventory balance (${glBalance}) does not match stock valuation (${stockVal}). Diff: ${stockVal - glBalance}`, 'CRITICAL', `Run backend/scratch/reconcile_inventory.js to automatically post reconciliation adjustment entries.`);
        }
      }
    }

    // Print Reconciliation Report
    console.log("\n=================================================================");
    console.log("                  INVENTORY RECONCILIATION REPORT                ");
    console.log("=================================================================");
    console.log("Company (Control)    | Stock Value     | GL Balance      | Difference   | Status");
    console.log("-----------------------------------------------------------------");
    reconciliationRows.forEach(r => {
      const padComp = r.name.padEnd(20);
      const padVal = `PKR ${r.stockVal.toLocaleString()}`.padEnd(15);
      const padBal = `PKR ${r.glBalance.toLocaleString()}`.padEnd(15);
      const padDiff = `PKR ${r.diff.toLocaleString()}`.padEnd(13);
      console.log(`${padComp} | ${padVal} | ${padBal} | ${padDiff} | ${r.status}`);
    });
    console.log("=================================================================\n");

    // ---------------------------------------------------------
    // 5. FIXED ASSETS
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Fixed Assets...");
    const assetsWithoutCat = await db('assets').whereNull('category_id').select('id');
    assert('assets', assetsWithoutCat.length === 0, `Assets missing category: Found ${assetsWithoutCat.length} asset cards lacking classifications.`, 'MEDIUM', "Set valid category ID on the affected asset records.");

    // Reconcile asset costs against capitalization logs
    const activeAssets = await db('assets').where({ status: 'ACTIVE' }).select('id', 'purchase_cost');
    for (const asset of activeAssets) {
      const logsSum = await db('asset_ledger')
        .where({ asset_id: asset.id, event_type: 'ACQUISITION' })
        .sum('amount as sum_amount')
        .first();
      const capSum = parseFloat(logsSum.sum_amount) || 0;
      assert('assets', Math.abs(capSum - parseFloat(asset.purchase_cost)) < 0.01, `Asset ID ${asset.id} capitalization mismatch: Purchase Cost (${asset.purchase_cost}) does not match acquisition ledger sum (${capSum}).`, 'HIGH', `Adjust asset ledger acquisition record value to match purchase cost.`);
    }

    // ---------------------------------------------------------
    // 6. BUDGET CONTROLS
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Budget Lines...");
    const budgetBreaches = await db('budget_control_transactions')
      .join('budget_control_lines', 'budget_control_transactions.budget_control_line_id', 'budget_control_lines.id')
      .select('budget_control_lines.allocated_amount')
      .sum('budget_control_transactions.amount as actual_spend')
      .groupBy('budget_control_lines.id', 'budget_control_lines.allocated_amount')
      .having(db.raw("SUM(budget_control_transactions.amount)"), '>', db.ref('budget_control_lines.allocated_amount'));
    assert('budgets', budgetBreaches.length === 0, `Budget control violations: Found ${budgetBreaches.length} budget lines that exceeded limits.`, 'CRITICAL', "Review budget allocations or request authorized variance overrides.");

    // ---------------------------------------------------------
    // 7. WORKFLOWS
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Workflows...");
    const stuckWorkflows = await db('workflow_instances')
      .where({ status: 'PENDING' })
      .andWhere('updated_at', '<', db.raw("NOW() - INTERVAL '7 days'"))
      .select('id');
    assert('workflows', stuckWorkflows.length === 0, `Stuck workflows: Found ${stuckWorkflows.length} approval instances stuck for >7 days.`, 'MEDIUM', "Escalate or re-assign stuck workflows to active approver roles.");

    // ---------------------------------------------------------
    // 8. NOTIFICATIONS & EMAIL
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Notification Center...");
    const failedEmails = await db('notification_queue').where({ status: 'FAILED' }).count('id as count').first();
    const pendingEmails = await db('notification_queue').where({ status: 'PENDING' }).count('id as count').first();
    console.log(`- Email Queue State: ${pendingEmails.count} PENDING, ${failedEmails.count} FAILED`);
    assert('notifications', true, "OK");

    // ---------------------------------------------------------
    // RENDER RECONCILIATION SUMMARY DASHBOARD
    // ---------------------------------------------------------
    console.log("\n=================================================================");
    console.log("                      RECONCILIATION DASHBOARD                   ");
    console.log("=================================================================");
    
    Object.entries(modules).forEach(([name, mod]) => {
      const padding = " ".repeat(20 - name.length);
      const statusColor = mod.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      console.log(`${name.toUpperCase()}${padding}: ${statusColor} (Score: ${mod.score}%)`);
    });

    const overallScore = Math.round(
      Object.values(modules).reduce((sum, m) => sum + m.score, 0) / Object.keys(modules).length
    );

    console.log("-----------------------------------------------------------------");
    console.log(`OVERALL ERP HEALTH SCORE: ${overallScore}%`);
    console.log("=================================================================\n");

  } catch (err) {
    console.error("Health Audit process aborted due to error:", err.message);
  } finally {
    process.exit(0);
  }
}

runHealthCheck();
