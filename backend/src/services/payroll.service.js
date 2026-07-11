const db = require('../config/db');
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const PostingEngineService = require('./posting_engine.service');
const JournalService = require('./journal.service');
const NotificationService = require('./notification.service');
const PDFDocument = require('pdfkit');
function evaluateFormula(expression, context) {
  let expr = expression;
  const variablesUsed = {};
  const keys = Object.keys(context);
  keys.sort((a, b) => b.length - a.length);
  
  for (const key of keys) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    if (regex.test(expr)) {
      variablesUsed[key] = context[key];
      expr = expr.replace(regex, context[key]);
    }
  }
  
  expr = expr.replace(/IF\s*\(/gi, 'if(');
  expr = expr.replace(/MIN\s*\(/gi, 'Math.min(');
  expr = expr.replace(/MAX\s*\(/gi, 'Math.max(');
  expr = expr.replace(/ABS\s*\(/gi, 'Math.abs(');
  expr = expr.replace(/CEIL\s*\(/gi, 'Math.ceil(');
  expr = expr.replace(/FLOOR\s*\(/gi, 'Math.floor(');
  expr = expr.replace(/ROUND\s*\(([^,]+),\s*([^)]+)\)/gi, '(Math.round(($1) * Math.pow(10, $2)) / Math.pow(10, $2))');

  let parsedExpr = expr;

  if (expr.startsWith('if(') || expr.startsWith('if (')) {
    const startIdx = expr.indexOf('(');
    const content = expr.substring(startIdx + 1, expr.lastIndexOf(')'));
    const parts = [];
    let bracketCount = 0;
    let currentPart = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '(') bracketCount++;
      else if (char === ')') bracketCount--;
      
      if (char === ',' && bracketCount === 0) {
        parts.push(currentPart.trim());
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart.trim());
    
    if (parts.length === 3) {
      expr = `(${parts[0]}) ? (${parts[1]}) : (${parts[2]})`;
    }
  }

  try {
    const result = new Function(`return (${expr});`)();
    const numResult = parseFloat(result) || 0;
    return {
      result: numResult,
      trace: {
        formula: expression,
        variables: variablesUsed,
        steps: [
          {
            operation: "Evaluate",
            expression: parsedExpr,
            result: numResult
          }
        ],
        result: numResult
      }
    };
  } catch (err) {
    console.error(`[Formula Evaluator] Failed to evaluate: "${expression}" (parsed as "${expr}"):`, err);
    return {
      result: 0,
      trace: {
        formula: expression,
        variables: variablesUsed,
        steps: [
          {
            operation: "Error",
            expression: expr,
            result: 0,
            error: err.message
          }
        ],
        result: 0
      }
    };
  }
}

class PayrollService {
  /**
   * Record employee daily attendance
   */
  static async recordAttendance(companyId, { employeeId, date, status, workingHours = 8.00 }) {
    if (!employeeId || !date || !status) {
      throw new Error('Employee ID, date, and status are required.');
    }
    const cleanStatus = status.toUpperCase();
    if (!['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'].includes(cleanStatus)) {
      throw new Error('Invalid attendance status.');
    }

    // Check if payroll period is locked (POSTED payroll run exists)
    const period = date.substring(0, 7);
    await this.assertPeriodNotLocked(companyId, period);

    const [log] = await db('attendance_logs')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        date,
        status: cleanStatus,
        working_hours: parseFloat(workingHours)
      })
      .onConflict(['employee_id', 'date'])
      .merge({
        status: cleanStatus,
        working_hours: parseFloat(workingHours),
        updated_at: db.fn.now()
      })
      .returning('*');

    return log;
  }

  /**
   * Submit a leave application
   */
  static async submitLeaveRequest(companyId, { employeeId, leaveType, startDate, endDate }) {
    if (!employeeId || !leaveType || !startDate || !endDate) {
      throw new Error('Employee ID, leave type, start date, and end date are required.');
    }
    const cleanType = leaveType.toUpperCase();
    if (!['ANNUAL', 'SICK', 'CASUAL'].includes(cleanType)) {
      throw new Error('Invalid leave type.');
    }

    const period = startDate.substring(0, 7);
    await this.assertPeriodNotLocked(companyId, period);

    // Calculate requested days (inclusive)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    if (timeDiff < 0) throw new Error('End date must be on or after start date.');
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    // Check leave balances to prevent over-allocation
    let bal = await db('leave_balances')
      .where({ company_id: companyId, employee_id: employeeId, leave_type: cleanType })
      .first();

    if (!bal) {
      // Provision default balances if missing
      const defaultAllocations = { ANNUAL: 20, SICK: 10, CASUAL: 10 };
      const [newBal] = await db('leave_balances')
        .insert({
          company_id: companyId,
          employee_id: employeeId,
          leave_type: cleanType,
          allocated_days: defaultAllocations[cleanType] || 10,
          used_days: 0
        })
        .returning('*');
      bal = newBal;
    }

    const available = bal.allocated_days - bal.used_days;
    if (days > available) {
      throw new Error(`Insufficient leave balance. Requested: ${days} days, Available: ${available} days.`);
    }

    const [app] = await db('leave_applications')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        leave_type: cleanType,
        start_date: startDate,
        end_date: endDate,
        days,
        status: 'PENDING'
      })
      .returning('*');

    return app;
  }

  /**
   * Approve a leave application and update used balances
   */
  static async approveLeaveRequest(companyId, requestId, userId) {
    return await db.transaction(async trx => {
      const app = await trx('leave_applications')
        .where({ id: requestId, company_id: companyId })
        .first();

      if (!app) throw new Error('Leave application not found.');
      if (app.status !== 'PENDING') throw new Error('Only PENDING leave applications can be approved.');

      const period = app.start_date.toISOString ? app.start_date.toISOString().substring(0, 7) : app.start_date.substring(0, 7);
      await this.assertPeriodNotLocked(companyId, period, trx);

      // Increment used days in balance
      await trx('leave_balances')
        .where({ company_id: companyId, employee_id: app.employee_id, leave_type: app.leave_type })
        .increment('used_days', app.days);

      const [updated] = await trx('leave_applications')
        .where({ id: requestId })
        .update({
          status: 'APPROVED',
          updated_at: trx.fn.now()
        })
        .returning('*');

      return updated;
    });
  }

  /**
   * Record employee overtime hours
   */
  static async recordOvertime(companyId, { employeeId, date, hours, multiplier = 1.50 }) {
    if (!employeeId || !date || !hours) {
      throw new Error('Employee ID, date, and hours are required.');
    }

    const period = date.substring(0, 7);
    await this.assertPeriodNotLocked(companyId, period);

    const emp = await db('employees').where({ id: employeeId, company_id: companyId }).first();
    if (!emp) throw new Error('Employee not found.');

    // Calculate OT amount
    const hourlyBase = parseFloat(emp.salary) / 160.00;
    const amount = parseFloat(hours) * hourlyBase * parseFloat(multiplier);

    const [ot] = await db('overtime_records')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        date,
        hours: parseFloat(hours),
        multiplier: parseFloat(multiplier),
        amount,
        status: 'APPROVED' // Auto-approved for UAT
      })
      .returning('*');

    return ot;
  }

  /**
   * Resolve leave balance details
   */
  static async getLeaveBalances(companyId, employeeId) {
    const defaultTypes = ['ANNUAL', 'SICK', 'CASUAL'];
    const defaultAllocations = { ANNUAL: 20, SICK: 10, CASUAL: 10 };

    for (const type of defaultTypes) {
      const existing = await db('leave_balances')
        .where({ company_id: companyId, employee_id: employeeId, leave_type: type })
        .first();

      if (!existing) {
        await db('leave_balances').insert({
          company_id: companyId,
          employee_id: employeeId,
          leave_type: type,
          allocated_days: defaultAllocations[type],
          used_days: 0
        });
      }
    }

    return await db('leave_balances')
      .where({ company_id: companyId, employee_id: employeeId })
      .orderBy('leave_type', 'asc');
  }

  /**
   * Lock check to block employee profile/operational modifications if period payroll is posted
   */
  static async assertPeriodNotLocked(companyId, period, trx = db) {
    const run = await trx('payroll_runs')
      .where({ company_id: companyId, period, status: 'POSTED' })
      .first();

    if (run) {
      throw new Error(`Operational modifications blocked. Payroll period ${period} has already been posted and finalized.`);
    }
  }

  /**
   * Generate Draft Payroll Run
   */
  static async generatePayrollRun(companyId, period, userId) {
    if (!period) throw new Error('Payroll period (YYYY-MM) is required.');

    return await db.transaction(async (trx) => {
      // Check if active run exists
      const existing = await trx('payroll_runs')
        .where({ company_id: companyId, period })
        .whereIn('status', ['DRAFT', 'PENDING_APPROVAL', 'POSTED'])
        .first();

      if (existing) {
        throw new Error(`Payroll run for period ${period} already exists.`);
      }

      // Fetch active employees
      const employees = await trx('employees')
        .where({ company_id: companyId, status: 'Active' });

      if (employees.length === 0) {
        throw new Error('No active employees found to process.');
      }

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      const lines = [];

      for (const emp of employees) {
        const salary = parseFloat(emp.salary);

        // Sum overtime approved for this period
        const otSum = await trx('overtime_records')
          .where({ employee_id: emp.id, company_id: companyId, status: 'APPROVED' })
          .andWhereRaw("to_char(date, 'YYYY-MM') = ?", [period])
          .sum('amount as total')
          .first();
        const otAmt = parseFloat(otSum?.total || 0);

        // Fetch salary structure components
        let compMappings = [];
        if (emp.salary_structure_id) {
          compMappings = await trx('salary_structure_components as ssc')
            .join('salary_components as sc', 'ssc.component_id', 'sc.id')
            .where('ssc.structure_id', emp.salary_structure_id)
            .where('sc.is_active', true)
            .select('sc.*', 'ssc.value as template_value', trx.raw("'STRUCTURE' as source"));
        }

        // Fetch employee direct overrides
        const overrides = await trx('employee_salary_components as esc')
          .join('salary_components as sc', 'esc.component_id', 'sc.id')
          .where('esc.employee_id', emp.id)
          .where('sc.is_active', true)
          .select('sc.*', 'esc.value as override_value', trx.raw("'EMPLOYEE_OVERRIDE' as source"));

        // Combine structure and overrides (overrides overwrite templates)
        const componentMap = {};
        for (const comp of compMappings) {
          componentMap[comp.code] = {
            ...comp,
            value: parseFloat(comp.template_value),
            source: 'STRUCTURE'
          };
        }
        for (const comp of overrides) {
          componentMap[comp.code] = {
            ...comp,
            value: parseFloat(comp.override_value),
            source: 'EMPLOYEE_OVERRIDE'
          };
        }

        const activeComponents = Object.values(componentMap);

        let basic = 0;
        let rent = 0;
        let med = 0;
        let trans = 0;
        let tax = 0;
        let pf = 0;
        let eobi = 0;
        let ss = 0;
        let gross = 0;
        let deduct = 0;
        let net = 0;
        const details = [];

        if (activeComponents.length > 0) {
          // Sort by sequence_no for deterministic calculations
          activeComponents.sort((a, b) => a.sequence_no - b.sequence_no);

          const context = {
            salary: salary,
            ot: otAmt,
            basic: 0,
            gross: salary + otAmt,
            net: 0
          };

          for (const comp of activeComponents) {
            let amount = 0;
            let trace = null;

            if (comp.calculation_type === 'FIXED') {
              amount = comp.value;
              trace = {
                formula: null,
                variables: {},
                steps: [{ operation: "Fixed value", expression: String(comp.value), result: amount }],
                result: amount
              };
            } else if (comp.calculation_type === 'PERCENTAGE') {
              amount = context.salary * comp.value;
              trace = {
                formula: `salary * ${comp.value}`,
                variables: { salary: context.salary },
                steps: [{ operation: "Multiply percentage", expression: `${context.salary} * ${comp.value}`, result: amount }],
                result: amount
              };
            } else if (comp.calculation_type === 'FORMULA' && comp.formula_expression) {
              const evalRes = evaluateFormula(comp.formula_expression, context);
              amount = evalRes.result;
              trace = evalRes.trace;
            }

            if (comp.code === 'BASIC') {
              basic = amount;
              context.basic = amount;
            } else if (comp.code === 'HRA') {
              rent = amount;
            } else if (comp.code === 'MED') {
              med = amount;
            } else if (comp.code === 'TRANS') {
              trans = amount;
            } else if (comp.code === 'TAX') {
              tax = amount;
            } else if (comp.code === 'PF') {
              pf = amount;
            } else if (comp.code === 'EOBI') {
              eobi = amount;
            } else if (comp.code === 'SS') {
              ss = amount;
            }

            details.push({
              component_id: comp.id,
              component_name: comp.name,
              component_code: comp.code,
              component_type: comp.type,
              calculation_type: comp.calculation_type,
              source: comp.source,
              formula_used: comp.calculation_type === 'FORMULA' ? comp.formula_expression : null,
              formula_trace: trace,
              rate: comp.calculation_type === 'PERCENTAGE' ? comp.value : null,
              base_amount: comp.calculation_type === 'PERCENTAGE' ? context.salary : null,
              amount: amount,
              gl_account_id: comp.gl_account_id,
              display_order: comp.display_order
            });
          }

          gross = salary + otAmt;
          deduct = tax + pf + eobi + ss;
          net = gross - deduct;
        } else {
          // Legacy Fallback
          basic = salary * 0.60;
          rent = salary * 0.25;
          med = salary * 0.10;
          trans = salary * 0.05;
          tax = salary > 100000 ? salary * 0.10 : 0.00;
          pf = basic * 0.05;
          eobi = 1000.00;
          ss = 1200.00;

          gross = salary + otAmt;
          deduct = tax + pf + eobi + ss;
          net = gross - deduct;
        }

        totalGross += gross;
        totalDeductions += deduct;
        totalNet += net;

        lines.push({
          employee_id: emp.id,
          basic_salary: basic,
          house_rent: rent,
          medical_allowance: med,
          transport_allowance: trans,
          overtime_amount: otAmt,
          tax_deduction: tax,
          pf_deduction: pf,
          eobi_deduction: eobi,
          social_security_deduction: ss,
          gross_salary: gross,
          net_salary: net,
          details
        });
      }

      const [run] = await trx('payroll_runs')
        .insert({
          company_id: companyId,
          period,
          status: 'DRAFT',
          total_gross: totalGross,
          total_deductions: totalDeductions,
          total_net: totalNet,
          created_by: userId
        })
        .returning('*');

      for (const line of lines) {
        const { details, ...lineData } = line;
        const [insertedLine] = await trx('payroll_lines')
          .insert({
            ...lineData,
            payroll_run_id: run.id
          })
          .returning('*');
        
        const lineId = typeof insertedLine === 'object' ? insertedLine.id : insertedLine;

        if (details && details.length > 0) {
          for (const d of details) {
            await trx('payroll_line_details').insert({
              ...d,
              payroll_line_id: lineId
            });
          }
        }
      }

      // Audit log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'CREATE',
        user_id: userId,
        description: `Generated draft payroll run for period ${period}. Total Net: PKR ${totalNet.toFixed(2)}`
      });

      return { run, linesCount: lines.length };
    });
  }

  /**
   * Submit payroll run to workflow (HR -> Finance -> CFO)
   */
  static async submitToWorkflow(runId, companyId, userId) {
    const run = await db('payroll_runs').where({ id: runId, company_id: companyId }).first();
    if (!run) throw new Error('Payroll run not found.');
    if (run.status !== 'DRAFT') throw new Error('Only draft payroll runs can be submitted.');

    const WorkflowEngineService = require('./workflow_engine.service');
    const workflowResult = await WorkflowEngineService.submitToWorkflow(
      companyId,
      'PAYROLL',
      runId,
      parseFloat(run.total_net),
      userId
    );

    if (workflowResult.status === 'PENDING') {
      await db('payroll_runs')
        .where({ id: runId })
        .update({ status: 'PENDING_APPROVAL', updated_at: db.fn.now() });
    }

    return { status: workflowResult.status, runStatus: workflowResult.status === 'PENDING' ? 'PENDING_APPROVAL' : 'POSTED' };
  }

  /**
   * Post Payroll to General Ledger (creates double-entry journals)
   */
  static async postPayrollRun(runId, companyId, userId, trx = db) {
    const run = await trx('payroll_runs').where({ id: runId, company_id: companyId }).first();
    if (!run) throw new Error('Payroll run not found.');
    if (run.status === 'POSTED') throw new Error('Payroll run is already posted.');

    // 1. Confirm period open
    const runDate = new Date(`${run.period}-28`);
    await PostingEngineService.assertPeriodOpen(companyId, runDate, trx);

    // 2. Resolve accounts
    const salaryExpAcc = await this.resolveAccount(companyId, '5110', 'Salary Expense', 'Expense', trx);
    const employerPFMatchAcc = await this.resolveAccount(companyId, '5115', 'Provident Fund Employer Match Expense', 'Expense', trx);
    const salaryPayAcc = await this.resolveAccount(companyId, '2020', 'Salary Payable', 'Liability', trx);
    const taxPayAcc = await this.resolveAccount(companyId, '2030', 'Tax Withholding Payable', 'Liability', trx);
    const pfPayAcc = await this.resolveAccount(companyId, '2040', 'Provident Fund Payable', 'Liability', trx);
    const eobiPayAcc = await this.resolveAccount(companyId, '2050', 'EOBI Payable', 'Liability', trx);
    const ssPayAcc = await this.resolveAccount(companyId, '2060', 'Social Security Payable', 'Liability', trx);

    // 3. Summarize lines
    const lines = await trx('payroll_lines').where({ payroll_run_id: runId });
    let totalGross = 0;
    let totalOT = 0;
    let totalTax = 0;
    let totalPF = 0;
    let totalEOBI = 0;
    let totalSS = 0;
    let totalNet = 0;

    for (const l of lines) {
      totalGross += parseFloat(l.basic_salary) + parseFloat(l.house_rent) + parseFloat(l.medical_allowance) + parseFloat(l.transport_allowance);
      totalOT += parseFloat(l.overtime_amount);
      totalTax += parseFloat(l.tax_deduction);
      totalPF += parseFloat(l.pf_deduction);
      totalEOBI += parseFloat(l.eobi_deduction);
      totalSS += parseFloat(l.social_security_deduction);
      totalNet += parseFloat(l.net_salary);
    }

    const employerPFContribution = totalPF; // Employer matches 1-to-1

    const debitSalaryExpense = totalGross + totalOT + employerPFContribution;
    const debitPFExpense = employerPFContribution;

    // Dr Salary Expense                      [totalGross + totalOT + PFEmployerMatch]
    // Cr Salary Payable                      [totalNet]
    // Cr Tax Payable                         [totalTax]
    // Cr Provident Fund Payable (Emp + Empr) [totalPF * 2]
    // Cr EOBI Payable                        [totalEOBI]
    // Cr Social Security Payable             [totalSS]
    const journalLines = [
      { accountId: salaryExpAcc, debit: debitSalaryExpense, credit: 0 },
      { accountId: salaryPayAcc, debit: 0, credit: totalNet },
      { accountId: taxPayAcc, debit: 0, credit: totalTax },
      { accountId: pfPayAcc, debit: 0, credit: totalPF * 2 },
      { accountId: eobiPayAcc, debit: 0, credit: totalEOBI },
      { accountId: ssPayAcc, debit: 0, credit: totalSS }
    ];

    // Create journal entry draft
    const je = await JournalService.createDraft({
      companyId,
      userId,
      entryDate: `${run.period}-28`,
      description: `Payroll Run: period ${run.period}`,
      reference: `PAY-${run.id}`,
      lines: journalLines
    });

    const jeId = typeof je === 'object' ? je.id : je;

    // Post it (this triggers budget and period close locks internally)
    await JournalService.postJournalEntry(jeId, companyId, userId, true, trx);

    // Update run details
    await trx('payroll_runs')
      .where({ id: runId })
      .update({
        status: 'POSTED',
        journal_entry_id: jeId,
        approved_by: userId,
        updated_at: trx.fn.now()
      });

    // Audit logs
    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'APPROVE',
      user_id: userId,
      description: `Approved and posted payroll run for period ${run.period}. Journal ID: ${jeId}`
    });

    // Notify employees
    await NotificationService.createNotification({
      companyId,
      userId,
      title: 'Payroll Posted',
      message: `Payroll run for period ${run.period} has been posted successfully. Payslips are now available.`,
      type: 'system',
      priority: 'MEDIUM',
      entityType: 'payroll',
      entityId: runId
    });

    return { runId, journalEntryId: jeId, status: 'POSTED' };
  }

  /**
   * Reverse a posted payroll run
   */
  static async reversePayrollRun(runId, companyId, userId) {
    return await db.transaction(async (trx) => {
      const run = await trx('payroll_runs').where({ id: runId, company_id: companyId }).first();
      if (!run) throw new Error('Payroll run not found.');
      if (run.status !== 'POSTED') throw new Error('Only posted payroll runs can be reversed.');

      // Call journal reversal
      const res = await fetch(`http://localhost:${PORT}/api/journal/${run.journal_entry_id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getInternalToken()}`,
          'x-company-id': companyId.toString()
        },
        body: JSON.stringify({ reason: 'Reversing Payroll Run' })
      });

      if (res.status !== 200) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to reverse payroll journal entry.');
      }

      await trx('payroll_runs')
        .where({ id: runId })
        .update({
          status: 'REVERSED',
          updated_at: trx.fn.now()
        });

      // Audit logs
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'DELETE',
        user_id: userId,
        description: `Reversed payroll run for period ${run.period}.`
      });

      return { runId, status: 'REVERSED' };
    });
  }

  /**
   * Generate Bank Transfer CSV File Content
   */
  static async generateBankFile(runId, companyId) {
    const lines = await db('payroll_lines as pl')
      .join('employees as e', 'pl.employee_id', 'e.id')
      .where('pl.payroll_run_id', runId)
      .select('e.name', 'e.account_number', 'e.bank_name', 'pl.net_salary');

    let csv = 'Employee Name,IBAN/Account Number,Bank Name,Net Pay\n';
    lines.forEach(l => {
      csv += `"${l.name}","${l.account_number || ''}","${l.bank_name || ''}",${parseFloat(l.net_salary).toFixed(2)}\n`;
    });

    return csv;
  }

  /**
   * Helper to resolve/create accounts dynamically
   */
  static async resolveAccount(companyId, code, name, category, trx) {
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

  static getInternalToken() {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: 1, email: 'admin@sarfis.com', role: 'Super Admin' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
  }

  /**
   * Generate Payslip PDF stream using PDFKit
   */
  static generatePayslipPDF(employee, line, period, res) {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('SARFIS ERP - PAYSLIP', { align: 'center' });
    doc.moveDown();
    
    // Employee Info
    doc.fontSize(12).text(`Employee: ${employee.name}`);
    doc.text(`Designation: ${employee.role || 'N/A'}`);
    doc.text(`Department: ${employee.department || 'N/A'}`);
    doc.text(`Pay Period: ${period}`);
    doc.text(`Bank: ${employee.bank_name || 'N/A'} (A/C: ${employee.account_number || 'N/A'})`);
    doc.moveDown();

    // Line separator
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Table Columns: Earnings & Deductions side-by-side
    doc.fontSize(14).text('Earnings', 50, doc.y, { underline: true });
    const earningsY = doc.y;
    doc.fontSize(11);
    doc.text(`Basic Salary: PKR ${parseFloat(line.basic_salary).toFixed(2)}`, 50, earningsY + 20);
    doc.text(`House Rent: PKR ${parseFloat(line.house_rent).toFixed(2)}`, 50, earningsY + 40);
    doc.text(`Medical: PKR ${parseFloat(line.medical_allowance).toFixed(2)}`, 50, earningsY + 60);
    doc.text(`Transport: PKR ${parseFloat(line.transport_allowance).toFixed(2)}`, 50, earningsY + 80);
    doc.text(`Overtime: PKR ${parseFloat(line.overtime_amount).toFixed(2)}`, 50, earningsY + 100);

    doc.fontSize(14).text('Deductions', 300, earningsY, { underline: true });
    doc.fontSize(11);
    doc.text(`Income Tax: PKR ${parseFloat(line.tax_deduction).toFixed(2)}`, 300, earningsY + 20);
    doc.text(`Provident Fund: PKR ${parseFloat(line.pf_deduction).toFixed(2)}`, 300, earningsY + 40);
    doc.text(`EOBI: PKR ${parseFloat(line.eobi_deduction).toFixed(2)}`, 300, earningsY + 60);
    doc.text(`Social Security: PKR ${parseFloat(line.social_security_deduction).toFixed(2)}`, 300, earningsY + 80);

    // Sum Net Pay
    doc.moveDown(7);
    doc.fontSize(12).text(`Gross Salary: PKR ${parseFloat(line.gross_salary).toFixed(2)}`, { align: 'right' });
    doc.text(`Total Deductions: PKR ${(parseFloat(line.gross_salary) - parseFloat(line.net_salary)).toFixed(2)}`, { align: 'right' });
    doc.fontSize(14).text(`Net Salary: PKR ${parseFloat(line.net_salary).toFixed(2)}`, { align: 'right', bold: true });

    doc.end();
  }

  /**
   * Get workspace list of employees with summaries
   */
  static async getWorkspaceEmployees(companyId, period) {
    return await db('payroll_lines as pl')
      .join('payroll_runs as pr', 'pl.payroll_run_id', 'pr.id')
      .join('employees as e', 'pl.employee_id', 'e.id')
      .where({ 'pr.company_id': companyId, 'pr.period': period })
      .select(
        'pl.id as line_id',
        'pl.employee_id',
        'e.name',
        'e.role',
        'e.department',
        'pl.net_salary',
        'pl.payment_status'
      );
  }

  /**
   * Get employee detailed workspace payload
   */
  static async getWorkspaceEmployeeDetails(companyId, lineId) {
    const line = await db('payroll_lines').where({ id: lineId }).first();
    if (!line) throw new Error('Payroll line not found.');

    const run = await db('payroll_runs').where({ id: line.payroll_run_id, company_id: companyId }).first();
    if (!run) throw new Error('Unauthorized or invalid payroll run.');

    const emp = await db('employees').where({ id: line.employee_id }).first();
    const components = await db('payroll_line_details').where({ payroll_line_id: lineId }).orderBy('display_order', 'asc');
    const history = await db('payroll_status_history').where({ payroll_line_id: lineId }).orderBy('changed_at', 'desc');
    const adjustments = await db('payroll_adjustments').where({ payroll_line_id: lineId }).orderBy('created_at', 'desc');

    // Fetch other payments for this employee
    const pastPayments = await db('payroll_payments as p')
      .join('payroll_lines as pl', 'p.payroll_line_id', 'pl.id')
      .join('payroll_runs as pr', 'pl.payroll_run_id', 'pr.id')
      .where({ 'p.employee_id': line.employee_id })
      .select('p.*', 'pr.period', 'pl.gross_salary', 'pl.net_salary')
      .orderBy('pr.period', 'desc');

    return {
      line,
      run,
      employee: emp,
      components,
      history,
      adjustments,
      pastPayments
    };
  }

  /**
   * Hold employee salary
   */
  static async holdPayrollLine(companyId, lineId, holdType, reason, userId) {
    return await db.transaction(async (trx) => {
      const line = await trx('payroll_lines').where({ id: lineId }).first();
      if (!line) throw new Error('Payroll line not found.');
      
      const run = await trx('payroll_runs').where({ id: line.payroll_run_id, company_id: companyId }).first();
      if (!run) throw new Error('Unauthorized or invalid payroll run.');

      const oldStatus = line.payment_status;
      const newStatus = 'ON_HOLD';

      await trx('payroll_lines')
        .where({ id: lineId })
        .update({
          payment_status: newStatus,
          hold_type: holdType || 'OTHER',
          hold_reason: reason,
          hold_by: userId,
          hold_at: trx.fn.now()
        });

      await trx('payroll_status_history').insert({
        payroll_line_id: lineId,
        old_status: oldStatus,
        new_status: newStatus,
        reason: reason || 'Salary placed on hold',
        changed_by: userId
      });

      return { lineId, payment_status: newStatus };
    });
  }

  /**
   * Release hold status
   */
  static async releasePayrollLine(companyId, lineId, userId) {
    return await db.transaction(async (trx) => {
      const line = await trx('payroll_lines').where({ id: lineId }).first();
      if (!line) throw new Error('Payroll line not found.');
      
      const run = await trx('payroll_runs').where({ id: line.payroll_run_id, company_id: companyId }).first();
      if (!run) throw new Error('Unauthorized or invalid payroll run.');

      const oldStatus = line.payment_status;
      const newStatus = 'PENDING';

      await trx('payroll_lines')
        .where({ id: lineId })
        .update({
          payment_status: newStatus,
          hold_type: null,
          hold_reason: null,
          hold_by: null,
          hold_at: null
        });

      await trx('payroll_status_history').insert({
        payroll_line_id: lineId,
        old_status: oldStatus,
        new_status: newStatus,
        reason: 'Salary hold released',
        changed_by: userId
      });

      return { lineId, payment_status: newStatus };
    });
  }

  /**
   * Atomically process individual payout, post GL entry, and update status
   */
  static async payPayrollLine(companyId, lineId, paymentMethod, remarks, userId) {
    return await db.transaction(async (trx) => {
      const line = await trx('payroll_lines').where({ id: lineId }).first();
      if (!line) throw new Error('Payroll line not found.');

      const run = await trx('payroll_runs').where({ id: line.payroll_run_id, company_id: companyId }).first();
      if (!run) throw new Error('Unauthorized or invalid payroll run.');

      if (run.status !== 'POSTED') {
        throw new Error('Salary payments can only be processed for posted payroll runs.');
      }
      if (line.payment_status === 'PAID') {
        throw new Error('Salary has already been paid for this employee.');
      }
      if (line.payment_status === 'ON_HOLD') {
        throw new Error('Salary is on hold. Release the hold status before paying.');
      }

      const runDate = new Date(`${run.period}-28`);
      await PostingEngineService.assertPeriodOpen(companyId, runDate, trx);

      const salaryPayAccId = await this.resolveAccount(companyId, '2020', 'Salary Payable', 'Liability', trx);
      const bankAccId = await this.resolveAccount(companyId, '1010', 'Cash at Bank', 'Asset', trx);

      const netSalary = parseFloat(line.net_salary);
      const referenceNo = `PAY-${lineId}-${Date.now()}`;

      const journalLines = [
        { accountId: salaryPayAccId, debit: netSalary, credit: 0 },
        { accountId: bankAccId, debit: 0, credit: netSalary }
      ];

      const jeId = await JournalService.createDraft({
        companyId,
        userId,
        entryDate: `${run.period}-28`,
        description: `Salary Payment - Period ${run.period} - Employee ID: ${line.employee_id}`,
        lines: journalLines
      });

      await JournalService.postJournalEntry(jeId, companyId, userId, true, trx);

      const emp = await trx('employees').where({ id: line.employee_id }).first();
      const [paymentObj] = await trx('payroll_payments')
        .insert({
          company_id: companyId,
          payroll_line_id: lineId,
          employee_id: line.employee_id,
          payment_batch_id: null,
          journal_entry_id: jeId,
          payment_method: paymentMethod || 'BANK',
          bank_account: emp.account_number || 'CASH',
          amount: netSalary,
          currency: 'PKR',
          exchange_rate: 1.0000,
          payment_date: `${run.period}-28`,
          payment_reference: referenceNo,
          remarks: remarks || 'Salary disbursed',
          created_by: userId
        })
        .returning('*');

      const paymentId = typeof paymentObj === 'object' ? paymentObj.id : paymentObj;

      const oldStatus = line.payment_status;
      const newStatus = 'PAID';

      await trx('payroll_lines')
        .where({ id: lineId })
        .update({
          payment_status: newStatus,
          payment_date: trx.fn.now()
        });

      await trx('payroll_status_history').insert({
        payroll_line_id: lineId,
        old_status: oldStatus,
        new_status: newStatus,
        reason: remarks || 'Salary payment processed',
        changed_by: userId
      });

      return { paymentId, status: newStatus };
    });
  }

  /**
   * Reverse payout and GL entry
   */
  static async reversePayrollPayment(companyId, paymentId, remarks, userId) {
    return await db.transaction(async (trx) => {
      const payment = await trx('payroll_payments').where({ id: paymentId, company_id: companyId }).first();
      if (!payment) throw new Error('Payment record not found.');
      if (payment.is_reversal) throw new Error('Cannot reverse a reversal transaction.');

      const line = await trx('payroll_lines').where({ id: payment.payroll_line_id }).first();
      if (!line) throw new Error('Payroll line not found.');
      if (line.payment_status !== 'PAID') {
        throw new Error('Associated payroll line is not marked as PAID.');
      }

      const paymentDate = new Date(payment.payment_date);
      await PostingEngineService.assertPeriodOpen(companyId, paymentDate, trx);

      const res = await fetch(`http://localhost:${PORT}/api/journal/${payment.journal_entry_id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getInternalToken()}`,
          'x-company-id': companyId.toString()
        },
        body: JSON.stringify({ reason: remarks || 'Reversing Salary Payment' })
      });

      if (res.status !== 200) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to reverse payroll payment journal entry.');
      }

      const referenceNo = `REV-${payment.payment_reference}`;

      await trx('payroll_payments').insert({
        company_id: companyId,
        payroll_line_id: payment.payroll_line_id,
        employee_id: payment.employee_id,
        payment_method: payment.payment_method,
        bank_account: payment.bank_account,
        amount: -parseFloat(payment.amount),
        currency: payment.currency,
        exchange_rate: payment.exchange_rate,
        payment_date: paymentDate,
        payment_reference: referenceNo,
        remarks: remarks || 'Salary payment reversed',
        is_reversal: true,
        reversal_payment_id: payment.id,
        reversed_at: trx.fn.now(),
        reversed_by: userId,
        created_by: userId
      });

      await trx('payroll_payments')
        .where({ id: payment.id })
        .update({
          is_reversal: true,
          reversal_payment_id: payment.id,
          reversed_at: trx.fn.now(),
          reversed_by: userId
        });

      const oldStatus = line.payment_status;
      const newStatus = 'PENDING';

      await trx('payroll_lines')
        .where({ id: payment.payroll_line_id })
        .update({
          payment_status: newStatus,
          payment_date: null
        });

      await trx('payroll_status_history').insert({
        payroll_line_id: payment.payroll_line_id,
        old_status: oldStatus,
        new_status: newStatus,
        reason: remarks || 'Salary payment reversed',
        changed_by: userId
      });

      return { paymentId, status: newStatus };
    });
  }

  /**
   * Save a manual adjustment
   */
  static async addPayrollAdjustment(companyId, lineId, type, amount, reason, userId) {
    return await db.transaction(async (trx) => {
      const line = await trx('payroll_lines').where({ id: lineId }).first();
      if (!line) throw new Error('Payroll line not found.');

      const run = await trx('payroll_runs').where({ id: line.payroll_run_id, company_id: companyId }).first();
      if (!run) throw new Error('Unauthorized or invalid payroll run.');
      if (run.status === 'POSTED') throw new Error('Cannot adjust payroll values for a posted period.');

      const adjAmount = parseFloat(amount);
      if (isNaN(adjAmount)) throw new Error('Invalid adjustment amount.');

      await trx('payroll_adjustments').insert({
        employee_id: line.employee_id,
        payroll_line_id: lineId,
        type,
        amount: adjAmount,
        reason,
        created_by: userId
      });

      const isEarning = ['BONUS', 'LEAVE_ENCASHMENT', 'ARREARS', 'OVERTIME_CORRECTION', 'ONE_TIME_ALLOWANCE'].includes(type);
      
      let updatedGross = parseFloat(line.gross_salary);
      let updatedDeduct = parseFloat(line.tax_deduction) + parseFloat(line.pf_deduction) + parseFloat(line.eobi_deduction) + parseFloat(line.social_security_deduction);

      if (isEarning) {
        updatedGross += adjAmount;
      } else {
        updatedDeduct += adjAmount;
      }

      const updatedNet = updatedGross - updatedDeduct;

      await trx('payroll_lines')
        .where({ id: lineId })
        .update({
          gross_salary: updatedGross,
          net_salary: updatedNet,
          tax_deduction: type === 'TAX_ADJUSTMENT' ? parseFloat(line.tax_deduction) + adjAmount : line.tax_deduction,
          pf_deduction: type === 'PF_ADJUSTMENT' ? parseFloat(line.pf_deduction) + adjAmount : line.pf_deduction,
          eobi_deduction: type === 'EOBI_ADJUSTMENT' ? parseFloat(line.eobi_deduction) + adjAmount : line.eobi_deduction
        });

      return { lineId, gross_salary: updatedGross, net_salary: updatedNet };
    });
  }

  /**
   * DFS Cycle-detection graph checker
   */
  static detectCircularDependencies(components) {
    const graph = {};
    for (const c of components) {
      if (c.calculation_type === 'FORMULA' && c.formula_expression) {
        const variables = c.formula_expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        const neighbors = variables.filter(v => components.some(tc => tc.code === v));
        graph[c.code] = neighbors;
      } else {
        graph[c.code] = [];
      }
    }

    const visited = {};
    const recStack = {};

    function dfs(node) {
      if (!visited[node]) {
        visited[node] = true;
        recStack[node] = true;

        const neighbors = graph[node] || [];
        for (const neighbor of neighbors) {
          if (!visited[neighbor] && dfs(neighbor)) return true;
          else if (recStack[neighbor]) return true;
        }
      }
      recStack[node] = false;
      return false;
    }

    for (const node of Object.keys(graph)) {
      if (dfs(node)) return true;
    }
    return false;
  }

  /**
   * Payroll Validation Engine
   */
  static async validatePayrollRun(employees, lines, companyId, period, trx) {
    const warnings = [];
    const errors = [];

    for (const line of lines) {
      const emp = employees.find(e => e.id === line.employee_id);
      
      // 1. Negative Net Salary Check
      if (parseFloat(line.net_salary) < 0) {
        errors.push({
          employee: emp?.name || `Employee #${line.employee_id}`,
          message: `Net salary is negative (PKR ${line.net_salary})`
        });
      }

      // 2. Missing Bank Accounts check
      if (emp && !emp.account_number) {
        warnings.push({
          employee: emp.name,
          message: 'Missing bank account number/IBAN. Defaulting to CASH.'
        });
      }

      // 3. Overtime Limit Check
      if (emp && parseFloat(line.overtime_amount) > parseFloat(emp.salary) * 0.5) {
        warnings.push({
          employee: emp.name,
          message: `Overtime exceeds 50% of base salary.`
        });
      }

      // 4. Comparison Check
      const prevLine = await trx('payroll_lines as pl')
        .join('payroll_runs as pr', 'pl.payroll_run_id', 'pr.id')
        .where({
          'pl.employee_id': line.employee_id,
          'pr.company_id': companyId,
          'pr.period': this.getPreviousPeriod(period),
          'pr.status': 'POSTED'
        })
        .first();

      if (prevLine) {
        const diffPercent = ((parseFloat(line.net_salary) - parseFloat(prevLine.net_salary)) / parseFloat(prevLine.net_salary)) * 100;
        if (Math.abs(diffPercent) > 25) {
          warnings.push({
            employee: emp?.name || `Employee #${line.employee_id}`,
            message: `Net salary changed by ${diffPercent.toFixed(1)}% compared to previous month`
          });
        }
      }
    }

    return { warnings, errors };
  }

  static getPreviousPeriod(period) {
    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    const pYear = date.getFullYear();
    const pMonth = String(date.getMonth() + 1).padStart(2, '0');
    return `${pYear}-${pMonth}`;
  }

  /**
   * Payroll Simulation Engine (Database-Free)
   */
  static async simulatePayrollRun(companyId, period, userId) {
    let resultPayload = null;
    try {
      await db.transaction(async (trx) => {
        const employees = await trx('employees').where({ company_id: companyId, status: 'Active' });
        if (employees.length === 0) {
          throw new Error('No active employees found to process.');
        }

        const lines = [];
        let totalGross = 0;
        let totalDeductions = 0;
        let totalNet = 0;

        for (const emp of employees) {
          const salary = parseFloat(emp.salary);
          const otSum = await trx('overtime_records')
            .where({ employee_id: emp.id, company_id: companyId, status: 'APPROVED' })
            .andWhereRaw("to_char(date, 'YYYY-MM') = ?", [period])
            .sum('amount as total')
            .first();
          const otAmt = parseFloat(otSum?.total || 0);

          let compMappings = [];
          if (emp.salary_structure_id) {
            compMappings = await trx('salary_structure_components as ssc')
              .join('salary_components as sc', 'ssc.component_id', 'sc.id')
              .where('ssc.structure_id', emp.salary_structure_id)
              .where('sc.is_active', true)
              .select('sc.*', 'ssc.value as template_value', trx.raw("'STRUCTURE' as source"));
          }

          const overrides = await trx('employee_salary_components as esc')
            .join('salary_components as sc', 'esc.component_id', 'sc.id')
            .where('esc.employee_id', emp.id)
            .where('sc.is_active', true)
            .select('sc.*', 'esc.value as override_value', trx.raw("'EMPLOYEE_OVERRIDE' as source"));

          const componentMap = {};
          for (const comp of compMappings) {
            componentMap[comp.code] = {
              ...comp,
              value: parseFloat(comp.template_value),
              source: 'STRUCTURE'
            };
          }
          for (const comp of overrides) {
            componentMap[comp.code] = {
              ...comp,
              value: parseFloat(comp.override_value),
              source: 'EMPLOYEE_OVERRIDE'
            };
          }

          const activeComponents = Object.values(componentMap);

          let basic = 0;
          let rent = 0;
          let med = 0;
          let trans = 0;
          let tax = 0;
          let pf = 0;
          let eobi = 0;
          let ss = 0;
          let gross = 0;
          let deduct = 0;
          let net = 0;

          if (activeComponents.length > 0) {
            activeComponents.sort((a, b) => a.sequence_no - b.sequence_no);

            const context = {
              salary: salary,
              ot: otAmt,
              basic: 0,
              gross: salary + otAmt,
              net: 0
            };

            for (const comp of activeComponents) {
              let amount = 0;
              if (comp.calculation_type === 'FIXED') {
                amount = comp.value;
              } else if (comp.calculation_type === 'PERCENTAGE') {
                amount = context.salary * comp.value;
              } else if (comp.calculation_type === 'FORMULA' && comp.formula_expression) {
                const evalRes = evaluateFormula(comp.formula_expression, context);
                amount = evalRes.result;
              }

              if (comp.code === 'BASIC') {
                basic = amount;
                context.basic = amount;
              } else if (comp.code === 'HRA') {
                rent = amount;
              } else if (comp.code === 'MED') {
                med = amount;
              } else if (comp.code === 'TRANS') {
                trans = amount;
              } else if (comp.code === 'TAX') {
                tax = amount;
              } else if (comp.code === 'PF') {
                pf = amount;
              } else if (comp.code === 'EOBI') {
                eobi = amount;
              } else if (comp.code === 'SS') {
                ss = amount;
              }
            }

            gross = salary + otAmt;
            deduct = tax + pf + eobi + ss;
            net = gross - deduct;
          } else {
            basic = salary * 0.60;
            rent = salary * 0.25;
            med = salary * 0.10;
            trans = salary * 0.05;
            tax = salary > 100000 ? salary * 0.10 : 0.00;
            pf = basic * 0.05;
            eobi = 1000.00;
            ss = 1200.00;

            gross = salary + otAmt;
            deduct = tax + pf + eobi + ss;
            net = gross - deduct;
          }

          totalGross += gross;
          totalDeductions += deduct;
          totalNet += net;

          lines.push({
            employee_id: emp.id,
            name: emp.name,
            gross_salary: gross,
            net_salary: net,
            tax_deduction: tax,
            pf_deduction: pf,
            overtime_amount: otAmt
          });
        }

        const { warnings, errors } = await this.validatePayrollRun(employees, lines, companyId, period, trx);
        const status = errors.length > 0 ? 'FAILED' : warnings.length > 0 ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS';

        resultPayload = {
          status,
          employees: lines,
          warnings,
          errors,
          summary: {
            employeesCount: lines.length,
            totalGross,
            totalNet,
            warningsCount: warnings.length,
            errorsCount: errors.length
          }
        };

        throw new Error('ROLLBACK_INTENTIONAL');
      });
    } catch (err) {
      if (err.message !== 'ROLLBACK_INTENTIONAL') {
        throw err;
      }
    }
    return resultPayload;
  }

  /**
   * Validate formula syntax
   */
  static validateFormulaExpression(formula, variables = ['basic', 'gross', 'net', 'ot', 'salary']) {
    let expr = formula;
    for (const key of variables) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expr = expr.replace(regex, '1.0');
    }
    expr = expr.replace(/IF\s*\(/gi, 'if(');
    expr = expr.replace(/MIN\s*\(/gi, 'Math.min(');
    expr = expr.replace(/MAX\s*\(/gi, 'Math.max(');
    expr = expr.replace(/ABS\s*\(/gi, 'Math.abs(');
    expr = expr.replace(/CEIL\s*\(/gi, 'Math.ceil(');
    expr = expr.replace(/FLOOR\s*\(/gi, 'Math.floor(');
    expr = expr.replace(/ROUND\s*\(([^,]+),\s*([^)]+)\)/gi, '(Math.round(($1) * Math.pow(10, $2)) / Math.pow(10, $2))');

    if (expr.startsWith('if(') || expr.startsWith('if (')) {
      const startIdx = expr.indexOf('(');
      const content = expr.substring(startIdx + 1, expr.lastIndexOf(')'));
      const parts = [];
      let bracketCount = 0;
      let currentPart = '';
      
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '(') bracketCount++;
        else if (char === ')') bracketCount--;
        
        if (char === ',' && bracketCount === 0) {
          parts.push(currentPart.trim());
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart.trim());

      if (parts.length === 3) {
        expr = `(${parts[0]}) ? (${parts[1]}) : (${parts[2]})`;
      }
    }

    try {
      const result = new Function(`return (${expr});`)();
      if (isNaN(result)) throw new Error('Formula evaluates to NaN.');
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
}

module.exports = PayrollService;
