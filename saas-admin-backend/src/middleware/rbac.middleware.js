const AppError = require('../errors/AppError');

module.exports = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (req.admin.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!req.admin.permissions || !req.admin.permissions.includes(requiredPermission)) {
      return next(new AppError(`Forbidden. Permission '${requiredPermission}' is required to perform this action.`, 403, 'FORBIDDEN'));
    }

    next();
  };
};
