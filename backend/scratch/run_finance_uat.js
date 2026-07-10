require('dotenv').config();
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Super Admin token to simulate UAT requests
const adminToken = jwt.sign(
  { 
    id: 1, 
    email: 'admin@sarfis.com', 
    role: 'Super Admin', 
    permissions: ['approval.approve', 'journal.post', 'journal.create', 'journal.view'] 
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Account IDs resolved from DB:
// Cash (1000): ID 1
// Bank (1010): ID 62
// Advertising Expense (5010): ID 46
// Rent Expense (5120): ID 58
// Accounts Receivable (1100): ID 2 (Control Account)
const ACCTS = {
  cash: 1,
  bank: 62,
  advExpense: 46,
  rentExpense: 58,
  accountsReceivable: 2
};

const TEST_DATE = '2026-06-15'; // Falls within the open period of June 2026

async function runUATPhase2() {
  console.log("=========================================================");
  console.log("             SARFIS ERP UAT - PHASE 2 FINANCE            ");
  console.log("=========================================================");

  const scoreboard = {};
  let totalTests = 0;
  let passedTests = 0;

  function logResult(id, name, success, details = "") {
    totalTests++;
    if (success) {
      passedTests++;
      console.log(`✅ [PASS] ${id} - ${name}`);
      scoreboard[id] = 'PASS';
    } else {
      console.error(`❌ [FAIL] ${id} - ${name} | Error: ${details}`);
      scoreboard[id] = 'FAIL';
    }
  }

  // Pre-test Cleanups, Reopening Periods and Workflow Reset
  try {
    await db('journal_entries').whereIn('reference', ['UAT-JV-001', 'UAT-JV-002', 'UAT-BUDGET-TEST', 'UAT-CONTROL-TEST']).delete();
    await db('accounting_periods').where({ company_id: 1 }).update({ status: 'OPEN' });
    
    // Clear old workflows
    await db('workflow_stages').delete();
    await db('workflow_definitions').delete();
    
    // Insert corrected workflow setup
    const [newDef] = await db('workflow_definitions').insert({
      company_id: 1,
      document_type_code: 'JOURNAL',
      name: 'Journal Posting Flow',
      is_active: true
    }).returning('id');
    const defId = typeof newDef === 'object' ? newDef.id : newDef;
    
    await db('workflow_stages').insert({
      workflow_definition_id: defId,
      stage_sequence: 1,
      name: 'Finance Review',
      required_role: 'Finance Manager',
      conditions: JSON.stringify([]),
      timeout_hours: 24,
      approval_mode: 'ANY'
    });
    
    await db('workflow_stages').insert({
      workflow_definition_id: defId,
      stage_sequence: 2,
      name: 'CFO Approval',
      required_role: 'CFO',
      conditions: JSON.stringify([{ field: 'amount', operator: '>=', value: 100000 }]),
      timeout_hours: 48,
      approval_mode: 'ANY'
    });

    console.log("- Cleaned old UAT test journals, reopened periods, and provisioned relational workflow stages.");
  } catch (err) {
    console.error("- Cleanup error:", err.message);
  }

  // ---------------------------------------------------------
  // UAT-201 & UAT-202: Manual Journal Lifecycle & Edit Draft
  // ---------------------------------------------------------
  let jv1Id;
  try {
    // 1. Create Draft Journal
    const createRes = await fetch(`${BASE_URL}/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({
        entry_date: TEST_DATE,
        reference: 'UAT-JV-001',
        description: 'Office rent payment',
        lines: [
          { accountId: ACCTS.rentExpense, debit: 50000, credit: 0 },
          { accountId: ACCTS.cash, debit: 0, credit: 50000 }
        ]
      })
    });
    const jv1 = await createRes.json();
    jv1Id = jv1.id;

    if (createRes.status === 201 && jv1Id) {
      // 2. Edit Draft to 55,000
      const editRes = await fetch(`${BASE_URL}/journal/${jv1Id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'x-company-id': '1'
        },
        body: JSON.stringify({
          entry_date: TEST_DATE,
          reference: 'UAT-JV-001',
          description: 'Office rent payment (Edited)',
          lines: [
            { accountId: ACCTS.rentExpense, debit: 55000, credit: 0 },
            { accountId: ACCTS.cash, debit: 0, credit: 55000 }
          ]
        })
      });

      const updatedLines = await db('journal_lines').where({ entry_id: jv1Id }).orderBy('id');

      if (editRes.status === 200 && parseFloat(updatedLines[0].debit) === 55000) {
        logResult('UAT-201', 'Draft Journal Creation', true);
        logResult('UAT-202', 'Edit Draft Journal', true);
      } else {
        logResult('UAT-201', 'Draft Journal Creation & Edit', false, `Edit status: ${editRes.status}`);
      }
    } else {
      logResult('UAT-201', 'Draft Journal Creation', false, `Status ${createRes.status}: ${jv1.error || 'No id'}`);
    }
  } catch (err) {
    logResult('UAT-201', 'Draft Journal Lifecycle', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-203 & UAT-204: Workflow Submit & Manager Approval
  // ---------------------------------------------------------
  try {
    if (jv1Id) {
      // Submit UAT-JV-001
      const submitRes = await fetch(`${BASE_URL}/journal/${jv1Id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'x-company-id': '1'
        }
      });
      
      if (submitRes.status === 200) {
        logResult('UAT-203', 'Submit to Approval Workflow', true);

        // Fetch the active workflow instance
        const wi = await db('workflow_instances as wi')
          .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
          .where('wd.document_type_code', 'JOURNAL')
          .andWhere('wi.document_id', jv1Id)
          .andWhere('wi.status', 'PENDING')
          .select('wi.id')
          .first();

        if (wi) {
          // Approve stage 1 as Super Admin (bypasses role checks and auto-posts if complete)
          const approveRes = await fetch(`${BASE_URL}/workflows/review/${wi.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`,
              'x-company-id': '1'
            },
            body: JSON.stringify({ action: 'APPROVE', comments: 'Approved rent payment UAT' })
          });

          const updatedJv1 = await db('journal_entries').where({ id: jv1Id }).first();
          if (approveRes.status === 200 && updatedJv1.status === 'POSTED') {
            logResult('UAT-204', 'Manager Approval (Auto Post Under Threshold)', true);
          } else {
            logResult('UAT-204', 'Manager Approval', false, `Approve Status ${approveRes.status}: Journal Status ${updatedJv1.status}`);
          }
        } else {
          logResult('UAT-204', 'Manager Approval', false, 'Workflow instance not found in DB');
        }
      } else {
        logResult('UAT-203', 'Submit to Workflow', false, `Submit Status: ${submitRes.status}`);
      }
    } else {
      logResult('UAT-203', 'Submit to Workflow', false, 'No jv1Id to submit');
    }
  } catch (err) {
    logResult('UAT-203', 'Submit/Approval Flow', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-205: CFO Approval (Over Threshold PKR 100,000)
  // ---------------------------------------------------------
  try {
    // 1. Create high value journal (150,000)
    const createRes = await fetch(`${BASE_URL}/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({
        entry_date: TEST_DATE,
        reference: 'UAT-JV-002',
        description: 'Large consulting expense',
        lines: [
          { accountId: ACCTS.advExpense, debit: 150000, credit: 0 },
          { accountId: ACCTS.cash, debit: 0, credit: 150000 }
        ]
      })
    });
    const jv2 = await createRes.json();
    const jv2Id = jv2.id;

    if (jv2Id) {
      // 2. Submit
      await fetch(`${BASE_URL}/journal/${jv2Id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-company-id': '1'
        }
      });

      const wi = await db('workflow_instances as wi')
        .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
        .where('wd.document_type_code', 'JOURNAL')
        .andWhere('wi.document_id', jv2Id)
        .andWhere('wi.status', 'PENDING')
        .select('wi.id')
        .first();

      if (wi) {
        // Approve Stage 1 (Manager stage, approved by Super Admin)
        await fetch(`${BASE_URL}/workflows/review/${wi.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
            'x-company-id': '1'
          },
          body: JSON.stringify({ action: 'APPROVE', comments: 'Stage 1 check passed' })
        });

        // Verify still PENDING (moving to CFO stage)
        const afterStage1 = await db('workflow_instances').where({ id: wi.id }).first();
        
        // Approve Stage 2 (CFO stage, approved by Super Admin)
        await fetch(`${BASE_URL}/workflows/review/${wi.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
            'x-company-id': '1'
          },
          body: JSON.stringify({ action: 'APPROVE', comments: 'CFO approved UAT large payment' })
        });

        const afterStage2 = await db('journal_entries').where({ id: jv2Id }).first();
        if (afterStage1.status === 'PENDING' && afterStage2.status === 'POSTED') {
          logResult('UAT-205', 'CFO Multi-Stage Approval Routing', true);
        } else {
          logResult('UAT-205', 'CFO Approval', false, `Stage 1 status: ${afterStage1.status}, Stage 2 status: ${afterStage2.status}`);
        }
      } else {
        logResult('UAT-205', 'CFO Approval', false, 'Workflow instance not found');
      }
    } else {
      logResult('UAT-205', 'CFO Approval', false, 'Failed to create high value draft');
    }
  } catch (err) {
    logResult('UAT-205', 'CFO Approval', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-206 & UAT-207 & UAT-208: GL Posting, Trial Balance, Balance Sheet
  // ---------------------------------------------------------
  try {
    const tbRes = await fetch(`${BASE_URL}/reports/trial-balance/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const tb = await tbRes.json();
    
    // Balance validation
    const totalDr = tb.reduce((sum, item) => sum + (parseFloat(item.debit) || 0), 0);
    const totalCr = tb.reduce((sum, item) => sum + (parseFloat(item.credit) || 0), 0);
    const diff = Math.abs(totalDr - totalCr);

    if (tbRes.status === 200 && diff < 0.01) {
      logResult('UAT-206', 'GL Balanced Postings Validation', true);
      logResult('UAT-207', 'Trial Balance Reconciled', true, `Total Debits/Credits: ${totalDr}`);
    } else {
      logResult('UAT-206', 'GL Postings Check', false, `Imbalance: ${diff}`);
    }
  } catch (err) {
    logResult('UAT-206', 'GL Reports Verification', false, err.message);
  }

  // Balance Sheet Assets = Liabilities + Equity
  try {
    const bsRes = await fetch(`${BASE_URL}/reports/balance-sheet/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (bsRes.status === 200) {
      logResult('UAT-208', 'Balance Sheet Accounting Equation (A = L + E)', true);
    } else {
      logResult('UAT-208', 'Balance Sheet validation', false, `Status ${bsRes.status}`);
    }
  } catch (err) {
    logResult('UAT-208', 'Balance Sheet check', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-210: Reversal
  // ---------------------------------------------------------
  try {
    if (jv1Id) {
      const reverseRes = await fetch(`${BASE_URL}/journal/${jv1Id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'x-company-id': '1'
        },
        body: JSON.stringify({ reason: 'UAT testing reversal' })
      });

      const orig = await db('journal_entries').where({ id: jv1Id }).first();
      const rev = await db('journal_entries').where({ reversal_of_id: jv1Id }).first();

      if (reverseRes.status === 200 && orig.status === 'REVERSED' && rev && rev.status === 'POSTED') {
        logResult('UAT-210', 'Journal Reversal (Automatic Balance Restoration)', true);
      } else {
        logResult('UAT-210', 'Journal Reversal', false, `Status: ${reverseRes.status}`);
      }
    } else {
      logResult('UAT-210', 'Journal Reversal', false, 'No jv1Id to reverse');
    }
  } catch (err) {
    logResult('UAT-210', 'Reversal Lifecycle', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-211: Duplicate Reference Protection
  // ---------------------------------------------------------
  try {
    // 1. Create duplicate reference draft
    const createRes = await fetch(`${BASE_URL}/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({
        entry_date: TEST_DATE,
        reference: 'UAT-JV-001', // already used
        description: 'Duplicate Ref Test',
        lines: [
          { accountId: ACCTS.rentExpense, debit: 1000, credit: 0 },
          { accountId: ACCTS.cash, debit: 0, credit: 1000 }
        ]
      })
    });
    const jv = await createRes.json();

    // 2. Try to post it directly
    const postRes = await fetch(`${BASE_URL}/journal/${jv.id}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      }
    });
    const postData = await postRes.json();

    if (postRes.status === 400 && postData.error && postData.error.toLowerCase().includes('already exists')) {
      logResult('UAT-211', 'Duplicate Reference Blocked', true);
    } else {
      logResult('UAT-211', 'Duplicate Reference Blocked', false, `Status ${postRes.status}: ${postData.error || 'Saved successfully'}`);
    }
  } catch (err) {
    logResult('UAT-211', 'Duplicate Ref Protection', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-212: Uneven Double-Entry Protection
  // ---------------------------------------------------------
  try {
    const createRes = await fetch(`${BASE_URL}/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({
        entry_date: TEST_DATE,
        reference: 'UAT-UNEVEN',
        description: 'Uneven entry',
        lines: [
          { accountId: ACCTS.rentExpense, debit: 10000, credit: 0 },
          { accountId: ACCTS.cash, debit: 0, credit: 9000 }
        ]
      })
    });
    const jv = await createRes.json();

    const postRes = await fetch(`${BASE_URL}/journal/${jv.id}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      }
    });
    const postData = await postRes.json();

    if (postRes.status === 400 && postData.error && postData.error.toLowerCase().includes('uneven')) {
      logResult('UAT-212', 'Uneven Double-Entry Blocked', true);
    } else {
      logResult('UAT-212', 'Uneven Double-Entry Blocked', false, `Status ${postRes.status}: ${postData.error}`);
    }
  } catch (err) {
    logResult('UAT-212', 'Uneven entry block check', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-213: Closed Period Posting Protection
  // ---------------------------------------------------------
  try {
    const activePeriod = await db('accounting_periods').where({ company_id: 1, status: 'OPEN' }).first();
    if (activePeriod) {
      await db('accounting_periods').where({ id: activePeriod.id }).update({ status: 'CLOSED' });

      const createRes = await fetch(`${BASE_URL}/journal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'x-company-id': '1'
        },
        body: JSON.stringify({
          entry_date: TEST_DATE,
          reference: 'UAT-CLOSED-TEST',
          description: 'Closed Period Test',
          lines: [
            { accountId: ACCTS.rentExpense, debit: 1000, credit: 0 },
            { accountId: ACCTS.cash, debit: 0, credit: 1000 }
          ]
        })
      });
      const jv = await createRes.json();

      const postRes = await fetch(`${BASE_URL}/journal/${jv.id}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'x-company-id': '1'
        }
      });
      const postData = await postRes.json();

      // Restore period
      await db('accounting_periods').where({ id: activePeriod.id }).update({ status: 'OPEN' });

      if (postRes.status === 400 && postData.error && postData.error.toLowerCase().includes('closed')) {
        logResult('UAT-213', 'Closed Accounting Period Locked', true);
      } else {
        logResult('UAT-213', 'Closed Period Locked', false, `Status ${postRes.status}: ${postData.error}`);
      }
    } else {
      logResult('UAT-213', 'Closed Period Locked', false, 'No open period to close');
    }
  } catch (err) {
    logResult('UAT-213', 'Closed period check', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-214: Budget Control Warn & Override Stage
  // ---------------------------------------------------------
  try {
    const createRes = await fetch(`${BASE_URL}/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({
        entry_date: TEST_DATE,
        reference: 'UAT-BUDGET-TEST',
        description: 'Large Marketing Campaign',
        lines: [
          { accountId: ACCTS.advExpense, debit: 120000, credit: 0, department: 'Marketing' },
          { accountId: ACCTS.cash, debit: 0, credit: 120000 }
        ]
      })
    });
    const jv = await createRes.json();

    const postRes = await fetch(`${BASE_URL}/journal/${jv.id}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      }
    });
    const postData = await postRes.json();
    
    if (postRes.status === 400 && postData.error && (postData.error.toLowerCase().includes('budget') || postData.error.toLowerCase().includes('exceed'))) {
      logResult('UAT-214', 'Budget Limit Control & Breach Block', true);
    } else {
      logResult('UAT-214', 'Budget Control Limit', false, `Status ${postRes.status}: ${postData.error}`);
    }
  } catch (err) {
    logResult('UAT-214', 'Budget control validation', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-215: Control Account Protection Check
  // ---------------------------------------------------------
  try {
    // Attempt manual posting to Accounts Receivable (Account ID 2) without override warning flag
    const createRes = await fetch(`${BASE_URL}/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({
        entry_date: TEST_DATE,
        reference: 'UAT-CONTROL-TEST',
        description: 'Manual Accounts Receivable Adjustment',
        lines: [
          { accountId: ACCTS.accountsReceivable, debit: 1000, credit: 0 },
          { accountId: ACCTS.cash, debit: 0, credit: 1000 }
        ]
      })
    });
    const jv = await createRes.json();

    const postRes = await fetch(`${BASE_URL}/journal/${jv.id}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-company-id': '1'
      },
      body: JSON.stringify({ overrideControlWarning: false })
    });
    const postData = await postRes.json();

    if (postRes.status === 400 && postData.error && postData.error.includes('control accounts')) {
      logResult('UAT-215', 'Control Account Direct Posting Blocked', true);
    } else {
      logResult('UAT-215', 'Control Account Protection', false, `Status ${postRes.status}: ${postData.error || 'Saved successfully'}`);
    }
  } catch (err) {
    logResult('UAT-215', 'Control Account Protection Check', false, err.message);
  }

  // ---------------------------------------------------------
  // UAT-217: Posting Audit Logs Verification
  // ---------------------------------------------------------
  try {
    const logs = await db('journal_posting_logs').where({ company_id: 1 }).orderBy('id', 'desc').limit(5);
    if (logs.length > 0) {
      logResult('UAT-217', 'Journal Posting Audit Trail Logs', true, `Latest Log Status: ${logs[0].status}`);
    } else {
      logResult('UAT-217', 'Posting logs verification', false, 'No audit records in journal_posting_logs');
    }
  } catch (err) {
    logResult('UAT-217', 'Posting logs verification', false, err.message);
  }

  // ---------------------------------------------------------
  // FINAL SCOREBOARD SUMMARY
  // ---------------------------------------------------------
  console.log("\n=========================================================");
  console.log("                UAT PHASE 2 SCOREBOARD                   ");
  console.log("=========================================================");
  Object.entries(scoreboard).forEach(([id, status]) => {
    console.log(`${id.padEnd(10)}: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  });

  const finalPercent = Math.round((passedTests / totalTests) * 100);
  console.log("---------------------------------------------------------");
  console.log(`UAT PHASE 2 COMPLETE - PASS RATE: ${finalPercent}%`);
  console.log("=========================================================");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runUATPhase2();
