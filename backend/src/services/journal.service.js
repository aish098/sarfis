const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');
const db = require('../config/db');

class JournalService {
  /**
   * Logic to create a balanced journal entry with multiple lines.
   */
  static async createJournalEntry({ companyId, userId, entryDate, description, lines }) {
    if (!companyId) throw new Error('Company context required.');
    if (!lines || lines.length < 2) throw new Error('Journal entry must have at least 2 lines.');

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
      // 1. Insert Header
      const entryId = await JournalModel.createEntry({
        companyId,
        entryDate,
        description,
        userId
      }, trx);

      // 2. Insert Lines & Update Balances
      for (const line of lines) {
        await JournalModel.createLine({
          entryId,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit
        }, trx);

        // Auto-Posting: Update account balance
        await AccountModel.updateBalance(line.accountId, companyId, line.debit, line.credit, trx);
      }
      return entryId;
    });
  }
}

module.exports = JournalService;
