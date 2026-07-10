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
