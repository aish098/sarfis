const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/knex');
const AppError = require('../errors/AppError');

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400, 'VALIDATION_ERROR');
    }

    const admin = await db('admins')
      .join('admin_roles', 'admins.role_id', 'admin_roles.id')
      .whereRaw('LOWER(admins.email) = ?', [email.toLowerCase()])
      .select('admins.*', 'admin_roles.name as role_name')
      .first();

    if (!admin) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    if (admin.status !== 'ACTIVE') {
      throw new AppError('Admin account is suspended.', 403, 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    const permissions = await db('admin_permissions')
      .where({ role_id: admin.role_id })
      .pluck('permission');

    const token = jwt.sign(
      { admin_id: admin.id, email: admin.email, role: admin.role_name },
      process.env.JWT_SECRET || 'super_secret_saas_admin_jwt_key_2026_x89234',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    await db('admins').where({ id: admin.id }).update({ last_login_at: new Date() });

    return {
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role_name,
        permissions
      }
    };
  }
}

module.exports = new AuthService();
