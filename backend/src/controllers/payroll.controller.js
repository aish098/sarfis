const db = require('../config/db');
const PayrollService = require('../services/payroll.service');

exports.recordAttendance = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const log = await PayrollService.recordAttendance(parseInt(companyId), req.body);
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.submitLeaveRequest = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const app = await PayrollService.submitLeaveRequest(parseInt(companyId), req.body);
    res.status(201).json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const app = await PayrollService.approveLeaveRequest(parseInt(companyId), parseInt(req.params.id), userId);
    res.json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.recordOvertime = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const ot = await PayrollService.recordOvertime(parseInt(companyId), req.body);
    res.status(201).json(ot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getLeaveBalances = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const balances = await PayrollService.getLeaveBalances(parseInt(companyId), parseInt(req.params.employeeId));
    res.json(balances);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.generatePayrollRun = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { period } = req.body;
    const result = await PayrollService.generatePayrollRun(parseInt(companyId), period, userId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.submitToWorkflow = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const result = await PayrollService.submitToWorkflow(parseInt(req.params.id), parseInt(companyId), userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.postPayrollRun = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const result = await PayrollService.postPayrollRun(parseInt(req.params.id), parseInt(companyId), userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.reversePayrollRun = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const result = await PayrollService.reversePayrollRun(parseInt(req.params.id), parseInt(companyId), userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getBankFile = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const csvContent = await PayrollService.generateBankFile(parseInt(req.params.id), parseInt(companyId));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bank-transfer-payroll-${req.params.id}.csv`);
    res.send(csvContent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPayslip = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { employeeId, period } = req.params;

    const employee = await db('employees').where({ id: employeeId, company_id: companyId }).first();
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    const line = await db('payroll_lines as pl')
      .join('payroll_runs as pr', 'pl.payroll_run_id', 'pr.id')
      .where({ 'pl.employee_id': employeeId, 'pr.period': period, 'pr.company_id': companyId })
      .select('pl.*')
      .first();

    if (!line) {
      return res.status(404).json({ error: `No posted payslip found for employee in period ${period}.` });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${employeeId}-${period}.pdf`);
    
    PayrollService.generatePayslipPDF(employee, line, period, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getPayrollRegister = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const runs = await db('payroll_runs').where({ company_id: companyId }).orderBy('period', 'desc');
    res.json(runs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getWorkspaceEmployees = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { period } = req.query;
    const list = await PayrollService.getWorkspaceEmployees(parseInt(companyId), period);
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getWorkspaceEmployeeDetails = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const details = await PayrollService.getWorkspaceEmployeeDetails(parseInt(companyId), parseInt(req.params.lineId));
    res.json(details);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.holdPayrollLine = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { hold_type, reason } = req.body;
    const result = await PayrollService.holdPayrollLine(parseInt(companyId), parseInt(req.params.id), hold_type, reason, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.releasePayrollLine = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const result = await PayrollService.releasePayrollLine(parseInt(companyId), parseInt(req.params.id), userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.payPayrollLine = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { payment_method, remarks } = req.body;
    const result = await PayrollService.payPayrollLine(parseInt(companyId), parseInt(req.params.id), payment_method, remarks, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.reversePayrollPayment = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { remarks } = req.body;
    const result = await PayrollService.reversePayrollPayment(parseInt(companyId), parseInt(req.params.id), remarks, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.addPayrollAdjustment = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { type, amount, reason } = req.body;
    const result = await PayrollService.addPayrollAdjustment(parseInt(companyId), parseInt(req.params.id), type, amount, reason, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.simulatePayrollRun = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { period } = req.body;
    const result = await PayrollService.simulatePayrollRun(parseInt(companyId), period, userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.validateFormulaExpression = async (req, res) => {
  try {
    const { formula, variables } = req.body;
    const result = PayrollService.validateFormulaExpression(formula, variables);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getEmployeeAttendance = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { employeeId } = req.params;
    const logs = await db('attendance_logs')
      .where({ company_id: companyId, employee_id: employeeId })
      .orderBy('date', 'desc');
    res.json(logs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getEmployeeOvertime = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { employeeId } = req.params;
    const records = await db('overtime_records')
      .where({ company_id: companyId, employee_id: employeeId })
      .orderBy('date', 'desc');
    res.json(records);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.requestLoan = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { employeeId, amount, purpose, repaymentPeriod = 12 } = req.body;
    
    if (!employeeId || !amount || !purpose) {
      return res.status(400).json({ error: 'Employee ID, amount, and purpose are required.' });
    }

    const monthlyInstallment = parseFloat(amount) / parseInt(repaymentPeriod);

    const [loan] = await db('employee_loans')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        amount: parseFloat(amount),
        purpose,
        repayment_period: parseInt(repaymentPeriod),
        monthly_installment: monthlyInstallment,
        status: 'APPROVED'
      })
      .returning('*');

    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getEmployeeLoans = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { employeeId } = req.params;
    const loans = await db('employee_loans')
      .where({ company_id: companyId, employee_id: employeeId })
      .orderBy('created_at', 'desc');
    res.json(loans);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getEmployeeLeaves = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const { employeeId } = req.params;
    const apps = await db('leave_applications')
      .where({ company_id: companyId, employee_id: employeeId })
      .orderBy('start_date', 'desc');
    res.json(apps);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.reversePayrollRun = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const result = await PayrollService.reversePayrollRun(parseInt(id), parseInt(companyId), userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.reversePayrollPayment = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.params.companyId;
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { remarks } = req.body;

    const payment = await db('payroll_payments')
      .where({ company_id: companyId, payroll_line_id: id, is_reversal: false })
      .first();

    if (!payment) {
      const line = await db('payroll_lines').where({ id, company_id: companyId }).first();
      if (!line) {
        return res.status(404).json({ error: 'Payroll line not found.' });
      }
      await db('payroll_lines')
        .where({ id, company_id: companyId })
        .update({ payment_status: 'PENDING' });
      return res.json({ id, payment_status: 'PENDING' });
    }

    const result = await PayrollService.reversePayrollPayment(parseInt(companyId), payment.id, remarks || 'Payment Reversal', userId);
    res.json({ id, payment_status: 'PENDING', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


