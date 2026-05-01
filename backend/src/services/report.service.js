const db = require('../config/db');
const ReportModel = require('../models/report.model');
const JournalModel = require('../models/journal.model');
const AccountModel = require('../models/account.model');

class ReportService {
  /**
   * Closes the accounting period by zeroing out temporary accounts (Income, Revenue, Expense)
   * and transferring the net balance to Retained Earnings.
   */
  static async closePeriod(companyId, endDate, description) {
    if (!endDate) throw new Error('endDate is required for closing.');

    return await db.transaction(async (trx) => {
      // 1. Get balances for all temporary accounts
      const tempAccounts = await ReportModel.getTemporaryAccountsBalances(companyId, endDate, trx);

      if (tempAccounts.length === 0) {
        throw new Error('No temporary accounts have transactions spanning this period.');
      }

      // 2. Find or create Retained Earnings account
      let reAccount = await ReportModel.findRetainedEarningsAccount(companyId, trx);
      let reAccountId;
      if (!reAccount) {
        const [newAcc] = await db('accounts')
          .insert({
            company_id: companyId,
            code: '3900',
            name: 'Retained Earnings',
            type: 'Equity',
            balance: 0
          })
          .returning('id')
          .transacting(trx);
        reAccountId = newAcc.id;
      } else {
        reAccountId = reAccount.id;
      }

      // 3. Create the Closing Journal Entry Header
      const entryId = await JournalModel.createEntry({
        companyId,
        entryDate: endDate,
        description: description || 'Year-End Closing Entry'
      }, trx);

      let totalNiCredit = 0; 
      let insertedLines = 0;
      
      // 4. Create closing lines for each temporary account
      for (let acc of tempAccounts) {
        const debit = parseFloat(acc.total_debit);
        const credit = parseFloat(acc.total_credit);
        const net_balance = credit - debit; 

        if (net_balance === 0) continue;

        let closeDebit = 0;
        let closeCredit = 0;

        // To zero out: if credit > debit (positive balance), we debit it.
        // If debit > credit (negative balance), we credit it.
        if (net_balance > 0) closeDebit = net_balance;
        else closeCredit = Math.abs(net_balance);

        if (closeDebit > 0 || closeCredit > 0) {
           await JournalModel.createLine({
             entryId,
             accountId: acc.id,
             debit: closeDebit,
             credit: closeCredit
           }, trx);

           // Update account static balance (should result in 0 net for these accounts if we were tracking it)
           await AccountModel.updateBalance(acc.id, companyId, closeCredit, closeDebit, trx);
           totalNiCredit += net_balance;
           insertedLines++;
        }
      }

      if (insertedLines === 0) {
         throw new Error('Temporary accounts are already at $0.00 zero balance. No closing needed.');
      }

      // 5. Create the offsetting line in Retained Earnings
      let reDebit = 0;
      let reCredit = 0;
      // Net Income (totalNiCredit > 0) means we credit Retained Earnings
      // Net Loss (totalNiCredit < 0) means we debit Retained Earnings
      if (totalNiCredit > 0) reCredit = totalNiCredit;
      else if (totalNiCredit < 0) reDebit = Math.abs(totalNiCredit);

      if (reDebit > 0 || reCredit > 0) {
         await JournalModel.createLine({
           entryId,
           accountId: reAccountId,
           debit: reDebit,
           credit: reCredit
         }, trx);
         await AccountModel.updateBalance(reAccountId, companyId, reCredit, reDebit, trx);
      }

      return { message: 'Period closed successfully.', netIncome: totalNiCredit };
    });
  }
}

module.exports = ReportService;
