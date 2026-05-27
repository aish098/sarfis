const db = require('./src/config/db');
const ReportModel = require('./src/models/report.model');
const JournalModel = require('./src/models/journal.model');

async function testContra() {
  try {
    const company = await db('companies').first();
    if (!company) {
      console.log('No company found to test with.');
      process.exit(0);
    }
    const companyId = company.id;

    // Get accounts
    const equipment = await db('accounts').where({ code: '1520', company_id: companyId }).first();
    const accDep = await db('accounts').where({ code: '1521', company_id: companyId }).first();
    
    if (!equipment || !accDep) {
      console.log('Accounts missing');
      process.exit(0);
    }

    console.log(`Testing with Equipment (id: ${equipment.id}, contra: ${equipment.is_contra}, normal_balance: ${equipment.normal_balance})`);
    console.log(`Testing with Acc. Dep. (id: ${accDep.id}, contra: ${accDep.is_contra}, normal_balance: ${accDep.normal_balance})`);

    // Fetch the balance sheet for this company
    const balanceSheet = await ReportModel.getBalanceSheet(companyId, new Date());
    
    const eqRow = balanceSheet.find(a => a.id === equipment.id);
    const accDepRow = balanceSheet.find(a => a.id === accDep.id);

    console.log('--- Current Balance Sheet Stats ---');
    console.log('Equipment:', eqRow ? `Debit: ${eqRow.total_debit}, Credit: ${eqRow.total_credit}` : 'No entries');
    console.log('Acc Dep:', accDepRow ? `Debit: ${accDepRow.total_debit}, Credit: ${accDepRow.total_credit}` : 'No entries');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testContra();
