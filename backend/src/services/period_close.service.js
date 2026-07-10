const db = require('../config/db');
const FinancialNotesService = require('./financial_notes.service');
const NotificationService = require('./notification.service');

class PeriodCloseService {
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

    // Mapped journal lines to get total debits for draft details
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

    // Compile blockers and warnings
    const blockers = [];
    const warnings = [];

    if (unpostedVouchers.length > 0) {
      blockers.push({
        type: 'UNPOSTED_VOUCHERS',
        message: `There are ${unpostedVouchers.length} unposted vouchers in this period.`,
        details: unpostedVouchers
      });
    }

    if (draftJournalsWithTotals.length > 0) {
      blockers.push({
        type: 'DRAFT_JOURNALS',
        message: `There are ${draftJournalsWithTotals.length} draft/pending journal entries in this period.`,
        details: draftJournalsWithTotals
      });
    }

    if (!depreciationCompleted) {
      blockers.push({
        type: 'MISSING_DEPRECIATION',
        message: `Asset depreciation has not been run or posted for the period ${period.period_name}.`
      });
    }

    if (negativeInventory.length > 0) {
      warnings.push({
        type: 'NEGATIVE_INVENTORY',
        message: `Detected ${negativeInventory.length} product(s) with negative stock balances.`,
        details: negativeInventory
      });
    }

    if (pendingDeliveries.length > 0) {
      warnings.push({
        type: 'PENDING_DELIVERIES',
        message: `There are ${pendingDeliveries.length} pending or shipped stock dispatches.`,
        details: pendingDeliveries
      });
    }

    const unreconciledBanks = bankReconciliations.filter(b => b.status !== 'RECONCILED');
    if (unreconciledBanks.length > 0) {
      warnings.push({
        type: 'UNRECONCILED_BANKS',
        message: `There are ${unreconciledBanks.length} cash/bank accounts that are not reconciled.`,
        details: unreconciledBanks
      });
    }

    const mismatchedControls = controlReconciliations.filter(c => c.status === 'MISMATCH');
    if (mismatchedControls.length > 0) {
      warnings.push({
        type: 'MISMATCHED_CONTROLS',
        message: `Sub-ledger mismatch detected in ${mismatchedControls.length} system control accounts.`,
        details: mismatchedControls
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
   * Closes and locks an accounting period.
   */
  static async closePeriod(companyId, periodId, userId) {
    const checklist = await this.getChecklist(companyId, periodId);
    if (checklist.blockers.length > 0) {
      throw new Error(`Cannot close period. Resolve blockers first: ${checklist.blockers.map(b => b.message).join(' | ')}`);
    }

    return await db.transaction(async (trx) => {
      // 1. Lock period
      const [updatedPeriod] = await trx('accounting_periods')
        .where({ id: periodId, company_id: companyId })
        .update({
          status: 'CLOSED',
          updated_at: trx.fn.now()
        })
        .returning('*');

      if (!updatedPeriod) throw new Error('Failed to update period status.');

      // 2. Insert checklist snapshot history
      await trx('period_close_history').insert({
        company_id: companyId,
        period_id: periodId,
        action: 'CLOSE',
        performed_by: userId,
        checklist_snapshot: JSON.stringify(checklist)
      });

      // 3. Log Audit
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'PERIOD_CLOSE',
        user_id: userId,
        description: `Successfully closed and locked Accounting Period: ${updatedPeriod.period_name}`
      });

      // 4. Notify Administrators/Managers
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
    });
  }

  /**
   * Reopens a closed accounting period.
   */
  static async reopenPeriod(companyId, periodId, userId, reason) {
    if (!reason || !reason.trim()) {
      throw new Error('A detailed reason is required to reopen a closed accounting period.');
    }

    return await db.transaction(async (trx) => {
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

      // 2. Insert reopen history
      await trx('period_close_history').insert({
        company_id: companyId,
        period_id: periodId,
        action: 'REOPEN',
        performed_by: userId,
        reason
      });

      // 3. Log Audit
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        action: 'PERIOD_REOPEN',
        user_id: userId,
        description: `Reopened closed Accounting Period: ${updatedPeriod.period_name}. Reason: ${reason}`
      });

      // 4. Notify managers
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
    });
  }
}

module.exports = PeriodCloseService;
