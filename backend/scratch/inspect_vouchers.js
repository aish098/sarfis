const db = require('../src/config/db');

async function checkWorkflow() {
  try {
    const list = await db('workflow_instances').whereIn('document_id', [108, 109]);
    console.log(`Found ${list.length} workflow instances for journals:`);
    list.forEach(w => {
      console.log(`ID: ${w.id}, Doc Type: ${w.document_type_code}, Doc ID: ${w.document_id}, Status: ${w.status}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkWorkflow();
