const db = require('../src/config/db');

const ALIASES = {
  'salary expense': ['salaries and wages expense', 'payroll expense'],
  'salary payable': ['salaries and wages payable', 'payroll payable'],
  'cash at bank': ['bank', 'cash at bank / bank', 'bank account'],
  'cash': ['cash on hand']
};

async function getOrCreateAccount(companyId, code, name, category, trx) {
  // 1. First try to find by name (case-insensitive) for this company
  const namesToSearch = [name.toLowerCase()];
  const aliasList = ALIASES[name.toLowerCase()];
  if (aliasList) {
    namesToSearch.push(...aliasList);
  }

  const existingByName = await trx('accounts')
    .where({ company_id: companyId })
    .where((qb) => {
      namesToSearch.forEach((n) => qb.orWhereILike('name', n));
    })
    .first();
  if (existingByName) return existingByName.id;

  // 2. If not found by name, check if the desired code is available
  const existingByCode = await trx('accounts')
    .where({ company_id: companyId, code })
    .first();
  
  let targetCode = code;
  if (existingByCode) {
    let counter = 1;
    while (true) {
      const numericCode = parseInt(code) + counter;
      if (!isNaN(numericCode)) {
        targetCode = String(numericCode);
        const taken = await trx('accounts').where({ company_id: companyId, code: targetCode }).first();
        if (!taken) break;
      } else {
        targetCode = `${code}_${counter}`;
        const taken = await trx('accounts').where({ company_id: companyId, code: targetCode }).first();
        if (!taken) break;
      }
      counter++;
    }
  }

  const [newAcc] = await trx('accounts')
    .insert({
      company_id: companyId,
      code: targetCode,
      name,
      category,
      normal_balance: category === 'Expense' ? 'Debit' : 'Credit',
      is_contra: false,
      is_control: false,
      is_postable: true
    })
    .returning('id');

  const newId = typeof newAcc === 'object' ? newAcc.id : newAcc;
  console.log(`Created account: ${name} (${targetCode}) ID: ${newId}`);
  return newId;
}

async function run() {
  console.log("Starting payroll entries repair...");
  await db.transaction(async (trx) => {
    // Find all payroll-related journal entries
    const entries = await trx('journal_entries')
      .whereILike('reference', 'PAY-%')
      .orWhereILike('description', '%Payroll%');

    console.log(`Found ${entries.length} payroll journal entries to inspect.`);

    for (const entry of entries) {
      console.log(`Inspecting Entry ID: ${entry.id}, Reference: ${entry.reference}, Company: ${entry.company_id}`);
      
      // Resolve correct accounts for this company
      const salaryExpId = await getOrCreateAccount(entry.company_id, '5130', 'Salaries and Wages Expense', 'Expense', trx);
      const salaryPayId = await getOrCreateAccount(entry.company_id, '2040', 'Salaries and Wages Payable', 'Liability', trx);
      const taxPayId = await getOrCreateAccount(entry.company_id, '2031', 'Tax Withholding Payable', 'Liability', trx);
      const pfPayId = await getOrCreateAccount(entry.company_id, '2041', 'Provident Fund Payable', 'Liability', trx);
      const eobiPayId = await getOrCreateAccount(entry.company_id, '2051', 'EOBI Payable', 'Liability', trx);
      const ssPayId = await getOrCreateAccount(entry.company_id, '2061', 'Social Security Payable', 'Liability', trx);

      // Get lines for this entry
      const lines = await trx('journal_lines').where({ entry_id: entry.id });

      for (const line of lines) {
        // Find current account code
        const acc = await trx('accounts').where({ id: line.account_id }).first();
        if (!acc) continue;

        let targetId = null;
        if (acc.code === '5110') {
          targetId = salaryExpId;
        } else if (acc.code === '2020') {
          targetId = salaryPayId;
        } else if (acc.code === '2030') {
          targetId = taxPayId;
        } else if (acc.code === '2040') {
          targetId = pfPayId;
        } else if (acc.code === '2050') {
          targetId = eobiPayId;
        } else if (acc.code === '2060') {
          targetId = ssPayId;
        }

        if (targetId && targetId !== line.account_id) {
          await trx('journal_lines')
            .where({ id: line.id })
            .update({ account_id: targetId });
          console.log(`  Updated Line ID: ${line.id} from Account Code ${acc.code} to target account ID ${targetId}`);
        }
      }
    }
  });
  console.log("Repair finished successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("Repair failed:", err);
  process.exit(1);
});
