const db = require('../config/db');

class PeriodValidationService {
  /**
   * Validates if a transaction date falls within an OPEN accounting period.
   * Throws an error if the period is locked/closed or doesn't exist.
   */
  static async validateDate(companyId, date, trx = db) {
    if (!companyId) throw new Error('Company context required.');
    if (!date) throw new Error('Transaction date is required.');

    // Parse the date safely to YYYY-MM-DD
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid transaction date format.');
    }
    const targetDate = parsedDate.toISOString().split('T')[0];

    const period = await trx('accounting_periods')
      .where('company_id', companyId)
      .andWhere('start_date', '<=', targetDate)
      .andWhere('end_date', '>=', targetDate)
      .first();

    if (!period) {
      throw new Error(`No financial accounting period found for the date ${targetDate}.`);
    }

    if (period.status !== 'OPEN') {
      throw new Error(`Financial accounting period '${period.period_name}' is ${period.status} and locked for postings.`);
    }

    return period;
  }
}

module.exports = PeriodValidationService;
