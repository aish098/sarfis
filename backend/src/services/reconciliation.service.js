const db = require('../config/db');

class ReconciliationService {
  /**
   * Reconciles an account balance against its sub-ledger
   */
  static async reconcileAccount(companyId, account, closingBalance, breakdown) {
    const subledgerSum = (breakdown || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const difference = Math.abs(closingBalance - subledgerSum);

    // 1. Check if sub-ledger is not applicable for this account
    const isControl = account.is_control;
    const hasBreakdown = breakdown && breakdown.length > 0;
    
    if (!isControl && !hasBreakdown) {
      return {
        status: 'NOT_APPLICABLE',
        difference: 0,
        subledgerTotal: 0,
        ledgerTotal: closingBalance,
        reasons: ['No sub-ledger registered for this account classification.']
      };
    }

    // 2. Verified Status (no difference)
    if (difference < 0.01) {
      return {
        status: 'VERIFIED',
        difference: 0,
        subledgerTotal: subledgerSum,
        ledgerTotal: closingBalance,
        reasons: ['Sub-ledger balance matches General Ledger balance perfectly.']
      };
    }

    // 3. Warning Status (rounding differences <= 1.0)
    if (difference <= 1.0) {
      return {
        status: 'WARNING',
        difference,
        subledgerTotal: subledgerSum,
        ledgerTotal: closingBalance,
        reasons: ['Minor rounding variance detected. Probably due to currency conversion or decimal rounding.']
      };
    }

    // 4. Mismatch Status (> 1.0 difference)
    // Run diagnostics to identify potential causes
    const reasons = [];

    // Diagnostic 1: Check for manual journal entries (no voucher_id) posted directly to this account
    const manualEntries = await db('journal_lines as jl')
      .join('journal_entries as je', 'jl.entry_id', 'je.id')
      .leftJoin('vouchers as v', 'je.id', 'v.journal_entry_id')
      .where('jl.account_id', account.id)
      .andWhere({ 'je.company_id': companyId })
      .whereNull('v.id')
      .select('je.id')
      .limit(1);

    if (manualEntries.length > 0) {
      reasons.push('Manual Journal Entry: Direct journal postings detected that bypassed sub-ledger voucher validation workflows.');
    }

    // Diagnostic 2: Check for direct control account postings
    if (isControl) {
      reasons.push('Direct Control Account Posting: Manual adjustments were made directly to this system control account.');
    }

    // Diagnostic 3: Missing/unlinked asset check (for asset depreciation notes)
    if (account.name.toLowerCase().includes('depreciation') || account.name.toLowerCase().includes('amortization')) {
      const unlinkedCount = await db('journal_lines as jl')
        .join('journal_entries as je', 'jl.entry_id', 'je.id')
        .where('jl.account_id', account.id)
        .andWhere({ 'je.company_id': companyId })
        .andWhereNotExists(function() {
          this.select('id').from('assets').whereRaw('assets.asset_code = je.description or assets.asset_name = je.description');
        })
        .count('je.id as count')
        .first();

      if (parseInt(unlinkedCount?.count || 0) > 0) {
        reasons.push('Unlinked Depreciation Postings: Some depreciation postings lack a corresponding asset card link.');
      }
    }

    if (reasons.length === 0) {
      reasons.push('Transaction Discrepancy: Discrepancy between sub-ledger transaction logs and ledger balance.');
    }

    return {
      status: 'MISMATCH',
      difference,
      subledgerTotal: subledgerSum,
      ledgerTotal: closingBalance,
      reasons
    };
  }
}

module.exports = ReconciliationService;
