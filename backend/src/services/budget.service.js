const db = require('../config/db');

class BudgetService {
  /**
   * Checks if a set of transaction lines exceeds the configured budget control limits.
   */
  static async checkTransactionBudget(companyId, docTypeCode, docId, lines, trx = db) {
    const breaches = [];
    const today = new Date().toISOString().split('T')[0];

    for (const line of lines) {
      const debitAmt = parseFloat(line.debit || 0);
      if (debitAmt <= 0) continue; // Only debits/expenses consume budget

      // Fetch account details
      const account = await trx('accounts').where({ id: line.accountId, company_id: companyId }).first();
      if (!account) continue;

      // Extract transaction year
      const txDate = line.date || today;
      const fiscalYear = new Date(txDate).getFullYear().toString();

      // Find active budget definition
      const header = await trx('budget_headers')
        .where({ company_id: companyId, fiscal_year: fiscalYear, status: 'ACTIVE' })
        .first();

      if (!header) continue;

      // Find budget line matching account and dimensions (exact match first)
      let budgetLine = await trx('budget_control_lines')
        .where({
          budget_header_id: header.id,
          account_id: line.accountId,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null
        })
        .first();

      // Fallback: If no exact match (e.g. Journal Entry has no dimensions), check by GL Account alone
      if (!budgetLine) {
        budgetLine = await trx('budget_control_lines')
          .where({
            budget_header_id: header.id,
            account_id: line.accountId
          })
          .first();
      }

      if (!budgetLine) continue;

      const runDateObj = new Date(txDate);
      const monthNum = runDateObj.getMonth() + 1; // 1 to 12

      // Check if monthly override exists for this month
      const monthlyAlloc = await trx('budget_monthly_allocations')
        .where({ budget_control_line_id: budgetLine.id, month: monthNum })
        .first();

      let allocated, consumed, remaining;

      if (monthlyAlloc) {
        // Sum actual & committed spend restricted to this month
        const startOfMonth = `${fiscalYear}-${String(monthNum).padStart(2, '0')}-01`;
        const lastDay = new Date(Date.UTC(parseInt(fiscalYear), monthNum, 0)).getUTCDate();
        const endOfMonth = `${fiscalYear}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const actualRes = await trx('budget_control_transactions')
          .where({ budget_control_line_id: budgetLine.id, status: 'ACTUAL' })
          .andWhereBetween('posting_date', [startOfMonth, endOfMonth])
          .sum('amount as total');
        const actual = parseFloat(actualRes[0]?.total || 0);

        const committedRes = await trx('budget_control_transactions')
          .where({ budget_control_line_id: budgetLine.id, status: 'COMMITTED' })
          .andWhereNot({ document_type: docTypeCode, document_id: docId })
          .andWhereBetween('posting_date', [startOfMonth, endOfMonth])
          .sum('amount as total');
        const committed = parseFloat(committedRes[0]?.total || 0);

        allocated = parseFloat(monthlyAlloc.allocated_amount);
        consumed = actual + committed;
        remaining = allocated - consumed;
      } else {
        // Sum actual spend (all-time/annual)
        const actualRes = await trx('budget_control_transactions')
          .where({ budget_control_line_id: budgetLine.id, status: 'ACTUAL' })
          .sum('amount as total');
        const actual = parseFloat(actualRes[0]?.total || 0);

        // Sum committed spend (all-time/annual)
        const committedRes = await trx('budget_control_transactions')
          .where({ budget_control_line_id: budgetLine.id, status: 'COMMITTED' })
          .andWhereNot({ document_type: docTypeCode, document_id: docId })
          .sum('amount as total');
        const committed = parseFloat(committedRes[0]?.total || 0);

        allocated = parseFloat(budgetLine.current_budget_amount || budgetLine.allocated_amount);
        consumed = actual + committed;
        remaining = allocated - consumed;
      }

      if (debitAmt > remaining) {
        breaches.push({
          accountId: line.accountId,
          accountCode: account.code,
          accountName: account.name,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null,
          allocated,
          consumed,
          proposed: debitAmt,
          remaining,
          controlLevel: budgetLine.control_level
        });
      }
    }

    return {
      isExceeded: breaches.length > 0,
      breaches
    };
  }

  /**
   * Commits committed spend for a pending approval document.
   */
  static async commitCommittedSpend(docTypeCode, docId, companyId, date, lines, trx = db) {
    const fiscalYear = new Date(date).getFullYear().toString();

    // Clean out previous committed items for this document
    await trx('budget_control_transactions')
      .where({ document_type: docTypeCode, document_id: docId, status: 'COMMITTED' })
      .delete();

    const header = await trx('budget_headers')
      .where({ company_id: companyId, fiscal_year: fiscalYear, status: 'ACTIVE' })
      .first();

    if (!header) return;

    for (const line of lines) {
      const debitAmt = parseFloat(line.debit || 0);
      if (debitAmt <= 0) continue;

      const budgetLine = await trx('budget_control_lines')
        .where({
          budget_header_id: header.id,
          account_id: line.accountId,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null
        })
        .first();

      if (!budgetLine) continue;

      await trx('budget_control_transactions').insert({
        budget_control_line_id: budgetLine.id,
        document_type: docTypeCode,
        document_id: docId,
        amount: debitAmt,
        status: 'COMMITTED',
        posting_date: date
      });
    }

    // Invalidate dashboard cache (Phase 16B)
    await trx('budget_dashboard_cache').where({ company_id: companyId, fiscal_year: fiscalYear }).delete();
  }

  /**
   * Commits actual spend when a document is fully posted.
   */
  static async commitActualSpend(docTypeCode, docId, companyId, date, lines, trx = db) {
    const fiscalYear = new Date(date).getFullYear().toString();

    // Delete any prior COMMITTED or ACTUAL records for this document
    await trx('budget_control_transactions')
      .where({ document_type: docTypeCode, document_id: docId })
      .delete();

    const header = await trx('budget_headers')
      .where({ company_id: companyId, fiscal_year: fiscalYear, status: 'ACTIVE' })
      .first();

    if (!header) return;

    for (const line of lines) {
      const amount = parseFloat(line.debit || 0) - parseFloat(line.credit || 0);
      if (amount === 0) continue;

      const budgetLine = await trx('budget_control_lines')
        .where({
          budget_header_id: header.id,
          account_id: line.accountId,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null
        })
        .first();

      if (!budgetLine) continue;

      await trx('budget_control_transactions').insert({
        budget_control_line_id: budgetLine.id,
        document_type: docTypeCode,
        document_id: docId,
        amount,
        status: 'ACTUAL',
        posting_date: date
      });
    }

    // Invalidate dashboard cache (Phase 16B)
    await trx('budget_dashboard_cache').where({ company_id: companyId, fiscal_year: fiscalYear }).delete();
  }

  /**
   * Releases budget consumption when a document is rejected or reversed.
   */
  static async releaseSpend(docTypeCode, docId, trx = db) {
    const tx = await trx('budget_control_transactions as t')
      .join('budget_control_lines as l', 't.budget_control_line_id', 'l.id')
      .join('budget_headers as h', 'l.budget_header_id', 'h.id')
      .where({ 't.document_type': docTypeCode, 't.document_id': docId })
      .select('h.company_id', 'h.fiscal_year')
      .first();

    await trx('budget_control_transactions')
      .where({ document_type: docTypeCode, document_id: docId })
      .delete();

    if (tx) {
      await trx('budget_dashboard_cache')
        .where({ company_id: tx.company_id, fiscal_year: tx.fiscal_year })
        .delete();
    }
  }

  /**
   * Copies budget definitions and lines to a new fiscal year.
   */
  static async copyBudget(companyId, fromBudgetId, newFiscalYear, pctIncrease, trx = db) {
    const sourceHeader = await trx('budget_headers').where({ id: fromBudgetId, company_id: companyId }).first();
    if (!sourceHeader) throw new Error('Source budget not found.');

    const multiplier = 1 + (parseFloat(pctIncrease || 0) / 100);

    const [newHeader] = await trx('budget_headers')
      .insert({
        company_id: companyId,
        fiscal_year: newFiscalYear,
        name: `${sourceHeader.name} - Copied ${newFiscalYear}`,
        version_name: 'Original',
        status: 'DRAFT'
      })
      .returning('*');

    const sourceLines = await trx('budget_control_lines').where({ budget_header_id: fromBudgetId });
    for (const line of sourceLines) {
      await trx('budget_control_lines').insert({
        budget_header_id: newHeader.id,
        account_id: line.account_id,
        department: line.department,
        project: line.project,
        branch: line.branch,
        allocated_amount: parseFloat(line.allocated_amount) * multiplier,
        alert_threshold_pct: line.alert_threshold_pct,
        control_level: line.control_level
      });
    }

    return newHeader;
  }

  /**
   * Activates a budget revision/header and closes any previous active revisions for that year.
   */
  static async activateBudget(budgetHeaderId, companyId, userId = null, trx = db) {
    const budget = await trx('budget_headers').where({ id: budgetHeaderId, company_id: companyId }).first();
    if (!budget) throw new Error('Budget not found.');

    // 1. Mark existing ACTIVE budgets for this fiscal year as CLOSED
    await trx('budget_headers')
      .where({ company_id: companyId, fiscal_year: budget.fiscal_year, status: 'ACTIVE' })
      .update({
        status: 'CLOSED',
        updated_at: trx.fn.now()
      });

    // 2. Mark this budget as ACTIVE, setting approved/effective dates
    await trx('budget_headers')
      .where({ id: budgetHeaderId })
      .update({
        status: 'ACTIVE',
        approved_date: trx.fn.now(),
        effective_date: trx.fn.now(),
        updated_at: trx.fn.now()
      });

    return { message: `Budget plan '${budget.name}' activated successfully.` };
  }
}

module.exports = BudgetService;
