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

      // Find budget line matching account and dimensions
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

      // Sum actual spend
      const actualRes = await trx('budget_control_transactions')
        .where({ budget_control_line_id: budgetLine.id, status: 'ACTUAL' })
        .sum('amount as total');
      const actual = parseFloat(actualRes[0]?.total || 0);

      // Sum committed spend from other documents
      const committedRes = await trx('budget_control_transactions')
        .where({ budget_control_line_id: budgetLine.id, status: 'COMMITTED' })
        .andWhereNot({ document_type: docTypeCode, document_id: docId })
        .sum('amount as total');
      const committed = parseFloat(committedRes[0]?.total || 0);

      const totalConsumed = actual + committed;
      const allocated = parseFloat(budgetLine.allocated_amount);
      const remaining = allocated - totalConsumed;

      if (debitAmt > remaining) {
        breaches.push({
          accountId: line.accountId,
          accountCode: account.code,
          accountName: account.name,
          department: line.department || null,
          project: line.project || null,
          branch: line.branch || null,
          allocated,
          consumed: totalConsumed,
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
  }

  /**
   * Releases budget consumption when a document is rejected or reversed.
   */
  static async releaseSpend(docTypeCode, docId, trx = db) {
    await trx('budget_control_transactions')
      .where({ document_type: docTypeCode, document_id: docId })
      .delete();
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
}

module.exports = BudgetService;
