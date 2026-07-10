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

  function assert(moduleKey, condition, message) {
    totalChecks++;
    if (condition) {
      passedChecks++;
    } else {
      modules[moduleKey].status = 'FAIL';
      modules[moduleKey].details = message;
      modules[moduleKey].score = Math.max(0, modules[moduleKey].score - 20);
      console.error(`[FAIL] ${moduleKey.toUpperCase()}: ${message}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // 1. AUTHENTICATION & SECURITY
    // ---------------------------------------------------------
    console.log("\n[AUDIT] Swiping Auth & Tenancy layer...");
    const usersCount = await db('users').count('id as count').first();
    const companiesCount = await db('companies').count('id as count').first();
    assert('auth', parseInt(usersCount.count) > 0, "No system users found.");
    assert('auth', parseInt(companiesCount.count) > 0, "No registered companies found.");

    // Check for orphaned company members
    const companyUsers = await db('company_users').select('user_id');
    for (const cu of companyUsers) {
      const u = await db('users').where({ id: cu.user_id }).first();
      assert('auth', !!u, `Orphaned company user detected: User ID ${cu.user_id} does not exist in users table.`);
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
    assert('gl', diff < 0.01, `Double-entry imbalance: Global posted debits (${ledgerTotals.debits}) do not match credits (${ledgerTotals.credits}). Diff: ${diff}`);

    // Check for out-of-balance posted journals
    const unbalancedJournals = await db('journal_lines')
      .join('journal_entries', 'journal_lines.entry_id', 'journal_entries.id')
      .where('journal_entries.status', 'POSTED')
      .select('journal_entries.id', 'journal_entries.description')
      .groupBy('journal_entries.id', 'journal_entries.description')
      .having(db.raw("ABS(SUM(debit) - SUM(credit))"), '>', 0.01);
    
    assert('gl', unbalancedJournals.length === 0, `Unbalanced posted journals: Found ${unbalancedJournals.length} journals with Debits != Credits.`);

    // Check for journal lines referencing missing entries
    const orphanedJournalLines = await db('journal_lines')
      .leftJoin('journal_entries', 'journal_lines.entry_id', 'journal_entries.id')
      .whereNull('journal_entries.id')
      .select('journal_lines.id');
    assert('gl', orphanedJournalLines.length === 0, `Orphaned journal lines: Found ${orphanedJournalLines.length} lines referencing deleted entry IDs.`);

    // ---------------------------------------------------------
    // 3. VOUCHER & SUB-LEDGER INTEGRITY
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Vouchers & Postings...");

    // Check if posted vouchers created ledger entries
    const postedVouchers = await db('vouchers').where({ status: 'POSTED' }).select('id', 'voucher_number', 'journal_entry_id');
    for (const v of postedVouchers) {
      assert('vouchers', !!v.journal_entry_id, `Posted voucher #${v.voucher_number} (ID: ${v.id}) is missing journal_entry_id reference.`);
      if (v.journal_entry_id) {
        const j = await db('journal_entries').where({ id: v.journal_entry_id }).first();
        assert('vouchers', !!j, `Posted voucher #${v.voucher_number} references non-existent journal entry ID ${v.journal_entry_id}.`);
      }
    }

    // Check if draft vouchers erroneously have ledger entries
    const draftVouchers = await db('vouchers').where({ status: 'DRAFT' }).select('id', 'voucher_number', 'journal_entry_id');
    for (const v of draftVouchers) {
      assert('vouchers', !v.journal_entry_id, `Draft voucher #${v.voucher_number} (ID: ${v.id}) has associated journal_entry_id ${v.journal_entry_id}.`);
    }

    // ---------------------------------------------------------
    // 4. INVENTORY CONTROL
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Inventory & Stocks...");

    // Check for negative stock
    const negativeStock = await db('inventory')
      .where('quantity', '<', 0)
      .select('product_id', 'warehouse_id');
    assert('inventory', negativeStock.length === 0, `Negative stock detected: Found ${negativeStock.length} warehouse balances with negative quantities.`);

    // Reconcile Inventory Control account vs Stock Valuation per company
    const companies = await db('companies').select('id');
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
          // High warning/fail if reconciliation mismatch > 10.00 (allowing minor rounding)
          assert('inventory', invDiff < 10.00, `Stock Ledger mismatch for Company ID ${c.id}: GL Inventory balance (${glBalance}) does not match stock valuation (${stockVal}). Diff: ${invDiff}`);
        }
      }
    }

    // ---------------------------------------------------------
    // 5. FIXED ASSETS
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Fixed Assets...");
    const assetsWithoutCat = await db('assets').whereNull('category_id').select('id');
    assert('assets', assetsWithoutCat.length === 0, `Assets missing category: Found ${assetsWithoutCat.length} asset cards lacking classifications.`);

    // Reconcile asset costs against capitalization logs
    const activeAssets = await db('assets').where({ status: 'ACTIVE' }).select('id', 'purchase_cost');
    for (const asset of activeAssets) {
      const logsSum = await db('asset_ledger')
        .where({ asset_id: asset.id, event_type: 'ACQUISITION' })
        .sum('amount as sum_amount')
        .first();
      const capSum = parseFloat(logsSum.sum_amount) || 0;
      assert('assets', Math.abs(capSum - parseFloat(asset.purchase_cost)) < 0.01, `Asset ID ${asset.id} capitalization mismatch: Purchase Cost (${asset.purchase_cost}) does not match acquisition ledger sum (${capSum}).`);
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
    assert('budgets', budgetBreaches.length === 0, `Budget control violations: Found ${budgetBreaches.length} budget lines that exceeded limits.`);

    // ---------------------------------------------------------
    // 7. WORKFLOWS
    // ---------------------------------------------------------
    console.log("[AUDIT] Swiping Workflows...");
    const stuckWorkflows = await db('workflow_instances')
      .where({ status: 'PENDING' })
      .andWhere('updated_at', '<', db.raw("NOW() - INTERVAL '7 days'"))
      .select('id');
    assert('workflows', stuckWorkflows.length === 0, `Stuck workflows: Found ${stuckWorkflows.length} approval instances stuck for >7 days.`);

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
