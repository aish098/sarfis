require('d:/sarfis/backend/node_modules/dotenv').config({ path: 'd:/sarfis/backend/.env' });
const db = require('../src/config/db');
const jwt = require('d:/sarfis/backend/node_modules/jsonwebtoken');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}/api`;
const PAY_BASE_URL = `${BASE_URL}/payroll`;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const adminToken = jwt.sign(
  { 
    id: 1, 
    email: 'admin@sarfis.com', 
    role: 'Super Admin', 
    permissions: [
      'approval.approve', 'journal.post', 'journal.create', 'journal.view',
      'user.manage', 'settings.manage', 'report.view'
    ] 
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const TEST_PERIOD = '2026-07';
const TEST_DATE = '2026-07-15';

async function runUATPhase5() {
  console.log("=========================================================");
  console.log("             SARFIS ERP UAT - PHASE 5 HR & PAYROLL       ");
  console.log("=========================================================");

  const functionalScoreboard = {};
  const performanceScoreboard = {};
  const evidence = [];

  let totalFunctional = 0;
  let passedFunctional = 0;
  let totalPerformance = 0;
  let passedPerformance = 0;

  function logFunctional(id, name, success, actual, details = "") {
    totalFunctional++;
    evidence.push({ id, type: 'Functional', scenario: name, expected: "PASS", actual: success ? "PASS" : "FAIL", details });
    if (success) {
      passedFunctional++;
      console.log(`✅ [PASS] ${id} - ${name} | ${actual}`);
      functionalScoreboard[id] = 'PASS';
    } else {
      console.error(`❌ [FAIL] ${id} - ${name} | Error: ${details}`);
      functionalScoreboard[id] = 'FAIL';
    }
  }

  function logPerformance(id, name, success, actual, details = "") {
    totalPerformance++;
    evidence.push({ id, type: 'Performance', scenario: name, expected: "PASS", actual: success ? "PASS" : "FAIL", details });
    if (success) {
      passedPerformance++;
      console.log(`⚡ [PASS] ${id} - ${name} | ${actual}`);
      performanceScoreboard[id] = 'PASS';
    } else {
      console.error(`⚡ [FAIL] ${id} - ${name} | Error: ${details}`);
      performanceScoreboard[id] = 'FAIL';
    }
  }

  let employeeId;
  let userId;
  let leaveApplicationId;
  let payrollRunId;
  let salaryExpAccId;

  try {
    // ---------------------------------------------------------
    // PRE-TEST CLEANUP
    // ---------------------------------------------------------
    await db('payroll_lines').delete();
    await db('payroll_runs').delete();
    await db('overtime_records').delete();
    await db('leave_applications').delete();
    await db('leave_balances').delete();
    await db('attendance_logs').delete();
    
    // Clear budget tables to prevent stale/duplicate headers
    await db('budget_control_transactions').delete();
    await db('budget_control_lines').delete();
    await db('budget_headers').delete();
    
    // Clear user override/subscriptions
    await db('employee_notification_subscriptions').delete();

    // Reopen/configure accounting periods
    await db('accounting_periods').where({ company_id: 1 }).delete();
    await db('accounting_periods').insert([
      {
        company_id: 1,
        period_name: 'May 2026',
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        status: 'CLOSED'
      },
      {
        company_id: 1,
        period_name: 'Rest of 2026',
        start_date: '2026-06-01',
        end_date: '2026-12-31',
        status: 'OPEN'
      }
    ]);

    const oldEmp = await db('employees').where({ company_id: 1, name: 'Ahmed Ali' }).first();
    if (oldEmp) {
      await db('employees').where({ id: oldEmp.id }).delete();
    }

    // Resolve or provision linked user
    let user = await db('users').where({ email: 'ahmed@sarfis.com' }).first();
    if (!user) {
      const [newUserId] = await db('users').insert({
        name: 'Ahmed Ali',
        email: 'ahmed@sarfis.com',
        password: 'hashedpassword',
        role: 'Employee'
      }).returning('id');
      userId = typeof newUserId === 'object' ? newUserId.id : newUserId;
    } else {
      userId = user.id;
    }

    // Make sure user role exists
    await db('user_roles').insert({
      user_id: userId,
      company_id: 1,
      role_id: 3 // Employee
    }).onConflict(['user_id', 'company_id', 'role_id']).ignore();

    console.log("- Pre-test HR & Payroll environment initialized.");
  } catch (err) {
    console.error("- Environment initialization error:", err.message);
  }

  // ---------------------------------------------------------
  // UAT-501: Employee Registration
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/employees/1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        name: 'Ahmed Ali',
        role: 'Accountant',
        department: 'Finance',
        salary: 120000,
        bankName: 'Habib Bank Limited',
        accountNumber: 'PK12HABB00010203040506',
        status: 'Active',
        userId: userId
      })
    });
    const data = await res.json();
    employeeId = data.id;

    const audit = await db('transaction_audit_logs')
      .where({ company_id: 1, action: 'CREATE' })
      .orderBy('id', 'desc')
      .first();

    if (res.status === 201 && employeeId && audit) {
      logFunctional('UAT-501', 'Employee Registration', true, 'Ahmed Ali registered. Employee ID generated and user linked.');
    } else {
      logFunctional('UAT-501', 'Employee Registration', false, `Status: ${res.status} | Body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logFunctional('UAT-501', 'Employee Registration', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-502: Employee Update
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/employees/1/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        department: 'Treasury',
        salary: 125000,
        bankName: 'Habib Bank Limited',
        accountNumber: 'PK12HABB00010203040506'
      })
    });
    const data = await res.json();

    const emp = await db('employees').where({ id: employeeId }).first();
    const updatedSalary = parseFloat(emp.salary);

    if (res.status === 200 && emp.department === 'Treasury' && updatedSalary === 125000) {
      logFunctional('UAT-502', 'Employee Update', true, 'Ahmed Ali department updated to Treasury and salary to 125,000.');
    } else {
      logFunctional('UAT-502', 'Employee Update', false, `Status: ${res.status} | Body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    logFunctional('UAT-502', 'Employee Update', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-503: Attendance Logs
  // ---------------------------------------------------------
  try {
    // Record 20 days present (8 hrs/day), 1 half day (4 hrs/day)
    let success = true;
    for (let day = 1; day <= 20; day++) {
      const dateStr = `2026-07-${day.toString().padStart(2, '0')}`;
      const res = await fetch(`${PAY_BASE_URL}/1/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
        body: JSON.stringify({
          employeeId,
          date: dateStr,
          status: 'PRESENT',
          workingHours: 8.00
        })
      });
      if (res.status !== 201) success = false;
    }

    const resHalf = await fetch(`${PAY_BASE_URL}/1/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        employeeId,
        date: '2026-07-21',
        status: 'HALF_DAY',
        workingHours: 4.00
      })
    });
    if (resHalf.status !== 201) success = false;

    // Verify logs
    const logs = await db('attendance_logs').where({ employee_id: employeeId });
    const hours = logs.reduce((sum, l) => sum + parseFloat(l.working_hours), 0);

    if (success && logs.length === 21 && hours === 164) {
      logFunctional('UAT-503', 'Attendance', true, '21 attendance logs created. Working hours total 164.');
    } else {
      logFunctional('UAT-503', 'Attendance', false, `Status verification failed. Log count: ${logs.length}, Total hours: ${hours}`);
    }
  } catch (err) {
    logFunctional('UAT-503', 'Attendance', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-504: Leave Management
  // ---------------------------------------------------------
  try {
    // 1. Submit Annual Leave application (3 days: 2026-07-22 to 2026-07-24)
    const res = await fetch(`${PAY_BASE_URL}/1/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-07-22',
        endDate: '2026-07-24'
      })
    });
    const data = await res.json();
    leaveApplicationId = data.id;

    // 2. Approve leave
    const resApp = await fetch(`${PAY_BASE_URL}/1/leaves/${leaveApplicationId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const dataApp = await resApp.json();

    // Verify leave balance deducted
    const balance = await db('leave_balances')
      .where({ employee_id: employeeId, leave_type: 'ANNUAL' })
      .first();

    const isLeaveApproved = dataApp.status === 'APPROVED';
    const isBalanceDeducted = balance.used_days === 3;

    if (res.status === 201 && resApp.status === 200 && isLeaveApproved && isBalanceDeducted) {
      logFunctional('UAT-504', 'Leave Management', true, '3 days Annual Leave approved. Balance used_days set to 3.');
    } else {
      logFunctional('UAT-504', 'Leave Management', false, `Approval status: ${dataApp.status}, Used days: ${balance?.used_days}`);
    }
  } catch (err) {
    logFunctional('UAT-504', 'Leave Management', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-505: Overtime
  // ---------------------------------------------------------
  try {
    // Record 8 hours overtime
    const res = await fetch(`${PAY_BASE_URL}/1/overtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        employeeId,
        date: '2026-07-25',
        hours: 8.00,
        multiplier: 1.50
      })
    });
    const data = await res.json();

    // Base hourly rate: 125,000 / 160 = 781.25
    // Overtime amount: 8 * 781.25 * 1.50 = 9,375.00
    const otAmount = parseFloat(data.amount);

    if (res.status === 201 && otAmount === 9375.00) {
      logFunctional('UAT-505', 'Overtime', true, '8 hours overtime logged. OT amount calculated: PKR 9,375.00.');
    } else {
      logFunctional('UAT-505', 'Overtime', false, `Status: ${res.status} | Amount: ${otAmount}`);
    }
  } catch (err) {
    logFunctional('UAT-505', 'Overtime', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-506/507/508: Payroll Generation
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${PAY_BASE_URL}/1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({ period: TEST_PERIOD })
    });
    const data = await res.json();
    payrollRunId = data.run.id;

    // Verify lines
    const line = await db('payroll_lines').where({ payroll_run_id: payrollRunId, employee_id: employeeId }).first();

    // Apportionment check
    const basicCorrect = parseFloat(line.basic_salary) === 125000 * 0.60; // 75,000
    const rentCorrect = parseFloat(line.house_rent) === 125000 * 0.25; // 31,250
    const medCorrect = parseFloat(line.medical_allowance) === 125000 * 0.10; // 12,500
    const transCorrect = parseFloat(line.transport_allowance) === 125000 * 0.05; // 6,250
    const componentsPass = basicCorrect && rentCorrect && medCorrect && transCorrect;

    // Deductions check
    const taxCorrect = parseFloat(line.tax_deduction) === 125000 * 0.10; // 12,500
    const pfCorrect = parseFloat(line.pf_deduction) === 75000 * 0.05; // 3,750
    const eobiCorrect = parseFloat(line.eobi_deduction) === 1000.00;
    const ssCorrect = parseFloat(line.social_security_deduction) === 1200.00;
    const deductionsPass = taxCorrect && pfCorrect && eobiCorrect && ssCorrect;

    // Totals check
    const grossCorrect = parseFloat(line.gross_salary) === 125000 + 9375; // 134,375
    const netCorrect = parseFloat(line.net_salary) === 134375 - (12500 + 3750 + 1000 + 1200); // 115,925
    const totalsPass = grossCorrect && netCorrect;

    if (res.status === 201 && componentsPass && deductionsPass && totalsPass) {
      logFunctional('UAT-506', 'Payroll Generation', true, 'Payroll generated for July 2026.');
      logFunctional('UAT-507', 'Salary Components', true, 'Basic, House Rent, Medical, and Transport apportioned correctly.');
      logFunctional('UAT-508', 'Deductions', true, 'Income Tax, Provident Fund, EOBI, and Social Security deducted correctly.');
    } else {
      if (res.status !== 201) {
        logFunctional('UAT-506', 'Payroll Generation', false, `Status: ${res.status} | Body: ${JSON.stringify(data)}`);
      } else {
        logFunctional('UAT-506', 'Payroll Generation', false, 'Calculation Mismatch', JSON.stringify(line));
      }
    }
  } catch (err) {
    logFunctional('UAT-506', 'Payroll Generation', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-509: Payslip PDF
  // ---------------------------------------------------------
  try {
    // Generate Payslip PDF stream
    const res = await fetch(`${PAY_BASE_URL}/1/payslips/${employeeId}/${TEST_PERIOD}`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const buffer = await res.arrayBuffer();

    // Verify it is a valid PDF header (%PDF-1.3 or %PDF-1.4)
    const header = String.fromCharCode(...new Uint8Array(buffer.slice(0, 5)));
    const isPDF = header.startsWith('%PDF-');

    if (res.status === 200 && isPDF) {
      logFunctional('UAT-509', 'Payslip', true, 'Payslip PDF generated successfully.');
    } else {
      logFunctional('UAT-509', 'Payslip', false, `Incorrect status or invalid PDF file header. Status: ${res.status}`);
    }
  } catch (err) {
    logFunctional('UAT-509', 'Payslip', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-510/511: Workflow & GL Posting
  // ---------------------------------------------------------
  try {
    // Create a workflow definition for PAYROLL
    await db('workflow_stages').delete();
    await db('workflow_definitions').delete();

    const [defId] = await db('workflow_definitions').insert({
      company_id: 1,
      document_type_code: 'PAYROLL',
      name: 'UAT Payroll Approval',
      is_active: true
    }).returning('id');
    const cleanDefId = typeof defId === 'object' ? defId.id : defId;

    await db('workflow_stages').insert({
      workflow_definition_id: cleanDefId,
      name: 'CFO Approval',
      stage_sequence: 1,
      required_role: 'Super Admin'
    });

    // 1. Submit to workflow
    const resSub = await fetch(`${PAY_BASE_URL}/1/runs/${payrollRunId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const dataSub = await resSub.json();

    // Verify PENDING_APPROVAL status
    const runPending = await db('payroll_runs').where({ id: payrollRunId }).first();

    // 2. Approve the workflow stage
    const instance = await db('workflow_instances as wi')
      .join('workflow_definitions as wd', 'wi.workflow_definition_id', 'wd.id')
      .where({
        'wi.document_id': payrollRunId,
        'wd.document_type_code': 'PAYROLL'
      })
      .select('wi.*')
      .first();
    const appTask = await db('workflow_instance_approvals').where({ workflow_instance_id: instance.id, status: 'PENDING' }).first();

    const resApp = await fetch(`${BASE_URL}/workflows/review/${instance.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({
        action: 'APPROVE',
        comments: 'UAT Approved Payroll'
      })
    });
    const dataApp = await resApp.json();

    // Verify Posted and GL
    const runPosted = await db('payroll_runs').where({ id: payrollRunId }).first();
    const jeId = runPosted.journal_entry_id;

    // Dr Salary Expense, Cr Payables
    const lines = await db('journal_lines').where({ entry_id: jeId });
    const isGLBalanced = lines.length > 0 && 
                          lines.reduce((sum, l) => sum + parseFloat(l.debit) - parseFloat(l.credit), 0) === 0;

    if (resSub.status === 200 && resApp.status === 200 && runPosted.status === 'POSTED' && isGLBalanced) {
      logFunctional('UAT-510', 'Payroll Workflow', true, 'Payroll routed through CFO approval workflow.');
      logFunctional('UAT-511', 'Payroll Posting', true, 'Payroll posted to GL. balanced double-entry journal created.');
    } else {
      logFunctional('UAT-510', 'Payroll Workflow', false, `SubmitStatus: ${resSub.status}, AppStatus: ${resApp.status}, RunStatus: ${runPosted?.status}`);
    }
  } catch (err) {
    logFunctional('UAT-510', 'Payroll Workflow', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-512: Bank Transfer File
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${PAY_BASE_URL}/1/runs/${payrollRunId}/bank-file`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const text = await res.text();

    const hasHeader = text.includes('Employee Name,IBAN/Account Number,Bank Name,Net Pay');
    const hasNetSalary = text.includes('115925.00');

    if (res.status === 200 && hasHeader && hasNetSalary) {
      logFunctional('UAT-512', 'Bank Transfer File', true, 'Bank CSV payment file generated with net salaries.');
    } else {
      logFunctional('UAT-512', 'Bank Transfer File', false, `Header: ${hasHeader}, NetSalary: ${hasNetSalary}`);
    }
  } catch (err) {
    logFunctional('UAT-512', 'Bank Transfer File', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-513: Employee Notifications
  // ---------------------------------------------------------
  try {
    const notifications = await db('notifications').where({ company_id: 1 }).orderBy('id', 'desc');
    const hasPostedNotif = notifications.some(n => n.message.includes('PAYROLL') || n.message.includes('posted'));

    if (hasPostedNotif) {
      logFunctional('UAT-513', 'Employee Notifications', true, 'Notifications generated upon payroll approval.');
    } else {
      logFunctional('UAT-513', 'Employee Notifications', false, 'No payroll posted notification event logged.');
    }
  } catch (err) {
    logFunctional('UAT-513', 'Employee Notifications', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-514: Budget Integration
  // ---------------------------------------------------------
  try {
    let salaryExpAcc = await db('accounts').where({ code: '5110', company_id: 1 }).first();
    if (!salaryExpAcc) {
      const [newAccId] = await db('accounts').insert({
        company_id: 1,
        code: '5110',
        name: 'Salary Expense',
        category: 'Expense',
        balance: 0.00,
        normal_balance: 'Debit',
        is_contra: false,
        is_control: false,
        is_postable: true
      }).returning('id');
      salaryExpAccId = typeof newAccId === 'object' ? newAccId.id : newAccId;
    } else {
      salaryExpAccId = salaryExpAcc.id;
    }

    // Create a budget header for fiscal year 2026
    const [hId] = await db('budget_headers').insert({
      company_id: 1,
      fiscal_year: '2026',
      name: 'UAT HR Salary Budget 2026',
      status: 'ACTIVE'
    }).returning('id');
    const headerId = typeof hId === 'object' ? hId.id : hId;

    // Create budget control line with 50,000 limit for Salary Expense Account
    await db('budget_control_lines').insert({
      budget_header_id: headerId,
      account_id: salaryExpAccId,
      allocated_amount: 50000,
      control_level: 'BLOCK'
    });

    // Create a new product / run payroll that exceeds it
    const resDraft = await fetch(`${PAY_BASE_URL}/1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' },
      body: JSON.stringify({ period: '2026-08' })
    });
    const draftData = await resDraft.json();
    const overBudgetRunId = draftData.run.id;

    // Attempt to post directly (should fail budget block)
    const resPost = await fetch(`${PAY_BASE_URL}/1/runs/${overBudgetRunId}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const postData = await resPost.json();

    const isBlocked = resPost.status === 400 && postData.error && postData.error.includes('exceeds budget');

    if (isBlocked) {
      logFunctional('UAT-514', 'Budget Integration', true, 'Salary purchase exceeding budget blocked.');
    } else {
      logFunctional('UAT-514', 'Budget Integration', false, "Budget block check bypassed!", `Status: ${resPost.status} | Body: ${JSON.stringify(postData)}`);
    }
  } catch (err) {
    logFunctional('UAT-514', 'Budget Integration', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-515: Closed Period
  // ---------------------------------------------------------
  try {
    // Attempting to post payroll run to May 2026 (closed period)
    const resDraft = await db('payroll_runs').insert({
      company_id: 1,
      period: '2026-05',
      status: 'DRAFT',
      total_gross: 120000,
      created_by: 1
    }).returning('id');
    const closedRunId = typeof resDraft[0] === 'object' ? resDraft[0].id : resDraft[0];

    const resPost = await fetch(`${PAY_BASE_URL}/1/runs/${closedRunId}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const postData = await resPost.json();

    const isBlocked = resPost.status === 400 && postData.error && 
                      (postData.error.includes('period') || postData.error.includes('locked') || postData.error.includes('closed'));

    if (isBlocked) {
      logFunctional('UAT-515', 'Closed Period', true, 'Payroll posting into closed accounting period blocked.');
    } else {
      logFunctional('UAT-515', 'Closed Period', false, "Bypassed period lock!", `Status: ${resPost.status} | Body: ${JSON.stringify(postData)}`);
    }
  } catch (err) {
    logFunctional('UAT-515', 'Closed Period', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-516: Payroll Reversal
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${PAY_BASE_URL}/1/runs/${payrollRunId}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const data = await res.json();

    const run = await db('payroll_runs').where({ id: payrollRunId }).first();

    if (res.status === 200 && run.status === 'REVERSED') {
      logFunctional('UAT-516', 'Payroll Reversal', true, 'Payroll run reversed successfully. Status updated to REVERSED.');
    } else {
      logFunctional('UAT-516', 'Payroll Reversal', false, `Status: ${res.status} | Run status: ${run?.status}`);
    }
  } catch (err) {
    logFunctional('UAT-516', 'Payroll Reversal', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-517: Reports
  // ---------------------------------------------------------
  try {
    const res = await fetch(`${PAY_BASE_URL}/1/reports/register`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const runs = await res.json();

    const hasRegisterData = Array.isArray(runs) && runs.length > 0;

    if (res.status === 200 && hasRegisterData) {
      logFunctional('UAT-517', 'Reports', true, 'Payroll Register and department reports fetched successfully.');
    } else {
      logFunctional('UAT-517', 'Reports', false, `Failed to load reports. Status: ${res.status}`);
    }
  } catch (err) {
    logFunctional('UAT-517', 'Reports', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-518: Audit Trail
  // ---------------------------------------------------------
  try {
    const audits = await db('transaction_audit_logs').where({ company_id: 1 });
    const hasWorkflowAudits = audits.some(a => a.description.includes('payroll') || a.description.includes('Payroll'));

    if (hasWorkflowAudits) {
      logFunctional('UAT-518', 'Audit Trail', true, 'Audit log generated for payroll lifecycles.');
    } else {
      logFunctional('UAT-518', 'Audit Trail', false, 'No payroll events logged in audit trail.');
    }
  } catch (err) {
    logFunctional('UAT-518', 'Audit Trail', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-519: Performance SLAs
  // ---------------------------------------------------------
  try {
    // Measure Payslip time
    const tPayslip0 = performance.now();
    await fetch(`${PAY_BASE_URL}/1/payslips/${employeeId}/${TEST_PERIOD}`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const tPayslip1 = performance.now();
    const payslipTime = tPayslip1 - tPayslip0;

    logPerformance('UAT-519a', 'Payslip PDF API Response Time', payslipTime < 300, `${payslipTime.toFixed(2)}ms (SLA: <300ms)`);

    // Measure Employee List time
    const tEmp0 = performance.now();
    await fetch(`${BASE_URL}/employees/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'x-company-id': '1' }
    });
    const tEmp1 = performance.now();
    const empTime = tEmp1 - tEmp0;

    logPerformance('UAT-519b', 'Employee List API Response Time', empTime < 300, `${empTime.toFixed(2)}ms (SLA: <300ms)`);
  } catch (err) {
    logPerformance('UAT-519', 'Performance SLAs', false, 'Execution failed', err.message);
  }

  // ---------------------------------------------------------
  // UAT-520: Integrated End-to-End Lifecycle
  // ---------------------------------------------------------
  const isE2EPassed = totalFunctional === passedFunctional;
  logFunctional('UAT-520', 'End-to-End Payroll Lifecycle', isE2EPassed, 'Integrated hiring-to-payment lifecycle fully verified.');

  // ---------------------------------------------------------
  // FINAL SCOREBOARD SUMMARY
  // ---------------------------------------------------------
  console.log("\n=========================================================");
  console.log("                UAT PHASE 5 SCOREBOARD                   ");
  console.log("=========================================================");
  console.log("FUNCTIONAL UAT:");
  Object.entries(functionalScoreboard).forEach(([id, status]) => {
    console.log(`${id.padEnd(10)}: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  });
  console.log("\nPERFORMANCE UAT:");
  Object.entries(performanceScoreboard).forEach(([id, status]) => {
    console.log(`${id.padEnd(10)}: ${status === 'PASS' ? '⚡ PASS' : '❌ FAIL'}`);
  });

  const finalFunctionalPercent = Math.round((passedFunctional / totalFunctional) * 100);
  console.log("---------------------------------------------------------");
  console.log(`FUNCTIONAL PASS RATE  : ${finalFunctionalPercent}%`);
  console.log("=========================================================");

  if (passedFunctional === totalFunctional) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runUATPhase5();
