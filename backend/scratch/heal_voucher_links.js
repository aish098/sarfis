const db = require('../src/config/db');

async function selfHealLinks() {
  console.log("=========================================================");
  console.log("     AUTO-HEALING VOUCHER JOURNAL ENTRY LINKAGES         ");
  console.log("=========================================================");

  try {
    // 1. Fetch all posted vouchers
    const vouchers = await db('vouchers').where({ status: 'POSTED' });
    console.log(`Found ${vouchers.length} posted vouchers. Checking linkages...`);

    let healedCount = 0;

    for (const v of vouchers) {
      // Find audit log for POST action
      const log = await db('transaction_audit_logs')
        .where({ voucher_id: v.id, action: 'POST' })
        .first();

      if (log && log.description) {
        // Regex match "Journal Entry #(\d+) created"
        const match = log.description.match(/Journal Entry #(\d+) created/);
        if (match) {
          const actualJeId = parseInt(match[1], 10);
          
          if (v.journal_entry_id !== actualJeId) {
            console.log(`[HEAL] Voucher ${v.voucher_number} (ID: ${v.id}): changing journal_entry_id from ${v.journal_entry_id} to ${actualJeId}`);
            
            await db('vouchers')
              .where({ id: v.id })
              .update({ journal_entry_id: actualJeId, updated_at: db.fn.now() });

            healedCount++;
          }
        }
      }
    }

    console.log(`\nSelf-healing complete. Successfully restored ${healedCount} linkages!`);
    process.exit(0);
  } catch (err) {
    console.error("Error running self-healing script:", err);
    process.exit(1);
  }
}

selfHealLinks();
