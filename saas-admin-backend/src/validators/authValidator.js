const { z } = require('zod');
const AppError = require('../errors/AppError');

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

exports.validateLogin = (req, res, next) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const formattedErrors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
    return next(new AppError(`Validation failed: ${formattedErrors}`, 400, 'VALIDATION_ERROR', result.error.errors));
  }
  req.body = result.data;
  next();
};
