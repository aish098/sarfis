const db = require('./src/config/db');

const coa_data = [
    ['1000', 'Cash', 'Asset', 'Debit', false],
    ['1100', 'Accounts Receivable', 'Asset', 'Debit', false],
    ['1110', 'Allowance for Doubtful Accounts', 'Asset', 'Credit', true],
    ['1120', 'Interest Receivable', 'Asset', 'Debit', false],
    ['1200', 'Inventory', 'Asset', 'Debit', false],
    ['1300', 'Supplies', 'Asset', 'Debit', false],
    ['1410', 'Prepaid Insurance', 'Asset', 'Debit', false],
    ['1420', 'Prepaid Rent', 'Asset', 'Debit', false],
    ['1510', 'Land', 'Asset', 'Debit', false],
    ['1520', 'Equipment', 'Asset', 'Debit', false],
    ['1521', 'Accumulated Depreciation - Equipment', 'Asset', 'Credit', true],
    ['1530', 'Buildings', 'Asset', 'Debit', false],
    ['1531', 'Accumulated Depreciation - Buildings', 'Asset', 'Credit', true],
    ['1610', 'Copyrights', 'Asset', 'Debit', false],
    ['1620', 'Goodwill', 'Asset', 'Debit', false],
    ['1630', 'Patents', 'Asset', 'Debit', false],
    ['2010', 'Notes Payable', 'Liability', 'Credit', false],
    ['2020', 'Accounts Payable', 'Liability', 'Credit', false],
    ['2030', 'Unearned Service Revenue', 'Liability', 'Credit', false],
    ['2040', 'Salaries and Wages Payable', 'Liability', 'Credit', false],
    ['2050', 'Unearned Rent Revenue', 'Liability', 'Credit', false],
    ['2060', 'Interest Payable', 'Liability', 'Credit', false],
    ['2070', 'Dividends Payable', 'Liability', 'Credit', false],
    ['2080', 'Income Taxes Payable', 'Liability', 'Credit', false],
    ['2090', 'Bonds Payable', 'Liability', 'Credit', false],
    ['2091', 'Discount on Bonds Payable', 'Liability', 'Debit', true],
    ['2092', 'Premium on Bonds Payable', 'Liability', 'Credit', false],
    ['2100', 'Mortgage Payable', 'Liability', 'Credit', false],
    ['3010', "Owner's Capital", 'Equity', 'Credit', false],
    ['3020', "Owner's Drawings", 'Equity', 'Debit', true],
    ['3110', 'Common Stock', 'Equity', 'Credit', false],
    ['3120', 'Paid-in Capital in Excess of Par - Common Stock', 'Equity', 'Credit', false],
    ['3130', 'Preferred Stock', 'Equity', 'Credit', false],
    ['3140', 'Paid-in Capital in Excess of Par - Preferred Stock', 'Equity', 'Credit', false],
    ['3150', 'Treasury Stock', 'Equity', 'Debit', true],
    ['3210', 'Retained Earnings', 'Equity', 'Credit', false],
    ['3310', 'Dividends', 'Equity', 'Debit', true],
    ['3999', 'Income Summary', 'Equity', 'Credit', false],
    ['4010', 'Service Revenue', 'Revenue', 'Credit', false],
    ['4020', 'Sales Revenue', 'Revenue', 'Credit', false],
    ['4021', 'Sales Discounts', 'Revenue', 'Debit', true],
    ['4022', 'Sales Returns and Allowances', 'Revenue', 'Debit', true],
    ['4030', 'Interest Revenue', 'Revenue', 'Credit', false],
    ['4040', 'Gain on Disposal of Plant Assets', 'Revenue', 'Credit', false],
    ['4050', 'Purchase Discounts', 'Revenue', 'Credit', false],
    ['5010', 'Advertising Expense', 'Expense', 'Debit', false],
    ['5020', 'Amortization Expense', 'Expense', 'Debit', false],
    ['5030', 'Bad Debt Expense', 'Expense', 'Debit', false],
    ['5040', 'Cost of Goods Sold', 'Expense', 'Debit', false],
    ['5050', 'Depreciation Expense', 'Expense', 'Debit', false],
    ['5060', 'Freight-Out', 'Expense', 'Debit', false],
    ['5070', 'Income Tax Expense', 'Expense', 'Debit', false],
    ['5080', 'Insurance Expense', 'Expense', 'Debit', false],
    ['5090', 'Interest Expense', 'Expense', 'Debit', false],
    ['5100', 'Loss on Disposal of Plant Assets', 'Expense', 'Debit', false],
    ['5101', 'Loss by Fire', 'Expense', 'Debit', false],
    ['5110', 'Maintenance and Repairs Expense', 'Expense', 'Debit', false],
    ['5120', 'Rent Expense', 'Expense', 'Debit', false],
    ['5130', 'Salaries and Wages Expense', 'Expense', 'Debit', false],
    ['5140', 'Supplies Expense', 'Expense', 'Debit', false],
    ['5150', 'Utilities Expense', 'Expense', 'Debit', false],
    ['1010', 'Bank', 'Asset', 'Debit', false],
];

async function seedCompanyCoa(companyId) {
  console.log(`Seeding COA for company ${companyId}...`);
  try {
    for (const [code, name, category, normal_balance, is_contra] of coa_data) {
      await db.query(
        `INSERT INTO accounts (company_id, code, name, category, normal_balance, is_contra, balance) 
         SELECT $1, $2::VARCHAR(10), $3::VARCHAR(150), $4::VARCHAR(20), $5::VARCHAR(10), $6::BOOLEAN, 0
         WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = $1 AND code = $2)`,
        [companyId, code, name, category, normal_balance, is_contra]
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
