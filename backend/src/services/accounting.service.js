class AccountingService {
  /**
   * Calculates the net balance of an account considering its normal balance and contra status.
   *
   * @param {number|string} totalDebit - Total debits on the account
   * @param {number|string} totalCredit - Total credits on the account
   * @param {string} normalBalance - 'Debit' or 'Credit'
   * @param {boolean} isContra - Whether the account is a contra account
   * @returns {number} The net formatted balance
   */
  static calculateNetBalance(totalDebit, totalCredit, normalBalance, isContra) {
    const td = parseFloat(totalDebit || 0);
    const tc = parseFloat(totalCredit || 0);

    let rawBalance = 0;

    // Normal calculation based on standard balance
    if (normalBalance === 'Debit') {
      rawBalance = td - tc;
    } else if (normalBalance === 'Credit') {
      rawBalance = tc - td;
    } else {
      // Default to debit if unspecified or malformed
      rawBalance = td - tc;
    }

    // Contra accounts behave opposite to their category, meaning their values
    // reduce the category total. However, the `rawBalance` above already reflects
    // their natural state (e.g. A contra asset with credit normal balance will have
    // positive rawBalance if credits > debits).
    // In many financial reports, we want the magnitude.
    // If we are summing up category totals (Assets = Cash + AR - Allowance),
    // we should subtract contra balances from the group sum.
    
    return rawBalance;
  }

  /**
   * Adjusts a value for presentation (e.g. subtracting contra accounts from the main category).
   * If summing all assets: Normal Asset Balance - Contra Asset Balance
   */
  static getPresentationValue(balance, isContra) {
    return isContra ? -Math.abs(balance) : balance;
  }
}

module.exports = AccountingService;
