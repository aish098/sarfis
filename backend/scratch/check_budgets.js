const db = require('../src/config/db');

async function run() {
  console.log('=== FULL DIAGNOSTICS DUMP ===');
  try {
    const headers = await db('budget_headers').select('*');
    console.log('\n--- ALL BUDGET HEADERS ---');
    console.log(JSON.stringify(headers, null, 2));

    const instances = await db('workflow_instances').select('*');
    console.log('\n--- ALL WORKFLOW INSTANCES ---');
    console.log(JSON.stringify(instances, null, 2));

    const approvals = await db('workflow_instance_approvals').select('*');
    console.log('\n--- ALL WORKFLOW APPROVALS ---');
    console.log(JSON.stringify(approvals, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
