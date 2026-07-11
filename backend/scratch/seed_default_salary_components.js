const db = require('../src/config/db');

async function resolveAccount(companyId, code, name, category, trx = db) {
  const existing = await trx('accounts').where({ company_id: companyId, code }).first();
  if (existing) return existing.id;

  const [newAcc] = await trx('accounts')
    .insert({
      company_id: companyId,
      code,
      name,
      category,
      normal_balance: category === 'Expense' ? 'Debit' : 'Credit',
      is_contra: false,
      is_control: false,
      is_postable: true
    })
    .returning('id');

  return typeof newAcc === 'object' ? newAcc.id : newAcc;
}

async function seed() {
  console.log('=== SEEDING SALARY COMPONENTS ===');

  try {
    const companies = await db('companies').select('id');
    console.log(`Discovered ${companies.length} companies to seed default components.`);

    for (const c of companies) {
      const companyId = c.id;
      console.log(`Processing Company ID: ${companyId}...`);

      const salaryExpAccId = await resolveAccount(companyId, '5110', 'Salary Expense', 'Expense');
      const taxPayAccId = await resolveAccount(companyId, '2030', 'Tax Withholding Payable', 'Liability');
      const pfPayAccId = await resolveAccount(companyId, '2040', 'Provident Fund Payable', 'Liability');
      const eobiPayAccId = await resolveAccount(companyId, '2050', 'EOBI Payable', 'Liability');
      const ssPayAccId = await resolveAccount(companyId, '2060', 'Social Security Payable', 'Liability');

      const defaultComponents = [
        {
          company_id: companyId,
          code: 'BASIC',
          name: 'Basic Salary',
          type: 'EARNING',
          category: 'BASIC',
          calculation_type: 'PERCENTAGE',
          formula_expression: null,
          default_value: 0.60,
          taxable: true,
          is_pf: false,
          gl_account_id: salaryExpAccId,
          sequence_no: 10,
          display_order: 10,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'HRA',
          name: 'House Rent Allowance',
          type: 'EARNING',
          category: 'ALLOWANCE',
          calculation_type: 'PERCENTAGE',
          formula_expression: null,
          default_value: 0.25,
          taxable: true,
          is_pf: false,
          gl_account_id: salaryExpAccId,
          sequence_no: 20,
          display_order: 20,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'MED',
          name: 'Medical Allowance',
          type: 'EARNING',
          category: 'ALLOWANCE',
          calculation_type: 'PERCENTAGE',
          formula_expression: null,
          default_value: 0.10,
          taxable: true,
          is_pf: false,
          gl_account_id: salaryExpAccId,
          sequence_no: 30,
          display_order: 30,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'TRANS',
          name: 'Transport Allowance',
          type: 'EARNING',
          category: 'ALLOWANCE',
          calculation_type: 'PERCENTAGE',
          formula_expression: null,
          default_value: 0.05,
          taxable: true,
          is_pf: false,
          gl_account_id: salaryExpAccId,
          sequence_no: 40,
          display_order: 40,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'TAX',
          name: 'Income Tax',
          type: 'DEDUCTION',
          category: 'TAX',
          calculation_type: 'FORMULA',
          formula_expression: 'if(gross > 100000, gross * 0.10, 0)',
          default_value: 0.00,
          taxable: false,
          is_pf: false,
          gl_account_id: taxPayAccId,
          sequence_no: 70,
          display_order: 70,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'PF',
          name: 'Provident Fund',
          type: 'DEDUCTION',
          category: 'PF',
          calculation_type: 'FORMULA',
          formula_expression: 'basic * 0.05',
          default_value: 0.00,
          taxable: false,
          is_pf: true,
          gl_account_id: pfPayAccId,
          sequence_no: 60,
          display_order: 60,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'EOBI',
          name: 'EOBI Contribution',
          type: 'DEDUCTION',
          category: 'EOBI',
          calculation_type: 'FIXED',
          formula_expression: null,
          default_value: 1000.00,
          taxable: false,
          is_pf: false,
          gl_account_id: eobiPayAccId,
          sequence_no: 80,
          display_order: 80,
          is_active: true
        },
        {
          company_id: companyId,
          code: 'SS',
          name: 'Social Security',
          type: 'DEDUCTION',
          category: 'SOCIAL_SECURITY',
          calculation_type: 'FIXED',
          formula_expression: null,
          default_value: 1200.00,
          taxable: false,
          is_pf: false,
          gl_account_id: ssPayAccId,
          sequence_no: 90,
          display_order: 90,
          is_active: true
        }
      ];

      for (const comp of defaultComponents) {
        await db('salary_components')
          .insert(comp)
          .onConflict(['company_id', 'code'])
          .ignore();
      }
    }

    console.log('✅ SALARY COMPONENTS SEEDED SUCCESSFULLY.');
    process.exit(0);
  } catch (err) {
    console.error('❌ SEEDING FAILED:', err);
    process.exit(1);
  }
}

seed();
