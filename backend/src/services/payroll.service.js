const db = require('../config/db');
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const PostingEngineService = require('./posting_engine.service');
const JournalService = require('./journal.service');
const NotificationService = require('./notification.service');
const PDFDocument = require('d:/sarfis/backend/node_modules/pdfkit');

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

        // Apportionments
        const basic = salary * 0.60;
        const rent = salary * 0.25;
        const med = salary * 0.10;
        const trans = salary * 0.05;

        // Sum overtime approved for this period
        const otSum = await trx('overtime_records')
          .where({ employee_id: emp.id, company_id: companyId, status: 'APPROVED' })
          .andWhereRaw("to_char(date, 'YYYY-MM') = ?", [period])
          .sum('amount as total')
          .first();
        const otAmt = parseFloat(otSum?.total || 0);

        // Deductions
        const tax = salary > 100000 ? salary * 0.10 : 0.00;
        const pf = basic * 0.05; // 5% basic
        const eobi = 1000.00;
        const ss = 1200.00;

        const gross = salary + otAmt;
        const deduct = tax + pf + eobi + ss;
        const net = gross - deduct;

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
          net_salary: net
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
        await trx('payroll_lines').insert({
          ...line,
          payroll_run_id: run.id
        });
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
    const jwt = require('d:/sarfis/backend/node_modules/jsonwebtoken');
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
}

module.exports = PayrollService;
