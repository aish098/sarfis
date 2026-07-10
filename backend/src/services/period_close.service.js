const db = require('../config/db');
const FinancialNotesService = require('./financial_notes.service');
const NotificationService = require('./notification.service');
const ReportModel = require('../models/report.model');

class PeriodCloseService {
  /**
   * Helper to retrieve or start a new closing session.
   */
  static async getOrCreateSession(companyId, periodId, userId, trx = db) {
    let session = await trx('period_close_sessions')
      .where({ company_id: companyId, period_id: periodId })
      .orderBy('created_at', 'desc')
      .first();

    if (!session || ['CLOSED'].includes(session.status)) {
      const period = await trx('accounting_periods').where({ id: periodId }).first();
      const status = period.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
      [session] = await trx('period_close_sessions')
        .insert({
          company_id: companyId,
          period_id: periodId,
          status,
          started_by: userId,
          started_at: trx.fn.now()
        })
        .returning('*');
    }
    return session;
  }

  /**
   * Compiles the month-end closing checklist for a company's accounting period.
   */
  static async getChecklist(companyId, periodId) {
    const period = await db('accounting_periods')
      .where({ id: periodId, company_id: companyId })
      .first();
    if (!period) throw new Error('Accounting period not found.');

    const startDate = period.start_date;
    const endDate = period.end_date;

    // 1. Unposted Vouchers
    const unpostedVouchers = await db('vouchers')
      .where({ company_id: companyId })
      .andWhere('date', '>=', startDate)
      .andWhere('date', '<=', endDate)
      .andWhereNot({ status: 'POSTED' })
      .select('id', 'voucher_number', 'type', 'status', 'total_amount', 'date');

    // 2. Draft/Pending Journals
    const draftJournals = await db('journal_entries')
      .where({ company_id: companyId })
      .andWhere('entry_date', '>=', startDate)
      .andWhere('entry_date', '<=', endDate)
      .whereIn('status', ['DRAFT', 'PENDING_APPROVAL'])
      .select('id', 'description', 'entry_date', 'status');

    const draftJournalsWithTotals = [];
    for (const j of draftJournals) {
      const lines = await db('journal_lines').where({ entry_id: j.id });
      const totalAmount = lines.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
      draftJournalsWithTotals.push({ ...j, total_amount: totalAmount });
    }

    // 3. Depreciation Runs
    const depreciationRun = await db('depreciation_runs')
      .where({ company_id: companyId, period: period.period_name })
      .first();

    const assetsCount = await db('assets')
      .where({ company_id: companyId })
      .count('* as count')
      .first();
    
    const depreciationCompleted = parseInt(assetsCount?.count || 0) === 0 || !!depreciationRun;

    // 4. Inventory Checks
    const negativeInventory = await db('inventory as i')
      .join('products as p', 'i.product_id', 'p.id')
      .join('warehouses as w', 'i.warehouse_id', 'w.id')
      .where('p.company_id', companyId)
      .andWhere('i.quantity', '<', 0)
      .select('p.id as product_id', 'p.sku', 'p.name as product_name', 'w.name as warehouse_name', 'i.quantity');

    const pendingDeliveries = await db('deliveries')
      .where({ company_id: companyId })
      .whereIn('status', ['PENDING', 'SHIPPED'])
      .select('id', 'delivery_number', 'status', 'created_at');

    // 5. Bank Reconciliation Checks
    const bankAccounts = await db('accounts')
      .where({ company_id: companyId })
      .andWhereRaw("LOWER(name) LIKE '%bank%' OR LOWER(name) LIKE '%cash%'");

    const bankReconciliations = [];
    for (const acc of bankAccounts) {
      const rec = await db('bank_reconciliations')
        .where({ company_id: companyId, account_id: acc.id, period_name: period.period_name })
        .first();

      const ledgerBalance = parseFloat(acc.balance || 0);

      if (rec) {
        const diff = Math.abs(parseFloat(rec.statement_balance) - ledgerBalance);
        bankReconciliations.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          statementBalance: parseFloat(rec.statement_balance),
          ledgerBalance,
          difference: diff,
          status: diff < 0.01 ? 'RECONCILED' : 'DISCREPANCY'
        });
      } else {
        bankReconciliations.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          statementBalance: null,
          ledgerBalance,
          difference: null,
          status: 'UNRECONCILED'
        });
      }
    }

    // 6. Control Account Reconciliations
    const controlAccounts = await db('accounts')
      .where({ company_id: companyId, is_control: true });

    const controlReconciliations = [];
    for (const acc of controlAccounts) {
      const resolver = FinancialNotesService.getResolver(acc);
      let breakdown = [];
      try {
        breakdown = await resolver.resolve(companyId, acc, endDate);
      } catch (err) {
        console.error(`Failed resolving subledger for account ${acc.name}:`, err);
      }

      const closingBalance = parseFloat(acc.balance || 0);
      const subledgerSum = (breakdown || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      const difference = Math.abs(closingBalance - subledgerSum);

      controlReconciliations.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        ledgerBalance: closingBalance,
        subledgerBalance: subledgerSum,
        difference,
        status: difference < 0.01 ? 'VERIFIED' : difference <= 1.0 ? 'WARNING' : 'MISMATCH'
      });
    }

    const blockers = [];
    const warnings = [];

    // Structured Issues and actions mapping
    if (unpostedVouchers.length > 0) {
      blockers.push({
        type: 'UNPOSTED_VOUCHERS',
        severity: 'BLOCKER',
        title: 'Unposted Vouchers',
        description: `There are ${unpostedVouchers.length} unposted purchase/sales vouchers.`,
        details: unpostedVouchers,
        actions: unpostedVouchers.map(v => ({
          type: 'OPEN_DOCUMENT',
          text: `Open ${v.voucher_number}`,
          id: v.id,
          route: '/dashboard/purchasing'
        }))
      });
    }

    if (draftJournalsWithTotals.length > 0) {
      blockers.push({
        type: 'DRAFT_JOURNALS',
        severity: 'BLOCKER',
        title: 'Draft Journal Entries',
        description: `There are ${draftJournalsWithTotals.length} draft manual journals.`,
        details: draftJournalsWithTotals,
        actions: draftJournalsWithTotals.map(j => ({
          type: 'OPEN_DOCUMENT',
          text: `Open ${j.description || 'Journal'}`,
          id: j.id,
          route: '/dashboard/journals'
        }))
      });
    }

    if (!depreciationCompleted) {
      blockers.push({
        type: 'MISSING_DEPRECIATION',
        severity: 'BLOCKER',
        title: 'Asset Depreciation Run Required',
        description: `Depreciation is not calculated/posted for period ${period.period_name}.`,
        actions: [
          {
            type: 'RUN_DEPRECIATION',
            text: 'Run Depreciation',
            route: '/dashboard/assets'
          }
        ]
      });
    }

    if (negativeInventory.length > 0) {
      warnings.push({
        type: 'NEGATIVE_INVENTORY',
        severity: 'WARNING',
        title: 'Negative Product Balances',
        description: `Detected ${negativeInventory.length} product(s) with negative stock balances.`,
        details: negativeInventory,
        actions: [
          {
            type: 'STOCK_ADJUSTMENT',
            text: 'Reconcile Stock Balances',
            route: '/dashboard/inventory'
          }
        ]
      });
    }

    if (pendingDeliveries.length > 0) {
      warnings.push({
        type: 'PENDING_DELIVERIES',
        severity: 'WARNING',
        title: 'Pending Dispatches',
        description: `There are ${pendingDeliveries.length} dispatches in pending/shipped status.`,
        details: pendingDeliveries,
        actions: [
          {
            type: 'VIEW_DELIVERIES',
            text: 'Resolve Stock Dispatches',
            route: '/dashboard/inventory'
          }
        ]
      });
    }

    const unreconciledBanks = bankReconciliations.filter(b => b.status !== 'RECONCILED');
    if (unreconciledBanks.length > 0) {
      warnings.push({
        type: 'UNRECONCILED_BANKS',
        severity: 'WARNING',
        title: 'Unreconciled Bank Accounts',
        description: `There are ${unreconciledBanks.length} cash/bank accounts unreconciled.`,
        details: unreconciledBanks,
        actions: [
          {
            type: 'BANK_RECONCILIATION',
            text: 'Reconcile Bank Accounts',
            route: '/dashboard/banking'
          }
        ]
      });
    }

    const mismatchedControls = controlReconciliations.filter(c => c.status === 'MISMATCH');
    if (mismatchedControls.length > 0) {
      warnings.push({
        type: 'MISMATCHED_CONTROLS',
        severity: 'WARNING',
        title: 'Control Ledger Variance',
        description: `Sub-ledger match failed in ${mismatchedControls.length} control accounts.`,
        details: mismatchedControls,
        actions: [
          {
            type: 'AUDIT_LEDGER',
            text: 'Inspect Variance Discrepancies',
            route: '/dashboard/reports'
          }
        ]
      });
    }

    return {
      period,
      blockers,
      warnings,
      diagnostics: {
        depreciationRun: depreciationRun || null,
        bankReconciliations,
        controlReconciliations
      }
    };
  }

  /**
   * Compiles Closing readiness stats.
   */
  static async getCloseDashboard(companyId, periodId, userId) {
    const period = await db('accounting_periods')
      .where({ id: periodId, company_id: companyId })
      .first();
    if (!period) throw new Error('Accounting period not found.');

    const session = await this.getOrCreateSession(companyId, periodId, userId);
    const checklist = await this.getChecklist(companyId, periodId);

    const totalChecks = 7;
    let completedChecks = 7;

    if (checklist.blockers.some(b => b.type === 'UNPOSTED_VOUCHERS')) completedChecks--;
    if (checklist.blockers.some(b => b.type === 'DRAFT_JOURNALS')) completedChecks--;
    if (checklist.blockers.some(b => b.type === 'MISSING_DEPRECIATION')) completedChecks--;
    if (checklist.warnings.some(w => w.type === 'NEGATIVE_INVENTORY')) completedChecks--;
    if (checklist.warnings.some(w => w.type === 'PENDING_DELIVERIES')) completedChecks--;
    if (checklist.warnings.some(w => w.type === 'UNRECONCILED_BANKS')) completedChecks--;
    if (checklist.warnings.some(w => w.type === 'MISMATCHED_CONTROLS')) completedChecks--;

    const progress = Math.round((completedChecks / totalChecks) * 100);

    // Auto-update session status based on checklist diagnostics
    let nextStatus = session.status;
    if (session.status !== 'CLOSED' && session.status !== 'PENDING_APPROVAL') {
      if (checklist.blockers.length === 0) {
        nextStatus = 'READY_TO_CLOSE';
      } else {
        nextStatus = 'OPEN';
      }
      if (nextStatus !== session.status) {
        await db('period_close_sessions')
          .where({ id: session.id })
          .update({ status: nextStatus, updated_at: db.fn.now() });
        session.status = nextStatus;
      }
    }

    return {
      session,
      progress,
      status: session.status,
      blockers: checklist.blockers.length,
      warnings: checklist.warnings.length,
      completedChecks,
      totalChecks
    };
  }

  /**
   * Previews Financial Impact statements.
   */
  static async getFinancialSummary(companyId, periodId) {
    const period = await db('accounting_periods').where({ id: periodId, company_id: companyId }).first();
    if (!period) throw new Error('Accounting period not found.');

    const startDate = period.start_date;
    const endDate = period.end_date;

    const trialBalance = await ReportModel.getTrialBalance(companyId, startDate, endDate);
    const incomeStatement = await ReportModel.getIncomeStatement(companyId, startDate, endDate);
    const balanceSheet = await ReportModel.getBalanceSheet(companyId, endDate);

    let totalDr = 0, totalCr = 0;
    for (const r of trialBalance) {
      totalDr += parseFloat(r.debit || 0);
      totalCr += parseFloat(r.credit || 0);
    }

    return {
      revenue: parseFloat(incomeStatement.revenue || 0),
      expenses: parseFloat(incomeStatement.expenses || 0),
      netProfit: parseFloat(incomeStatement.netProfit || 0),
      assets: parseFloat(balanceSheet.totalAssets || 0),
      liabilities: parseFloat(balanceSheet.totalLiabilities || 0),
      equity: parseFloat(balanceSheet.totalEquity || 0),
      trialBalanceDifference: Math.abs(totalDr - totalCr)
    };
  }

  /**
   * Scans other modules for health metrics.
   */
  static async getModuleHealth(companyId, periodId) {
    const period = await db('accounting_periods').where({ id: periodId, company_id: companyId }).first();
    if (!period) throw new Error('Accounting period not found.');

    const checklist = await this.getChecklist(companyId, periodId);

    // 1. Finance Health
    const financeBlockers = checklist.blockers.filter(b => b.type === 'UNPOSTED_VOUCHERS' || b.type === 'DRAFT_JOURNALS');
    const financeStatus = financeBlockers.length > 0 ? 'BLOCKED' : 'PASS';
    const financeScore = financeStatus === 'PASS' ? 100 : 50;

    // 2. Inventory Health
    const invBlockers = checklist.warnings.filter(w => w.type === 'NEGATIVE_INVENTORY' || w.type === 'PENDING_DELIVERIES');
    const invStatus = invBlockers.length > 0 ? 'WARNING' : 'PASS';
    const invScore = invStatus === 'PASS' ? 100 : 75;

    // 3. Assets Health
    const assetBlocker = checklist.blockers.find(b => b.type === 'MISSING_DEPRECIATION');
    const assetStatus = assetBlocker ? 'BLOCKED' : 'PASS';
    const assetScore = assetStatus === 'PASS' ? 100 : 0;

    // 4. Payroll Health
    const targetPeriodStr = period.period_name.includes(' ') 
      ? new Date(period.start_date).toISOString().substring(0, 7) // YYYY-MM
      : period.period_name;
    const payrollRun = await db('payroll_runs')
      .where({ company_id: companyId, period: targetPeriodStr })
      .first();

    let payrollStatus = 'PASS';
    let payrollScore = 100;
    let payrollIssues = [];
    if (!payrollRun) {
      payrollStatus = 'WARNING';
      payrollScore = 50;
      payrollIssues.push('No payroll run recorded for this period.');
    } else if (payrollRun.status !== 'POSTED') {
      payrollStatus = 'BLOCKED';
      payrollScore = 0;
      payrollIssues.push(`Payroll run is in status ${payrollRun.status}. It must be POSTED.`);
    }

    // 5. Budgets Health
    const yearVal = new Date(period.start_date).getFullYear();
    const budgetsCount = await db('budgets')
      .where({ company_id: companyId, period_year: yearVal })
      .count('* as count')
      .first();
    const budgetStatus = parseInt(budgetsCount?.count || 0) > 0 ? 'PASS' : 'WARNING';
    const budgetScore = budgetStatus === 'PASS' ? 100 : 80;

    // 6. Workflow Health
    const workflowCount = await db('workflow_definitions')
      .where({ company_id: companyId, is_active: true })
      .count('* as count')
      .first();
    const workflowStatus = parseInt(workflowCount?.count || 0) > 0 ? 'PASS' : 'WARNING';
    const workflowScore = workflowStatus === 'PASS' ? 100 : 90;

    // 7. Notifications Health
    const notificationsCount = await db('notifications')
      .where({ company_id: companyId, read: false })
      .count('* as count')
      .first();
    const notifStatus = parseInt(notificationsCount?.count || 0) < 50 ? 'PASS' : 'WARNING';
    const notifScore = notifStatus === 'PASS' ? 100 : 80;

    return [
      {
        module: 'Finance',
        status: financeStatus,
        score: financeScore,
        issues: financeBlockers.map(b => b.description)
      },
      {
        module: 'Inventory',
        status: invStatus,
        score: invScore,
        issues: invBlockers.map(w => w.description)
      },
      {
        module: 'Assets',
        status: assetStatus,
        score: assetScore,
        issues: assetBlocker ? [assetBlocker.description] : []
      },
      {
        module: 'Payroll',
        status: payrollStatus,
        score: payrollScore,
        issues: payrollIssues
      },
      {
        module: 'Budgets',
        status: budgetStatus,
        score: budgetScore,
        issues: budgetStatus === 'PASS' ? [] : ['No budgets configured for this fiscal year.']
      },
      {
        module: 'Workflow',
        status: workflowStatus,
        score: workflowScore,
        issues: workflowStatus === 'PASS' ? [] : ['No active workflow approval chains configured. Auto-approvals will execute.']
      },
      {
        module: 'Notifications',
        status: notifStatus,
        score: notifScore,
        issues: notifStatus === 'PASS' ? [] : [`Alert queue backlog is high (${notificationsCount?.count} unread notifications).`]
      }
    ];
  }

  /**
   * Compiles the Closing audit trail.
   */
  static async getCloseTimeline(companyId, periodId) {
    const period = await db('accounting_periods').where({ id: periodId, company_id: companyId }).first();
    if (!period) throw new Error('Accounting period not found.');

    const timeline = [];

    // 1. Audit Logs
    const auditLogs = await db('transaction_audit_logs as al')
      .leftJoin('users as u', 'al.user_id', 'u.id')
      .select('al.*', 'u.name as user_name')
      .where('al.company_id', companyId)
      .andWhere('al.created_at', '>=', period.start_date)
      .andWhere('al.created_at', '<=', db.raw("?::timestamp + interval '2 day'", [period.end_date]))
      .limit(30);

    for (const log of auditLogs) {
      timeline.push({
        date: log.created_at,
        title: log.action.replace(/_/g, ' '),
        description: log.description,
        user: log.user_name || 'System'
      });
    }

    // 2. Period Close History
    const closeHistory = await db('period_close_history as pch')
      .leftJoin('users as u', 'pch.performed_by', 'u.id')
      .select('pch.*', 'u.name as user_name')
      .where({ 'pch.period_id': periodId, 'pch.company_id': companyId });

    for (const h of closeHistory) {
      timeline.push({
        date: h.performed_at,
        title: `Period ${h.action}ed`,
        description: h.reason ? `Justification: "${h.reason}"` : 'Target period checklist compiled and locked.',
        user: h.user_name || 'System'
      });
    }

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    return timeline;
  }

  /**
   * Executes ultimate safety checks before closing.
   */
  static async validateBeforeClose(companyId, periodId, trx = db) {
    const checklist = await this.getChecklist(companyId, periodId);
    if (checklist.blockers.length > 0) {
      throw new Error(`Close blocked. Resolve blockers: ${checklist.blockers.map(b => b.message).join(' | ')}`);
    }

    const period = await trx('accounting_periods').where({ id: periodId }).first();
    const targetPeriodStr = period.period_name.includes(' ') 
      ? new Date(period.start_date).toISOString().substring(0, 7) // YYYY-MM
      : period.period_name;
    const payrollRun = await trx('payroll_runs')
      .where({ company_id: companyId, period: targetPeriodStr })
      .first();

    if (payrollRun && payrollRun.status !== 'POSTED') {
      throw new Error(`Close blocked. Payroll run for ${targetPeriodStr} is in ${payrollRun.status} state. It must be POSTED.`);
    }

    const trialBalance = await ReportModel.getTrialBalance(companyId, period.start_date, period.end_date, trx);
    let totalDr = 0, totalCr = 0;
    for (const r of trialBalance) {
      totalDr += parseFloat(r.debit || 0);
      totalCr += parseFloat(r.credit || 0);
    }
    const diff = Math.abs(totalDr - totalCr);
    if (diff > 0.01) {
      throw new Error(`Close blocked. Trial Balance is not balanced. Discrepancy: PKR ${diff.toFixed(2)}.`);
    }

    return true;
  }

  /**
   * Closes and locks an accounting period.
   */
  static async closePeriod(docId, companyId, userId, trx = db) {
    let periodId = docId;
    let sessionId = null;

    const session = await trx('period_close_sessions')
      .where({ id: docId, company_id: companyId })
      .orWhere({ period_id: docId, company_id: companyId })
      .orderBy('created_at', 'desc')
      .first();

    if (session) {
      periodId = session.period_id;
      sessionId = session.id;
    }

    await this.validateBeforeClose(companyId, periodId, trx);

    const [updatedPeriod] = await trx('accounting_periods')
      .where({ id: periodId, company_id: companyId })
      .update({
        status: 'CLOSED',
        updated_at: trx.fn.now()
      })
      .returning('*');

    if (!updatedPeriod) throw new Error('Failed to update period status.');

    if (sessionId) {
      await trx('period_close_sessions')
        .where({ id: sessionId })
        .update({
          status: 'CLOSED',
          completed_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });
    } else {
      const [newSession] = await trx('period_close_sessions')
        .insert({
          company_id: companyId,
          period_id: periodId,
          status: 'CLOSED',
          started_by: userId,
          completed_at: trx.fn.now(),
          started_at: trx.fn.now()
        })
        .returning('*');
      sessionId = newSession.id;
    }

    const PeriodCloseSnapshotService = require('./period_close_snapshot.service');
    await PeriodCloseSnapshotService.captureSnapshot(companyId, periodId, sessionId, trx);

    const checklist = await this.getChecklist(companyId, periodId);
    await trx('period_close_history').insert({
      company_id: companyId,
      period_id: periodId,
      action: 'CLOSE',
      performed_by: userId,
      checklist_snapshot: JSON.stringify(checklist)
    });

    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'PERIOD_CLOSE',
      user_id: userId,
      description: `Successfully closed and locked Accounting Period: ${updatedPeriod.period_name}`
    });

    try {
      const closer = await trx('users').where({ id: userId }).first();
      const closerName = closer ? closer.name : 'System';

      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'period.view',
        title: `Accounting Period Closed`,
        message: `Accounting period ${updatedPeriod.period_name} has been closed and locked by ${closerName}. No further GL postings are allowed.`,
        type: 'period',
        priority: 'CRITICAL',
        entityType: 'admin',
        entityId: periodId
      });
    } catch (notifErr) {
      console.error('Period Close notification error:', notifErr);
    }

    return updatedPeriod;
  }

  /**
   * Reopens a closed accounting period.
   */
  static async reopenPeriod(periodId, companyId, userId, reason, trx = db) {
    if (!reason || !reason.trim()) {
      throw new Error('A detailed reason is required to reopen a closed accounting period.');
    }

    const [updatedPeriod] = await trx('accounting_periods')
      .where({ id: periodId, company_id: companyId, status: 'CLOSED' })
      .update({
        status: 'OPEN',
        updated_at: trx.fn.now()
      })
      .returning('*');

    if (!updatedPeriod) {
      throw new Error('Accounting period not found or is already open.');
    }

    const session = await trx('period_close_sessions')
      .where({ company_id: companyId, period_id: periodId, status: 'CLOSED' })
      .orderBy('created_at', 'desc')
      .first();

    if (session) {
      await trx('period_close_sessions')
        .where({ id: session.id })
        .update({
          status: 'REOPENED',
          updated_at: trx.fn.now()
        });
    }

    await trx('period_close_history').insert({
      company_id: companyId,
      period_id: periodId,
      action: 'REOPEN',
      performed_by: userId,
      reason
    });

    await trx('transaction_audit_logs').insert({
      company_id: companyId,
      action: 'PERIOD_REOPEN',
      user_id: userId,
      description: `Reopened closed Accounting Period: ${updatedPeriod.period_name}. Reason: ${reason}`
    });

    try {
      const opener = await trx('users').where({ id: userId }).first();
      const openerName = opener ? opener.name : 'System';

      await NotificationService.notifyUsersWithPermission({
        companyId,
        permissionCode: 'period.view',
        title: `Accounting Period Reopened`,
        message: `Accounting period ${updatedPeriod.period_name} has been reopened by ${openerName}. Reason: ${reason}`,
        type: 'period',
        priority: 'CRITICAL',
        entityType: 'admin',
        entityId: periodId
      });
    } catch (notifErr) {
      console.error('Period Reopen notification error:', notifErr);
    }

    return updatedPeriod;
  }
}

module.exports = PeriodCloseService;
