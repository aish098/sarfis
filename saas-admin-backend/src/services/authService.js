const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/knex');
const AppError = require('../errors/AppError');

class AuthService {
  async login(email, password, deviceInfo = '', ipAddress = '') {
    const admin = await db('admins')
      .join('admin_roles', 'admins.role_id', 'admin_roles.id')
      .whereRaw('LOWER(admins.email) = ?', [email.toLowerCase()])
      .select('admins.*', 'admin_roles.name as role_name')
      .first();

    if (!admin) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    if (admin.status !== 'ACTIVE') {
      throw new AppError('Admin account is suspended or inactive.', 403, 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    const permissions = await db('admin_permissions')
      .where({ role_id: admin.role_id })
      .pluck('permission');

    // 1. Generate 15-Minute Access Token
    const accessToken = jwt.sign(
      { admin_id: admin.id, email: admin.email, role: admin.role_name },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'super_secret_saas_admin_jwt_key_2026_x89234',
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    // 2. Generate 7-Day Refresh Token & Store Session
    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').insert({
      id: sessionId,
      admin_id: admin.id,
      token_hash: refreshTokenHash,
      device_info: deviceInfo,
      ip_address: ipAddress,
      is_revoked: false,
      expires_at: expiresAt
    });

    await db('admins').where({ id: admin.id }).update({ last_login_at: new Date() });

    return {
      accessToken,
      refreshToken: `${sessionId}.${refreshTokenRaw}`,
      mustChangePassword: !!admin.must_change_password,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role_name,
        permissions
      }
    };
  }

  async refresh(refreshTokenStr) {
    if (!refreshTokenStr || !refreshTokenStr.includes('.')) {
      throw new AppError('Invalid refresh token format.', 400, 'INVALID_TOKEN');
    }

    const [sessionId, rawToken] = refreshTokenStr.split('.');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const session = await db('refresh_tokens as rt')
      .join('admins as a', 'rt.admin_id', 'a.id')
      .join('admin_roles as ar', 'a.role_id', 'ar.id')
      .where({ 'rt.id': sessionId, 'rt.is_revoked': false, 'a.status': 'ACTIVE' })
      .select('rt.*', 'a.id as admin_id', 'a.name', 'a.email', 'ar.name as role_name', 'a.role_id')
      .first();

    if (!session || session.token_hash !== tokenHash) {
      throw new AppError('Invalid or revoked refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (new Date(session.expires_at) < new Date()) {
      await db('refresh_tokens').where({ id: sessionId }).update({ is_revoked: true });
      throw new AppError('Refresh token expired. Please log in again.', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    // Rotate Refresh Token
    const newRefreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshTokenRaw).digest('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').where({ id: sessionId }).update({
      token_hash: newRefreshTokenHash,
      expires_at: newExpiresAt
    });

    const newAccessToken = jwt.sign(
      { admin_id: session.admin_id, email: session.email, role: session.role_name },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'super_secret_saas_admin_jwt_key_2026_x89234',
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    return {
      accessToken: newAccessToken,
      refreshToken: `${sessionId}.${newRefreshTokenRaw}`
    };
  }

  async logout(refreshTokenStr) {
    if (!refreshTokenStr || !refreshTokenStr.includes('.')) return;
    const [sessionId] = refreshTokenStr.split('.');
    await db('refresh_tokens').where({ id: sessionId }).update({ is_revoked: true });
  }

  async logoutAll(adminId) {
    await db('refresh_tokens').where({ admin_id: adminId }).update({ is_revoked: true });
  }

  async getActiveSessions(adminId) {
    return await db('refresh_tokens')
      .where({ admin_id: adminId, is_revoked: false })
      .andWhere('expires_at', '>', new Date())
      .select('id', 'device_info', 'ip_address', 'created_at', 'expires_at');
  }
}

module.exports = new AuthService();
