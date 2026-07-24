const jwt = require('jsonwebtoken');
const db = require('../db/knex');
const AppError = require('../errors/AppError');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing Bearer token.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_saas_admin_jwt_key_2026_x89234');

    const admin = await db('admins')
      .join('admin_roles', 'admins.role_id', 'admin_roles.id')
      .where({ 'admins.id': decoded.admin_id, 'admins.status': 'ACTIVE' })
      .select('admins.id', 'admins.name', 'admins.email', 'admins.role_id', 'admin_roles.name as role_name')
      .first();

    if (!admin) {
      throw new AppError('Admin account not found or suspended.', 401, 'UNAUTHORIZED');
    }

    const permissions = await db('admin_permissions')
      .where({ role_id: admin.role_id })
      .pluck('permission');

    req.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role_name,
      permissions
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN'));
    }
    next(err);
  }
};
