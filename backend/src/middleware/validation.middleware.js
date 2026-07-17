const { z } = require('zod');

const accountSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(150),
  category: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Income', 'Expense']),
  normal_balance: z.enum(['Debit', 'Credit']),
  is_contra: z.boolean().default(false),
  current_classification: z.enum(['CURRENT', 'NON_CURRENT', 'NOT_APPLICABLE']).optional().default('NOT_APPLICABLE')
}).superRefine((data, ctx) => {
  const { category, normal_balance, is_contra, current_classification } = data;
  
  // Standard normal balances
  const stdBalance = ['Asset', 'Expense'].includes(category) ? 'Debit' : 'Credit';
  
  if (is_contra) {
    if (normal_balance === stdBalance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Contra ${category} accounts must have a ${stdBalance === 'Debit' ? 'Credit' : 'Debit'} normal balance.`,
        path: ['normal_balance']
      });
    }
  } else {
    if (normal_balance !== stdBalance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Standard ${category} accounts must have a ${stdBalance} normal balance.`,
        path: ['normal_balance']
      });
    }
  }

  // Classification rules:
  // - Required for Asset and Liability
  // - Must be NOT_APPLICABLE for others
  const isAssetOrLiab = ['Asset', 'Liability'].includes(category);
  if (isAssetOrLiab) {
    if (!current_classification || current_classification === 'NOT_APPLICABLE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Classification is required for Assets and Liabilities.',
        path: ['current_classification']
      });
    }
  } else {
    if (current_classification && current_classification !== 'NOT_APPLICABLE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only Assets and Liabilities can have a Current or Non-Current classification.',
        path: ['current_classification']
      });
    }
  }
});

const validateAccount = (req, res, next) => {
  try {
    const validatedData = accountSchema.parse(req.body);
    req.validatedBody = validatedData; // Attach validated data
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.errors.map(e => e.message).join(', ')
    });
  }
};

module.exports = { validateAccount, accountSchema };
