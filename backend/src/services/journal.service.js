const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');
const db = require('../config/db');

class JournalService {
  /**
   * Logic to create a balanced journal entry with multiple lines.
   */
  static async createJournalEntry({ companyId, userId, entryDate, description, lines, overrideControlWarning }) {
    if (!companyId) throw new Error('Company context required.');
    if (!lines || lines.length < 2) throw new Error('Journal entry must have at least 2 lines.');

    // Check for direct manual posting to control accounts
    const accountIds = lines.map(l => l.accountId).filter(Boolean);
    if (accountIds.length > 0) {
      const controlAccounts = await db('accounts')
        .whereIn('id', accountIds)
        .andWhere('is_control', true);

      if (controlAccounts.length > 0 && !overrideControlWarning) {
        const err = new Error('Direct posting to control accounts detected.');
        err.isControlWarning = true;
        err.controlAccounts = controlAccounts.map(a => a.name);
        throw err;
      }
    }

    // Validate debits and credits match
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) throw new Error('Negative values are not allowed.');
      totalDebit += parseFloat(line.debit) || 0;
      totalCredit += parseFloat(line.credit) || 0;
    }

    // Rounded comparison to avoid floating point issues
    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      throw new Error(`Uneven entry: Debits ($${totalDebit}) must equal Credits ($${totalCredit}).`);
    }

    return await db.transaction(async (trx) => {
      // 1. Insert Header as DRAFT
      const entryId = await JournalModel.createEntry({
        companyId,
        entryDate,
        description,
        userId,
        status: 'DRAFT'
      }, trx);

      // 2. Insert Lines
      for (const line of lines) {
        await JournalModel.createLine({
          entryId,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit
        }, trx);
      }
      return entryId;
    });
  }

  /**
   * Posts a draft journal entry (Updates ledgers)
   */
  static async postJournalEntry(entryId, companyId, userId) {
    return await db.transaction(async (trx) => {
      const header = await trx('journal_entries').where({ id: entryId, company_id: companyId }).first();
      if (!header) throw new Error('Journal entry not found.');
      if (header.status === 'POSTED') throw new Error('Journal entry is already posted.');

      const lines = await trx('journal_lines').where('entry_id', entryId);

      for (const line of lines) {
        // Auto-Posting: Update account balance
        await AccountModel.updateBalance(line.account_id, companyId, line.debit, line.credit, trx);
      }

      await trx('journal_entries').where({ id: entryId }).update({ status: 'POSTED' });

      // Audit Log
      await trx('transaction_audit_logs').insert({
        company_id: companyId,
        voucher_id: null,
        action: 'POST',
        user_id: userId,
        description: `Posted Journal Entry #${entryId}`
      });

      return true;
    });
  }
}

module.exports = JournalService;
