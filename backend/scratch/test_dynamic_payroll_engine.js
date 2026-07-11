const db = require('../src/config/db');
const PayrollService = require('../src/services/payroll.service');

async function runTests() {
  console.log('=== RUNNING CONFIGURABLE PAYROLL ENGINE INTEGRATION TESTS ===');
  
  try {
    const companyId = 2; // Workspace default company
    
    // 1. Find or create an active employee
    let emp = await db('employees').where({ company_id: companyId, status: 'Active' }).first();
    if (!emp) {
      console.log('No active employee found. Seeding test employee...');
      const [newEmp] = await db('employees').insert({
        company_id: companyId,
        name: 'John Doe',
        salary: 120000.00,
        status: 'Active'
      }).returning('*');
      emp = newEmp;
    }
    
    console.log(`Using active employee: ${emp.name} (Salary: PKR ${emp.salary})`);
    
    // Clean old mappings to start fresh
    await db('employee_salary_components').where({ employee_id: emp.id }).delete();
    await db('employees').where({ id: emp.id }).update({ salary_structure_id: null });
    await db('salary_structures').where({ company_id: companyId, code: 'TEST_STRUCTURE' }).delete();
    await db('payroll_runs').where({ company_id: companyId, period: '2026-08' }).delete();

    // 2. Resolve default components for this company
    const basicComp = await db('salary_components').where({ company_id: companyId, code: 'BASIC' }).first();
    const hraComp = await db('salary_components').where({ company_id: companyId, code: 'HRA' }).first();
    const medComp = await db('salary_components').where({ company_id: companyId, code: 'MED' }).first();
    const transComp = await db('salary_components').where({ company_id: companyId, code: 'TRANS' }).first();
    const taxComp = await db('salary_components').where({ company_id: companyId, code: 'TAX' }).first();
    const pfComp = await db('salary_components').where({ company_id: companyId, code: 'PF' }).first();
    const eobiComp = await db('salary_components').where({ company_id: companyId, code: 'EOBI' }).first();
    const ssComp = await db('salary_components').where({ company_id: companyId, code: 'SS' }).first();

    if (!basicComp) {
      throw new Error('Default components not seeded. Run seeder script first.');
    }

    // 3. Create a custom Salary Structure (Template)
    const [structIdObj] = await db('salary_structures').insert({
      company_id: companyId,
      code: 'TEST_STRUCTURE',
      name: 'Custom Testing Structure',
      description: 'Used for dynamic formula evaluation UAT'
    }).returning('id');
    const structureId = typeof structIdObj === 'object' ? structIdObj.id : structIdObj;
    
    console.log(`Created Salary Structure Template ID: ${structureId}`);

    // Map template components
    // BASIC: 55%, HRA: 30%, MED: 10%, TRANS: 5% (Total 100%)
    await db('salary_structure_components').insert([
      { structure_id: structureId, component_id: basicComp.id, value: 0.55 },
      { structure_id: structureId, component_id: hraComp.id, value: 0.30 },
      { structure_id: structureId, component_id: medComp.id, value: 0.10 },
      { structure_id: structureId, component_id: transComp.id, value: 0.05 },
      { structure_id: structureId, component_id: taxComp.id, value: 0.00 }, // Managed by formula
      { structure_id: structureId, component_id: pfComp.id, value: 0.00 },  // Managed by formula
      { structure_id: structureId, component_id: eobiComp.id, value: 1000.00 }, // Fixed
      { structure_id: structureId, component_id: ssComp.id, value: 1200.00 }   // Fixed
    ]);
    console.log('Seeded structure components mappings.');

    // Assign Employee to Structure
    await db('employees').where({ id: emp.id }).update({ salary_structure_id: structureId });
    console.log(`Assigned employee ${emp.name} to template.`);

    // 4. Test UAT-529: Apply an individual component override
    // Override HRA (Rent) from 30% to 35%
    await db('employee_salary_components').insert({
      employee_id: emp.id,
      component_id: hraComp.id,
      value: 0.35
    });
    console.log('Applied employee-level component override for HRA (35% override).');

    // 5. Generate Payroll Run
    console.log('\nRunning payroll generation engine for period 2026-08...');
    const result = await PayrollService.generatePayrollRun(companyId, '2026-08', 1);
    console.log(`Payroll generation completed. Created Run ID: ${result.run.id}`);

    // 6. Fetch payroll lines and verify snapshots
    const line = await db('payroll_lines').where({ payroll_run_id: result.run.id, employee_id: emp.id }).first();
    if (!line) throw new Error('Payroll line not found!');

    console.log('\n--- VERIFYING COMPUTED PAYOUT VALUES ---');
    const salary = parseFloat(emp.salary);
    const expectedBasic = salary * 0.55; // 55% from template
    const expectedRent = salary * 0.35;  // 35% from override (precedence check!)
    const expectedMed = salary * 0.10;   // 10% from template
    const expectedTrans = salary * 0.05; // 5% from template
    const expectedTax = salary * 0.10;   // 10% on gross (gross is 120,000 > 100,000)
    const expectedPF = expectedBasic * 0.05; // 5% of basic salary
    const expectedEOBI = 1000.00;
    const expectedSS = 1200.00;

    console.log(`Salary: PKR ${salary}`);
    console.log(`Basic Salary: Calculated PKR ${parseFloat(line.basic_salary)} | Expected PKR ${expectedBasic}`);
    console.log(`House Rent:   Calculated PKR ${parseFloat(line.house_rent)} | Expected PKR ${expectedRent}`);
    console.log(`Medical:      Calculated PKR ${parseFloat(line.medical_allowance)} | Expected PKR ${expectedMed}`);
    console.log(`Tax Deduct:   Calculated PKR ${parseFloat(line.tax_deduction)} | Expected PKR ${expectedTax}`);
    console.log(`PF Deduct:    Calculated PKR ${parseFloat(line.pf_deduction)} | Expected PKR ${expectedPF}`);

    if (Math.abs(parseFloat(line.basic_salary) - expectedBasic) > 0.01) throw new Error('Basic Salary calculation mismatch!');
    if (Math.abs(parseFloat(line.house_rent) - expectedRent) > 0.01) throw new Error('HRA Override precedence failed!');
    if (Math.abs(parseFloat(line.tax_deduction) - expectedTax) > 0.01) throw new Error('Formula execution context or evaluation failed!');
    
    console.log('✅ Calculation and Precedence Assertions PASSED.');

    // 7. Verify snapshots in payroll_line_details
    console.log('\n--- VERIFYING AUDIT SNAPSHOTS (payroll_line_details) ---');
    const details = await db('payroll_line_details').where({ payroll_line_id: line.id }).orderBy('display_order', 'asc');
    
    for (const d of details) {
      console.log(`Component: ${d.component_code} | Source: ${d.source} | Calculated Amount: PKR ${parseFloat(d.amount)}`);
      
      if (d.component_code === 'HRA' && d.source !== 'EMPLOYEE_OVERRIDE') {
        throw new Error('HRA component source not snapshotted as EMPLOYEE_OVERRIDE!');
      }
      if (d.component_code === 'BASIC' && d.source !== 'STRUCTURE') {
        throw new Error('Basic component source not snapshotted as STRUCTURE!');
      }
    }
    console.log('✅ Audit Snapshot Assertions PASSED.');

    // Clean up
    await db('employee_salary_components').where({ employee_id: emp.id }).delete();
    await db('employees').where({ id: emp.id }).update({ salary_structure_id: null });
    await db('salary_structures').where({ id: structureId }).delete();
    await db('payroll_runs').where({ id: result.run.id }).delete();

    console.log('\n✅ ALL CONFIGURABLE PAYROLL ENGINE TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TESTING FAILED:', err);
    process.exit(1);
  }
}

runTests();
