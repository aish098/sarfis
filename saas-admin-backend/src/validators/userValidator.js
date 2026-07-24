const { z } = require('zod');
const AppError = require('../errors/AppError');

const toggleBlockSchema = z.object({
  status: z.boolean({ required_error: "The parameter 'status' (boolean) is mandatory." }),
  reason: z.string().max(255).optional()
});

exports.validateToggleBlockStatus = (req, res, next) => {
  const result = toggleBlockSchema.safeParse(req.body);
  if (!result.success) {
    const formattedErrors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
    return next(new AppError(`Validation failed: ${formattedErrors}`, 400, 'VALIDATION_ERROR', result.error.errors));
  }
  req.body = result.data;
  next();
};
