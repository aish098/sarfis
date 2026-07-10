const db = require('../config/db');
const PeriodValidationService = require('./period_validation.service');

class JournalValidationService {
  /**
   * Main validation entry point. Runs all check rules.
   */
  static async validate(companyId, journalData, overrideControlWarning, trx) {
    const conn = trx || db;
    const { entryDate, reference, lines } = journalData;

    // 1. Balance validation
    this.validateBalance(lines);

    // 2. Accounting Period validation
    await this.validatePeriod(companyId, entryDate, conn);

    // 3. Duplicate Reference validation
    await this.validateReference(companyId, reference, conn);

    // 4. Account existence and postable validation
    await this.validateAccounts(companyId, lines, conn);

    // 5. Control Account validation
    await this.validateControlAccounts(companyId, lines, overrideControlWarning, conn);
  }

  static validateBalance(lines) {
    if (!lines || lines.length < 2) {
      throw new Error('Journal entry must have at least 2 lines.');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      const debit = parseFloat(line.debit) || 0;
      const credit = parseFloat(line.credit) || 0;
      if (debit < 0 || credit < 0) {
        throw new Error('Negative debit or credit values are not allowed.');
      }
      totalDebit += debit;
      totalCredit += credit;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      throw new Error(`Uneven journal entry. Total debits ($${totalDebit.toFixed(2)}) must equal total credits ($${totalCredit.toFixed(2)}).`);
    }
  }

  static async validatePeriod(companyId, entryDate, conn) {
    await PeriodValidationService.validateDate(companyId, entryDate, conn);
  }

  static async validateReference(companyId, reference, conn) {
    if (!reference || reference.trim() === '') return;

    const exists = await conn('journal_entries')
      .where({ company_id: companyId })
      .andWhereRaw('LOWER(reference) = ?', [reference.trim().toLowerCase()])
      .first();

    if (exists) {
      throw new Error(`A journal entry with reference '${reference}' already exists.`);
    }
  }

  static async validateAccounts(companyId, lines, conn) {
    const accountIds = lines.map(l => l.accountId).filter(Boolean);
    if (accountIds.length === 0) {
      throw new Error('Journal entry must point to valid accounts.');
    }

    const accounts = await conn('accounts')
      .whereIn('id', accountIds)
      .andWhere({ company_id: companyId });

    const accountMap = new Map(accounts.map(a => [a.id.toString(), a]));

    for (const line of lines) {
      const acc = accountMap.get(line.accountId.toString());
      if (!acc) {
        throw new Error(`Account ID ${line.accountId} does not exist or belongs to another company.`);
      }
      if (acc.is_postable === false || acc.is_postable === 0) {
        throw new Error(`Account '${acc.name}' (${acc.code}) is a summary/header account and cannot accept postings.`);
      }
    }
  }

  static async validateControlAccounts(companyId, lines, overrideControlWarning, conn) {
    const accountIds = lines.map(l => l.accountId).filter(Boolean);
    const controlAccounts = await conn('accounts')
      .whereIn('id', accountIds)
      .andWhere({ company_id: companyId, is_control: true });

    if (controlAccounts.length > 0 && !overrideControlWarning) {
      const err = new Error('Direct manual posting to control accounts detected.');
      err.isControlWarning = true;
      err.controlAccounts = controlAccounts.map(a => a.name);
      throw err;
    }
  }
}

module.exports = JournalValidationService;
