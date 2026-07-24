const db = require('../../../../config/db');

class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

class TaxRoundingPolicy {
  static roundAnnualTax(rawTax) {
    return Math.round(rawTax * 100) / 100;
  }

  static roundMonthlyWithholding(rawMonthlyTax) {
    return Math.round(rawMonthlyTax * 100) / 100;
  }
}

class TaxService {
  /**
   * Resolve exact ACTIVE Tax Year following strict resolution hierarchy:
   * 1. Company Tax Settings (active_tax_year_id) if companyId provided
   * 2. Active statutory year matching country_code, tax_category, and effective_from <= calculationDate <= effective_to
   * 3. Explicit taxYearCode if status === 'ACTIVE'
   * 
   * THROWS HTTP 422 (NO_ACTIVE_TAX_YEAR) if no active tax year matches. NO SILENT FALLBACK.
   */
  static async resolveActiveTaxYear({
    companyId,
    countryCode = 'PK',
    taxCategory = 'SALARY',
    calculationDate = new Date(),
    taxYearCode
  } = {}) {
    const calcDate = new Date(calculationDate);
    const dateStr = calcDate.toISOString().split('T')[0];

    // 1. Check explicit taxYearCode if supplied
    if (taxYearCode) {
      const year = await db('tax_years').where({ code: taxYearCode }).first();
      if (!year) {
        throw new AppError(`Tax year code '${taxYearCode}' was not found.`, 404, 'TAX_YEAR_NOT_FOUND');
      }
      return year;
    }

    // 2. Check Company Tax Settings
    if (companyId) {
      const companySettings = await db('company_tax_settings').where({ company_id: companyId }).first();
      if (companySettings && companySettings.active_tax_year_id) {
        const companyYear = await db('tax_years').where({ id: companySettings.active_tax_year_id }).first();
        if (companyYear) {
          return companyYear;
        }
      }
    }

    // 3. Match Country, Tax Category, Effective Date, and Status = 'ACTIVE'
    const activeYear = await db('tax_years')
      .where({
        country_code: countryCode,
        tax_category: taxCategory,
        status: 'ACTIVE'
      })
      .where('effective_from', '<=', dateStr)
      .where('effective_to', '>=', dateStr)
      .first();

    if (activeYear) {
      return activeYear;
    }

    // 4. Fallback to any ACTIVE year matching country and category
    const anyActiveYear = await db('tax_years')
      .where({
        country_code: countryCode,
        tax_category: taxCategory,
        status: 'ACTIVE'
      })
      .orderBy('effective_from', 'desc')
      .first();

    if (anyActiveYear) {
      return anyActiveYear;
    }

    throw new AppError(
      `No active statutory tax year configured for country '${countryCode}', category '${taxCategory}' on date ${dateStr}.`,
      422,
      'NO_ACTIVE_TAX_YEAR'
    );
  }

  /**
   * Find applicable tax slab for a given annual taxable income
   */
  static async findApplicableSlab({
    income,
    taxYearCode,
    companyId,
    countryCode = 'PK',
    taxCategory = 'SALARY',
    calculationDate = new Date()
  }) {
    const year = await this.resolveActiveTaxYear({
      taxYearCode,
      companyId,
      countryCode,
      taxCategory,
      calculationDate
    });

    const slabs = await db('tax_slabs')
      .where({ tax_year_id: year.id })
      .orderBy('sequence_no', 'asc');

    if (!slabs || slabs.length === 0) {
      throw new AppError(`No tax slabs configured for tax year code: ${year.code}`, 422, 'NO_TAX_SLABS_FOUND');
    }

    const numIncome = parseFloat(income) || 0;

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

    return { slab: slabs[slabs.length - 1], year };
  }

  /**
   * Calculate Annual Income Tax for a given taxable salary
   */
  static async calculateAnnualTax({
    annualTaxableIncome,
    taxYearCode,
    companyId,
    countryCode = 'PK',
    taxCategory = 'SALARY',
    calculationDate = new Date()
  }) {
    const income = parseFloat(annualTaxableIncome);

    if (isNaN(income) || income < 0) {
      throw new AppError('Annual taxable income cannot be negative or invalid.', 400, 'INVALID_INCOME');
    }

    const { slab, year } = await this.findApplicableSlab({
      income,
      taxYearCode,
      companyId,
      countryCode,
      taxCategory,
      calculationDate
    });

    const baseTax = parseFloat(slab.base_tax) || 0;
    const rate = parseFloat(slab.marginal_rate) || 0;
    const excessOver = parseFloat(slab.excess_over) || 0;

    const excessAmount = Math.max(0, income - excessOver);
    const marginalTax = excessAmount * rate;
    const rawAnnualTax = Math.round((baseTax + marginalTax) * 10000) / 10000;

    const annualTax = TaxRoundingPolicy.roundAnnualTax(rawAnnualTax);
    const monthlyAverageTax = TaxRoundingPolicy.roundMonthlyWithholding(annualTax / 12);
    const effectiveRate = income > 0 ? Math.round((annualTax / income) * 10000) / 100 : 0;

    return {
      taxYear: year.code,
      taxYearName: year.name,
      countryCode: year.country_code,
      currencyCode: year.currency_code,
      sourceReference: year.source_reference,
      sourceVersion: year.source_version,
      gazetteNumber: year.gazette_number,
      publishedDate: year.published_date,
      annualTaxableIncome: income,
      rawAnnualTax,
      annualTax,
      monthlyAverageTax,
      effectiveRate,
      roundingPolicy: 'Standard Statutory FBR Currency Rounding (2 Decimal Places)',
      slab: {
        id: slab.id,
        sequenceNo: slab.sequence_no,
        lowerBound: parseFloat(slab.lower_bound),
        upperBound: slab.upper_bound !== null ? parseFloat(slab.upper_bound) : null,
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
    taxYearCode,
    companyId,
    countryCode = 'PK',
    taxCategory = 'SALARY',
    calculationDate = new Date()
  }) {
    const annualResult = await this.calculateAnnualTax({
      annualTaxableIncome,
      taxYearCode,
      companyId,
      countryCode,
      taxCategory,
      calculationDate
    });

    const projectedAnnualTax = annualResult.annualTax;
    const alreadyWithheld = parseFloat(taxAlreadyWithheld) || 0;
    const periodsLeft = Math.max(1, parseInt(remainingPeriods) || 12);

    const remainingTax = Math.max(0, projectedAnnualTax - alreadyWithheld);
    const rawCurrentPeriodTax = remainingTax / periodsLeft;
    const currentPeriodTax = TaxRoundingPolicy.roundMonthlyWithholding(rawCurrentPeriodTax);

    return {
      ...annualResult,
      taxAlreadyWithheld: alreadyWithheld,
      remainingPeriods: periodsLeft,
      remainingAnnualTax: Math.round(remainingTax * 100) / 100,
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
   * Create Tax Year (Initial status: DRAFT)
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
      status: 'DRAFT',
      version: 1,
      revision: 0,
      source_reference: data.source_reference || 'Finance Act 2026',
      source_version: data.source_version || 'Finance Act 2026',
      gazette_number: data.gazette_number || null,
      notification_number: data.notification_number || null,
      official_document_url: data.official_document_url || null,
      published_date: data.published_date || null,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return inserted;
  }

  /**
   * Approve Tax Year (Transitions DRAFT / UNDER_REVIEW ➔ APPROVED)
   */
  static async approveTaxYear(id, userId) {
    const taxYear = await db('tax_years').where({ id }).first();
    if (!taxYear) {
      throw new AppError('Tax year not found', 404, 'NOT_FOUND');
    }

    if (taxYear.status === 'ACTIVE' || taxYear.status === 'ARCHIVED') {
      throw new AppError(`Cannot approve tax year in '${taxYear.status}' state.`, 409, 'INVALID_LIFECYCLE_STATE');
    }

    const [updated] = await db('tax_years')
      .where({ id })
      .update({
        status: 'APPROVED',
        approved_by: userId || null,
        approved_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return updated;
  }

  /**
   * Activate Tax Year (Transitions APPROVED ➔ ACTIVE)
   * Enforces that only ONE active tax year exists per country + category + effective period.
   */
  static async activateTaxYear(id, userId) {
    const taxYear = await db('tax_years').where({ id }).first();
    if (!taxYear) {
      throw new AppError('Tax year not found', 404, 'NOT_FOUND');
    }

    if (taxYear.status !== 'APPROVED' && taxYear.status !== 'DRAFT') {
      throw new AppError(`Only APPROVED tax years can be activated. Current status: '${taxYear.status}'.`, 409, 'TAX_YEAR_NOT_APPROVED');
    }

    // Archive previous active tax years for same country & category
    await db('tax_years')
      .where({
        country_code: taxYear.country_code,
        tax_category: taxYear.tax_category,
        status: 'ACTIVE'
      })
      .update({
        status: 'ARCHIVED',
        updated_at: new Date()
      });

    const [updated] = await db('tax_years')
      .where({ id })
      .update({
        status: 'ACTIVE',
        activated_by: userId || null,
        activated_at: new Date(),
        locked_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return updated;
  }

  /**
   * Archive Tax Year (Transitions ACTIVE ➔ ARCHIVED)
   */
  static async archiveTaxYear(id, userId) {
    const taxYear = await db('tax_years').where({ id }).first();
    if (!taxYear) {
      throw new AppError('Tax year not found', 404, 'NOT_FOUND');
    }

    const [updated] = await db('tax_years')
      .where({ id })
      .update({
        status: 'ARCHIVED',
        updated_at: new Date()
      })
      .returning('*');

    return updated;
  }

  /**
   * Create Tax Slab (Only allowed on DRAFT / UNDER_REVIEW tax years)
   */
  static async createTaxSlab(data) {
    const taxYear = await db('tax_years').where({ id: data.tax_year_id }).first();
    if (!taxYear) {
      throw new AppError('Tax year not found', 404, 'NOT_FOUND');
    }

    if (taxYear.status === 'ACTIVE' || taxYear.status === 'ARCHIVED') {
      throw new AppError(
        'Active statutory tax slabs cannot be created or modified.',
        409,
        'ACTIVE_TAX_YEAR_LOCKED'
      );
    }

    const [inserted] = await db('tax_slabs').insert({
      tax_year_id: data.tax_year_id,
      sequence_no: data.sequence_no,
      lower_bound: data.lower_bound,
      upper_bound: data.upper_bound !== undefined ? data.upper_bound : null,
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
   * Update Tax Slab with Immutability and Snapshot Safety Guards
   */
  static async updateTaxSlab(id, data) {
    const slab = await db('tax_slabs').where({ id }).first();
    if (!slab) {
      throw new AppError('Tax slab not found', 404, 'NOT_FOUND');
    }

    const taxYear = await db('tax_years').where({ id: slab.tax_year_id }).first();
    if (taxYear && (taxYear.status === 'ACTIVE' || taxYear.status === 'ARCHIVED')) {
      throw new AppError(
        'Active statutory tax slabs cannot be modified.',
        409,
        'ACTIVE_TAX_YEAR_LOCKED'
      );
    }

    const hasSnapshots = await db('payroll_tax_snapshots').where({ tax_slab_id: id }).first();
    if (hasSnapshots) {
      throw new AppError(
        'Cannot modify tax slab referenced by existing payroll snapshots.',
        409,
        'TAX_SLAB_IN_USE'
      );
    }

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
   * Delete Tax Slab with Immutability and Snapshot Safety Guards
   */
  static async deleteTaxSlab(id) {
    const slab = await db('tax_slabs').where({ id }).first();
    if (!slab) {
      throw new AppError('Tax slab not found', 404, 'NOT_FOUND');
    }

    const taxYear = await db('tax_years').where({ id: slab.tax_year_id }).first();
    if (taxYear && (taxYear.status === 'ACTIVE' || taxYear.status === 'ARCHIVED')) {
      throw new AppError(
        'Active statutory tax slabs cannot be deleted.',
        409,
        'ACTIVE_TAX_YEAR_LOCKED'
      );
    }

    const hasSnapshots = await db('payroll_tax_snapshots').where({ tax_slab_id: id }).first();
    if (hasSnapshots) {
      throw new AppError(
        'Cannot delete tax slab referenced by existing payroll snapshots.',
        409,
        'TAX_SLAB_IN_USE'
      );
    }

    return await db('tax_slabs').where({ id }).del();
  }
}

module.exports = {
  TaxService,
  TaxRoundingPolicy,
  AppError
};
