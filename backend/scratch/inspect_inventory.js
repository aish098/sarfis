const db = require('../src/config/db');

async function checkStages() {
  try {
    const list = await db('workflow_stages').select('*');
    console.log("Workflow Stages:");
    list.forEach(s => {
      console.log(`ID: ${s.id}, Name: ${s.name}, Req Role: ${s.required_role}, Conditions:`, s.conditions);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkStages();
