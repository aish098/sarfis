const { z } = require('zod');

const calculateSchema = z.object({
  annualTaxableIncome: z.coerce.number().min(0, 'Annual taxable income cannot be negative.').optional(),
  annual_salary: z.coerce.number().min(0, 'Annual salary cannot be negative.').optional(),
  taxYearCode: z.string().min(1).optional(),
  taxYear: z.string().min(1).optional(),
  countryCode: z.string().length(2).default('PK'),
  taxCategory: z.string().default('SALARY'),
  calculationDate: z.string().or(z.date()).optional()
}).refine(data => data.annualTaxableIncome !== undefined || data.annual_salary !== undefined, {
  message: 'Either annualTaxableIncome or annual_salary must be provided.',
  path: ['annualTaxableIncome']
});

const withholdingSchema = z.object({
  annualTaxableIncome: z.coerce.number().min(0, 'Annual taxable income cannot be negative.'),
  taxAlreadyWithheld: z.coerce.number().min(0, 'Tax already withheld cannot be negative.').default(0),
  remainingPeriods: z.coerce.number().int().min(1, 'Remaining periods must be at least 1.').max(12, 'Remaining periods cannot exceed 12.').default(12),
  taxYearCode: z.string().optional(),
  countryCode: z.string().length(2).default('PK'),
  taxCategory: z.string().default('SALARY'),
  calculationDate: z.string().or(z.date()).optional()
});

const createTaxYearSchema = z.object({
  code: z.string().min(3, 'Tax year code must be at least 3 characters long.'),
  name: z.string().min(3, 'Tax year name must be at least 3 characters long.'),
  country_code: z.string().default('PK'),
  currency_code: z.string().default('PKR'),
  tax_category: z.string().default('SALARY'),
  effective_from: z.string().min(1, 'effective_from is required.'),
  effective_to: z.string().min(1, 'effective_to is required.'),
  source_reference: z.string().optional(),
  source_version: z.string().optional(),
  gazette_number: z.string().optional(),
  notification_number: z.string().optional(),
  official_document_url: z.string().url().optional().or(z.literal('')),
  published_date: z.string().optional()
});

const createTaxSlabSchema = z.object({
  tax_year_id: z.coerce.number().int().positive('tax_year_id must be a positive integer.'),
  sequence_no: z.coerce.number().int().positive('sequence_no must be a positive integer.'),
  lower_bound: z.coerce.number().min(0, 'lower_bound must be greater than or equal to 0.'),
  upper_bound: z.coerce.number().nullable().optional(),
  base_tax: z.coerce.number().min(0, 'base_tax must be non-negative.').default(0),
  marginal_rate: z.coerce.number().min(0, 'marginal_rate must be between 0 and 1.').max(1, 'marginal_rate must be between 0 and 1.'),
  excess_over: z.coerce.number().min(0, 'excess_over must be non-negative.').default(0),
  description: z.string().optional()
}).refine(data => data.upper_bound === null || data.upper_bound === undefined || data.upper_bound > data.lower_bound, {
  message: 'upper_bound must be strictly greater than lower_bound.',
  path: ['upper_bound']
});

const validate = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse({
      ...req.body,
      ...req.params,
      ...req.query
    });
    req.validatedBody = validated;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    next(err);
  }
};

module.exports = {
  calculateSchema,
  withholdingSchema,
  createTaxYearSchema,
  createTaxSlabSchema,
  validate
};
