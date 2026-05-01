const db = require('./src/config/db');

const coa_data = [
    ['1000', 'Cash', 'Asset', 'Debit'],
    ['1100', 'Accounts Receivable', 'Asset', 'Debit'],
    ['1110', 'Allowance for Doubtful Accounts', 'Asset', 'Credit'],
    ['1120', 'Interest Receivable', 'Asset', 'Debit'],
    ['1200', 'Inventory', 'Asset', 'Debit'],
    ['1300', 'Supplies', 'Asset', 'Debit'],
    ['1410', 'Prepaid Insurance', 'Asset', 'Debit'],
    ['1420', 'Prepaid Rent', 'Asset', 'Debit'],
    ['1510', 'Land', 'Asset', 'Debit'],
    ['1520', 'Equipment', 'Asset', 'Debit'],
    ['1521', 'Accumulated Depreciation - Equipment', 'Asset', 'Credit'],
    ['1530', 'Buildings', 'Asset', 'Debit'],
    ['1531', 'Accumulated Depreciation - Buildings', 'Asset', 'Credit'],
    ['1610', 'Copyrights', 'Asset', 'Debit'],
    ['1620', 'Goodwill', 'Asset', 'Debit'],
    ['1630', 'Patents', 'Asset', 'Debit'],
    ['2010', 'Notes Payable', 'Liability', 'Credit'],
    ['2020', 'Accounts Payable', 'Liability', 'Credit'],
    ['2030', 'Unearned Service Revenue', 'Liability', 'Credit'],
    ['2040', 'Salaries and Wages Payable', 'Liability', 'Credit'],
    ['2050', 'Unearned Rent Revenue', 'Liability', 'Credit'],
    ['2060', 'Interest Payable', 'Liability', 'Credit'],
    ['2070', 'Dividends Payable', 'Liability', 'Credit'],
    ['2080', 'Income Taxes Payable', 'Liability', 'Credit'],
    ['2090', 'Bonds Payable', 'Liability', 'Credit'],
    ['2091', 'Discount on Bonds Payable', 'Liability', 'Debit'],
    ['2092', 'Premium on Bonds Payable', 'Liability', 'Credit'],
    ['2100', 'Mortgage Payable', 'Liability', 'Credit'],
    ['3010', "Owner's Capital", 'Equity', 'Credit'],
    ['3020', "Owner's Drawings", 'Equity', 'Debit'],
    ['3110', 'Common Stock', 'Equity', 'Credit'],
    ['3120', 'Paid-in Capital in Excess of Par - Common Stock', 'Equity', 'Credit'],
    ['3130', 'Preferred Stock', 'Equity', 'Credit'],
    ['3140', 'Paid-in Capital in Excess of Par - Preferred Stock', 'Equity', 'Credit'],
    ['3150', 'Treasury Stock', 'Equity', 'Debit'],
    ['3210', 'Retained Earnings', 'Equity', 'Credit'],
    ['3310', 'Dividends', 'Equity', 'Debit'],
    ['3999', 'Income Summary', 'Equity', 'Credit'],
    ['4010', 'Service Revenue', 'Revenue', 'Credit'],
    ['4020', 'Sales Revenue', 'Revenue', 'Credit'],
    ['4021', 'Sales Discounts', 'Revenue', 'Debit'],
    ['4022', 'Sales Returns and Allowances', 'Revenue', 'Debit'],
    ['4030', 'Interest Revenue', 'Revenue', 'Credit'],
    ['4040', 'Gain on Disposal of Plant Assets', 'Revenue', 'Credit'],
    ['4050', 'Purchase Discounts', 'Revenue', 'Credit'],
    ['5010', 'Advertising Expense', 'Expense', 'Debit'],
    ['5020', 'Amortization Expense', 'Expense', 'Debit'],
    ['5030', 'Bad Debt Expense', 'Expense', 'Debit'],
    ['5040', 'Cost of Goods Sold', 'Expense', 'Debit'],
    ['5050', 'Depreciation Expense', 'Expense', 'Debit'],
    ['5060', 'Freight-Out', 'Expense', 'Debit'],
    ['5070', 'Income Tax Expense', 'Expense', 'Debit'],
    ['5080', 'Insurance Expense', 'Expense', 'Debit'],
    ['5090', 'Interest Expense', 'Expense', 'Debit'],
    ['5100', 'Loss on Disposal of Plant Assets', 'Expense', 'Debit'],
    ['5101', 'Loss by Fire', 'Expense', 'Debit'],
    ['5110', 'Maintenance and Repairs Expense', 'Expense', 'Debit'],
    ['5120', 'Rent Expense', 'Expense', 'Debit'],
    ['5130', 'Salaries and Wages Expense', 'Expense', 'Debit'],
    ['5140', 'Supplies Expense', 'Expense', 'Debit'],
    ['5150', 'Utilities Expense', 'Expense', 'Debit'],
    ['1010', 'Bank', 'Asset', 'Debit'],
];

async function seedCompanyCoa(companyId) {
  console.log(`Seeding COA for company ${companyId}...`);
  try {
    for (const [code, name, type] of coa_data) {
      await db.query(
        `INSERT INTO accounts (company_id, code, name, type, balance) 
         SELECT $1, $2::VARCHAR(10), $3::VARCHAR(150), $4::VARCHAR(20), 0
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = $1 AND code = $2)`,
        [companyId, code, name, type]
      );
    }
    console.log(`Successfully seeded ${coa_data.length} accounts for company ${companyId}.`);
  } catch (err) {
    console.error(`Error seeding COA for company ${companyId}:`, err);
    throw err;
  }
}

module.exports = { seedCompanyCoa, coa_data };

// CLI support: node seed_coa.js <company_id>
if (require.main === module) {
  const cId = process.argv[2];
  if (cId) {
    seedCompanyCoa(cId)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('Usage: node seed_coa.js <company_id>');
    process.exit(1);
  }
}
