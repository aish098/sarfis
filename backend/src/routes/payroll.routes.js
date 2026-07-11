const router = require('express').Router();
const payrollCtrl = require('../controllers/payroll.controller');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Daily Operational Logging
router.post('/:companyId/attendance',               companyGuard, requirePermission('user.manage'), payrollCtrl.recordAttendance);
router.get('/:companyId/attendance/:employeeId',     companyGuard, requirePermission('user.manage'), payrollCtrl.getEmployeeAttendance);
router.post('/:companyId/leaves',                   companyGuard, requirePermission('user.manage'), payrollCtrl.submitLeaveRequest);
router.post('/:companyId/leaves/:id/approve',       companyGuard, requirePermission('user.manage'), payrollCtrl.approveLeaveRequest);
router.get('/:companyId/leaves/balances/:employeeId', companyGuard, requirePermission('user.manage'), payrollCtrl.getLeaveBalances);
router.get('/:companyId/leaves/:employeeId',          companyGuard, requirePermission('user.manage'), payrollCtrl.getEmployeeLeaves);
router.post('/:companyId/overtime',                 companyGuard, requirePermission('user.manage'), payrollCtrl.recordOvertime);
router.get('/:companyId/overtime/:employeeId',       companyGuard, requirePermission('user.manage'), payrollCtrl.getEmployeeOvertime);
router.post('/:companyId/loans',                     companyGuard, requirePermission('user.manage'), payrollCtrl.requestLoan);
router.get('/:companyId/loans/:employeeId',           companyGuard, requirePermission('user.manage'), payrollCtrl.getEmployeeLoans);

// Payroll Run Lifecycles
router.post('/:companyId/runs',                     companyGuard, requirePermission('user.manage'), payrollCtrl.generatePayrollRun);
router.post('/:companyId/runs/:id/submit',          companyGuard, requirePermission('user.manage'), payrollCtrl.submitToWorkflow);
router.post('/:companyId/runs/:id/post',            companyGuard, requirePermission('user.manage'), payrollCtrl.postPayrollRun);
router.post('/:companyId/runs/:id/reverse',         companyGuard, requirePermission('user.manage'), payrollCtrl.reversePayrollRun);
router.post('/:companyId/runs/:id/close',           companyGuard, requirePermission('user.manage'), payrollCtrl.closePayrollRun);
router.get('/:companyId/runs/:id/bank-file',        companyGuard, requirePermission('user.manage'), payrollCtrl.getBankFile);

// Payslip Downloads & Reports
router.get('/:companyId/payslips/:employeeId/:period', companyGuard, requirePermission('user.manage'), payrollCtrl.getPayslip);
router.get('/:companyId/reports/register',          companyGuard, requirePermission('user.manage'), payrollCtrl.getPayrollRegister);

// Workspace Endpoints
router.get('/:companyId/employees',                 companyGuard, requirePermission('user.manage'), payrollCtrl.getWorkspaceEmployees);
router.get('/:companyId/employee/:lineId',          companyGuard, requirePermission('user.manage'), payrollCtrl.getWorkspaceEmployeeDetails);
router.post('/:companyId/lines/:id/hold',           companyGuard, requirePermission('user.manage'), payrollCtrl.holdPayrollLine);
router.post('/:companyId/lines/:id/release',        companyGuard, requirePermission('user.manage'), payrollCtrl.releasePayrollLine);
router.post('/:companyId/lines/:id/pay',            companyGuard, requirePermission('user.manage'), payrollCtrl.payPayrollLine);
router.post('/:companyId/lines/:id/reverse-payment',companyGuard, requirePermission('user.manage'), payrollCtrl.reversePayrollPayment);
router.post('/:companyId/lines/:id/adjust',         companyGuard, requirePermission('user.manage'), payrollCtrl.addPayrollAdjustment);
router.post('/:companyId/disburse-bulk',            companyGuard, requirePermission('user.manage'), payrollCtrl.disburseBulkPayroll);
router.get('/:companyId/batches',                  companyGuard, requirePermission('user.manage'), payrollCtrl.getPaymentBatches);
router.get('/:companyId/reversals',                companyGuard, requirePermission('user.manage'), payrollCtrl.getPaymentReversals);
router.get('/:companyId/reports/cost-analysis',    companyGuard, requirePermission('user.manage'), payrollCtrl.getEmployeeCostAnalysis);
router.get('/:companyId/reports/dept-variance',    companyGuard, requirePermission('user.manage'), payrollCtrl.getDepartmentalCostVariance);
router.get('/:companyId/reports/audit-trail',       companyGuard, requirePermission('user.manage'), payrollCtrl.getPayrollAuditTrail);

// Engine Maturity Endpoints
router.post('/:companyId/simulate',                 companyGuard, requirePermission('user.manage'), payrollCtrl.simulatePayrollRun);
router.post('/:companyId/formula/validate',         companyGuard, requirePermission('user.manage'), payrollCtrl.validateFormulaExpression);

module.exports = router;
