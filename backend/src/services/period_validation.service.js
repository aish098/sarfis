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

    // Check Close the Books (closingDate) setting
    const closingDateSetting = await trx('settings')
      .where({ scope: 'company', target_id: String(companyId) })
      .first();

    if (closingDateSetting && closingDateSetting.value && closingDateSetting.value.closingDate) {
      const closingDate = new Date(closingDateSetting.value.closingDate);
      if (!isNaN(closingDate.getTime())) {
        const closingDateStr = closingDate.toISOString().split('T')[0];
        if (targetDate <= closingDateStr) {
          throw new Error(`The books are closed for this date. No transactions can be posted on or before ${closingDateStr}.`);
        }
      }
    }

    let period = await trx('accounting_periods')
      .where('company_id', companyId)
      .andWhere('start_date', '<=', targetDate)
      .andWhere('end_date', '>=', targetDate)
      .first();

    if (!period) {
      // Auto-provision 12 monthly OPEN accounting periods for this calendar year
      const year = parsedDate.getFullYear();
      const periodData = [];
      for (let m = 1; m <= 12; m++) {
        const mStr = m < 10 ? `0${m}` : `${m}`;
        const pName = `${year}-${mStr}`;
        const endDay = new Date(year, m, 0).getDate();
        periodData.push({
          company_id: companyId,
          period_name: pName,
          start_date: `${year}-${mStr}-01`,
          end_date: `${year}-${mStr}-${endDay}`,
          status: 'OPEN'
        });
      }
      try {
        await trx('accounting_periods').insert(periodData).onConflict(['company_id', 'period_name']).ignore();
      } catch (_) {
        // Fallback without onConflict for sqlite or existing constraints
        for (const p of periodData) {
          const exists = await trx('accounting_periods').where({ company_id: companyId, period_name: p.period_name }).first();
          if (!exists) {
            await trx('accounting_periods').insert(p).catch(() => {});
          }
        }
      }

      period = await trx('accounting_periods')
        .where('company_id', companyId)
        .andWhere('start_date', '<=', targetDate)
        .andWhere('end_date', '>=', targetDate)
        .first();
    }

    if (!period) {
      throw new Error(`No financial accounting period found for the date ${targetDate}.`);
    }

    if (period.status !== 'OPEN') {
      throw new Error(`Financial accounting period '${period.period_name}' is ${period.status} and locked for postings.`);
    }

    // Check active close session status
    const session = await trx('period_close_sessions')
      .where({ company_id: companyId, period_id: period.id })
      .orderBy('created_at', 'desc')
      .first();

    if (session && ['PENDING_APPROVAL', 'CLOSED'].includes(session.status)) {
      throw new Error(`Financial accounting period '${period.period_name}' is locked in ${session.status} state.`);
    }

    return period;
  }
}

module.exports = PeriodValidationService;
