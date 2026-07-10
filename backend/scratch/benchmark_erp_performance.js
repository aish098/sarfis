require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const JournalModel = require('../src/models/journal.model');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Programmatically generate a high-privilege Super Admin JWT token
const token = jwt.sign(
  { id: 1, email: 'admin@sarfis.com', role: 'Super Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const targets = {
  healthCheck: 300,        // < 300ms
  trialBalance: 3000,      // < 3s
  balanceSheet: 3000,      // < 3s
  incomeStatement: 3000,   // < 3s
  journalPosting: 500      // < 500ms
};

async function runBenchmarks() {
  console.log("=========================================================");
  console.log("             SARFIS ERP PERFORMANCE BENCHMARKS           ");
  console.log("=========================================================");
  console.log(`Base URL: ${BASE_URL}\n`);

  let benchmarksPassed = true;

  // Helper for API request
  async function testLatency(name, path, limitMs) {
    const url = `${BASE_URL}${path}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': '1'
        }
      });
      const latency = Date.now() - start;
      const status = res.status;

      if (status === 200 && latency <= limitMs) {
        console.log(`✅ ${name.padEnd(20)}: PASSED - Latency: ${latency}ms (Target: <${limitMs}ms)`);
      } else {
        console.warn(`❌ ${name.padEnd(20)}: FAILED - Status: ${status}, Latency: ${latency}ms (Target: <${limitMs}ms)`);
        benchmarksPassed = false;
      }
      return latency;
    } catch (err) {
      console.error(`❌ ${name.padEnd(20)}: EXCEPTION - ${err.message}`);
      benchmarksPassed = false;
      return null;
    }
  }

  // 1. Benchmark API Endpoints
  await testLatency("System Health API", "/settings/system/health", targets.healthCheck);
  await testLatency("Trial Balance Report", "/reports/trial-balance/1", targets.trialBalance);
  await testLatency("Balance Sheet Report", "/reports/balance-sheet/1", targets.balanceSheet);
  await testLatency("Income Statement", "/reports/income-statement/1", targets.incomeStatement);

  // 2. Benchmark Database Journal Posting Throughput (1000 lines load test)
  console.log("\n[BENCHMARK] Testing Journal Posting throughput (1,000 double-entry lines)...");
  const linesCount = 1000;
  
  const startPost = Date.now();
  try {
    await db.transaction(async (trx) => {
      // Create single journal header
      const entryId = await JournalModel.createEntry({
        companyId: 1,
        entryDate: new Date(),
        description: `Performance Benchmark Load Test (${linesCount} lines)`,
        status: 'DRAFT',
        userId: 1
      }, trx);

      // Insert 1000 lines (500 debits, 500 credits)
      for (let i = 0; i < linesCount; i++) {
        const isDebit = i % 2 === 0;
        await JournalModel.createLine({
          entryId,
          accountId: isDebit ? 5 : 36, // Inventory / Retained Earnings
          debit: isDebit ? 100 : 0,
          credit: isDebit ? 0 : 100
        }, trx);
      }
    });

    const elapsed = Date.now() - startPost;
    const avgPerLine = elapsed / linesCount;
    console.log(`- Inserted ${linesCount} lines in ${elapsed}ms.`);
    console.log(`- Average time per journal line write: ${avgPerLine.toFixed(2)}ms`);

    if (avgPerLine <= 5.0) {
      console.log(`✅ Journal Posting Throughput: PASSED (Avg: ${avgPerLine.toFixed(2)}ms/line)`);
    } else {
      console.warn(`❌ Journal Posting Throughput: FAILED - Avg: ${avgPerLine.toFixed(2)}ms/line (Target: <5ms/line)`);
      benchmarksPassed = false;
    }

    // Cleanup benchmark run entries
    await db('journal_entries').where('description', 'like', '%Performance Benchmark%').delete();
    console.log("- Cleaned benchmark records from database.");

  } catch (err) {
    console.error(`❌ Journal Posting Benchmark failed: ${err.message}`);
    benchmarksPassed = false;
  }

  console.log("\n=========================================================");
  if (benchmarksPassed) {
    console.log("✅ ALL PERFORMANCE BENCHMARKS PASSED.");
    process.exit(0);
  } else {
    console.warn("❌ BENCHMARKS FAILED: Performance optimizations required.");
    process.exit(1);
  }
}

runBenchmarks();
