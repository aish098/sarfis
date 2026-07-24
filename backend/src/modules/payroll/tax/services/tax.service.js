const db = require('../../../../config/db');

class TaxService {
  /**
   * Find applicable tax slab for a given annual taxable income
   */
  static async findApplicableSlab(taxYearCode, income) {
    let year = await db('tax_years').where({ code: taxYearCode }).first();
    if (!year) {
      // Fallback to active year or default PK-2026-27-SALARY
      year = await db('tax_years').where({ status: 'ACTIVE' }).first();
    }
    if (!year) {
      throw new Error(`Tax year '${taxYearCode}' not found or active in system.`);
    }

    const slabs = await db('tax_slabs')
      .where({ tax_year_id: year.id })
      .orderBy('sequence_no', 'asc');

    if (!slabs || slabs.length === 0) {
      throw new Error(`No tax slabs configured for tax year code: ${year.code}`);
    }

    const numIncome = parseFloat(income) || 0;

    // Boundary matching rule:
    // For first slab: lower_bound <= income <= upper_bound
    // For subsequent slabs: income > lower_bound AND (upper_bound IS NULL OR income <= upper_bound)
    for (const slab of slabs) {
      const lower = parseFloat(slab.lower_bound);
      const upper = slab.upper_bound !== null && slab.upper_bound !== undefined ? parseFloat(slab.upper_bound) : null;

      if (numIncome === 0 && lower === 0) {
        return { slab, year };
      }
      if (numIncome > lower && (upper === null || numIncome <= upper)) {
        return { slab, year };
      }
      if (numIncome === lower && lower === 0) {
        return { slab, year };
      }
    }

    // Default to the last slab if income exceeds max bound
    return { slab: slabs[slabs.length - 1], year };
  }

  /**
   * Calculate Annual Income Tax for a given taxable salary
   */
  static async calculateAnnualTax({ annualTaxableIncome, taxYearCode = 'PK-2026-27-SALARY' }) {
    const income = parseFloat(annualTaxableIncome);

    if (isNaN(income) || income < 0) {
      throw new Error('Annual taxable income cannot be negative or invalid.');
    }

    const { slab, year } = await this.findApplicableSlab(taxYearCode, income);

    const baseTax = parseFloat(slab.base_tax) || 0;
    const rate = parseFloat(slab.marginal_rate) || 0;
    const excessOver = parseFloat(slab.excess_over) || 0;

    const excessAmount = Math.max(0, income - excessOver);
    const marginalTax = excessAmount * rate;
    const annualTax = Math.round((baseTax + marginalTax) * 100) / 100;
    const monthlyAverageTax = Math.round((annualTax / 12) * 100) / 100;
    const effectiveRate = income > 0 ? Math.round((annualTax / income) * 10000) / 100 : 0;

    return {
      taxYear: year.code,
      taxYearName: year.name,
      countryCode: year.country_code,
      currencyCode: year.currency_code,
      annualTaxableIncome: income,
      annualTax,
      monthlyAverageTax,
      effectiveRate,
      slab: {
        id: slab.id,
        sequenceNo: slab.sequence_no,
        lowerBound: parseFloat(slab.lower_bound),
        upperBound: slab.upper_bound ? parseFloat(slab.upper_bound) : null,
        baseTax,
        marginalRate: rate,
        marginalRatePercentage: `${(rate * 100).toFixed(1)}%`,
        excessOver,
        excessAmount,
        description: slab.description
      }
    };
  }

  /**
   * Calculate Projected Monthly Payroll Tax Withholding
   */
  static async calculatePayrollWithholding({
    annualTaxableIncome,
    taxAlreadyWithheld = 0,
    remainingPeriods = 12,
    taxYearCode = 'PK-2026-27-SALARY'
  }) {
    const annualResult = await this.calculateAnnualTax({ annualTaxableIncome, taxYearCode });

    const projectedAnnualTax = annualResult.annualTax;
    const alreadyWithheld = parseFloat(taxAlreadyWithheld) || 0;
    const periodsLeft = Math.max(1, parseInt(remainingPeriods) || 12);

    const remainingTax = Math.max(0, projectedAnnualTax - alreadyWithheld);
    const currentPeriodTax = Math.round((remainingTax / periodsLeft) * 100) / 100;

    return {
      ...annualResult,
      taxAlreadyWithheld: alreadyWithheld,
      remainingPeriods: periodsLeft,
      remainingAnnualTax: remainingTax,
      currentPeriodTax
    };
  }

  /**
   * Retrieve all Tax Years
   */
  static async getTaxYears() {
    return await db('tax_years').select('*').orderBy('effective_from', 'desc');
  }

  /**
   * Retrieve Tax Slabs for a Tax Year
   */
  static async getTaxSlabs(taxYearId) {
    return await db('tax_slabs')
      .where({ tax_year_id: taxYearId })
      .orderBy('sequence_no', 'asc');
  }

  /**
   * Create or Update Tax Year
   */
  static async createTaxYear(data) {
    const [inserted] = await db('tax_years').insert({
      code: data.code,
      name: data.name,
      country_code: data.country_code || 'PK',
      currency_code: data.currency_code || 'PKR',
      tax_category: data.tax_category || 'SALARY',
      effective_from: data.effective_from,
      effective_to: data.effective_to,
      status: data.status || 'DRAFT',
      version: 1,
      source_reference: data.source_reference || 'Finance Act',
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return inserted;
  }

  /**
   * Create Tax Slab
   */
  static async createTaxSlab(data) {
    const [inserted] = await db('tax_slabs').insert({
      tax_year_id: data.tax_year_id,
      sequence_no: data.sequence_no,
      lower_bound: data.lower_bound,
      upper_bound: data.upper_bound || null,
      base_tax: data.base_tax || 0,
      marginal_rate: data.marginal_rate,
      excess_over: data.excess_over || 0,
      description: data.description || '',
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return inserted;
  }

  /**
   * Update Tax Slab
   */
  static async updateTaxSlab(id, data) {
    const [updated] = await db('tax_slabs')
      .where({ id })
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return updated;
  }

  /**
   * Delete Tax Slab
   */
  static async deleteTaxSlab(id) {
    return await db('tax_slabs').where({ id }).del();
  }
}

module.exports = TaxService;
