const db = require('../src/config/db');
const JournalModel = require('../src/models/journal.model');

async function testInsert() {
  try {
    const id = await JournalModel.createEntry({
      companyId: 1,
      entryDate: new Date(),
      description: 'Test Status Creation',
      status: 'POSTED',
      userId: 1
    });
    const entry = await db('journal_entries').where({ id }).first();
    console.log("Created Journal Entry ID:", id);
    console.log("Saved Status:", entry.status);
    
    // Cleanup
    await db('journal_entries').where({ id }).delete();
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

testInsert();
