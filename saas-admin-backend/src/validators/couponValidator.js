const { z } = require('zod');
const AppError = require('../errors/AppError');

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Coupon code must be at least 3 characters long')
    .max(50, 'Coupon code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Coupon code can only contain letters, numbers, underscores, and hyphens'),

  discount_type: z.enum([
    'percentage', 'fixed', 'free_trial', 'upgrade_discount', 'lifetime', 'referral', 'partner', 'internal'
  ]),

  discount_value: z.number().positive('Discount value must be greater than 0'),

  expiry_date: z.coerce.date().refine(
    date => date > new Date(),
    'Expiry date must be in the future'
  ),

  usage_limit: z.number().int().positive().max(1000000).optional().default(100)
}).superRefine((data, context) => {
  if (data.discount_type === 'percentage' && data.discount_value > 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discount_value'],
      message: 'Percentage discount value cannot exceed 100%'
    });
  }
});

exports.validateGenerateCoupon = (req, res, next) => {
  const result = couponSchema.safeParse(req.body);
  if (!result.success) {
    const formattedErrors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
    return next(new AppError(`Validation failed: ${formattedErrors}`, 400, 'VALIDATION_ERROR', result.error.errors));
  }
  req.body = result.data;
  next();
};
