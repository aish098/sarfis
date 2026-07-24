const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/knex');
const AppError = require('../errors/AppError');

class AuthService {
  async login(email, password, deviceInfo = '', ipAddress = '') {
    const admin = await db('admins')
      .leftJoin('admin_roles', 'admins.role_id', 'admin_roles.id')
      .whereRaw('LOWER(admins.email) = ?', [email.toLowerCase()])
      .select('admins.*', 'admin_roles.name as role_name')
      .first();

    if (!admin) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    if (!admin.role_name) {
      admin.role_name = 'SUPER_ADMIN';
    }

    if (admin.status !== 'ACTIVE') {
      throw new AppError('Admin account is suspended or inactive.', 403, 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    // Check if initial password change is mandatory
    const mustChangePassword = !!admin.must_change_password;
    const tokenScope = mustChangePassword ? 'CHANGE_PASSWORD_ONLY' : 'FULL_ACCESS';

    const permissions = await db('admin_permissions')
      .where({ role_id: admin.role_id })
      .pluck('permission');

    // 1. Generate 15-Minute Access Token
    const accessToken = jwt.sign(
      { admin_id: admin.id, email: admin.email, role: admin.role_name, scope: tokenScope },
      process.env.JWT_ACCESS_SECRET || 'super_secret_saas_admin_jwt_access_key_2026_x89234_secure_min32',
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    // 2. Generate Token Family ID & Refresh Token
    const familyId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').insert({
      id: sessionId,
      family_id: familyId,
      admin_id: admin.id,
      token_hash: refreshTokenHash,
      parent_token_id: null,
      device_info: deviceInfo,
      ip_address: ipAddress,
      is_revoked: false,
      expires_at: expiresAt
    });

    await db('admins').where({ id: admin.id }).update({ last_login_at: new Date() });

    return {
      accessToken,
      refreshToken: `${sessionId}.${refreshTokenRaw}`,
      mustChangePassword,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role_name,
        permissions
      }
    };
  }

  async changeInitialPassword(adminId, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long.', 400, 'WEAK_PASSWORD');
    }

    const admin = await db('admins').where({ id: adminId }).first();
    if (!admin) {
      throw new AppError('Admin not found.', 404, 'ADMIN_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      throw new AppError('Current password specified is incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await db('admins').where({ id: adminId }).update({
      password_hash: newPasswordHash,
      must_change_password: false,
      updated_at: new Date()
    });

    // Revoke all existing sessions to force re-login with new password
    await this.logoutAll(adminId);

    return { message: 'Password updated successfully. Please log in again.' };
  }

  async refresh(refreshTokenStr, deviceInfo = '', ipAddress = '') {
    if (!refreshTokenStr || !refreshTokenStr.includes('.')) {
      throw new AppError('Invalid refresh token format.', 400, 'INVALID_TOKEN');
    }

    const [sessionId, rawToken] = refreshTokenStr.split('.');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const session = await db('refresh_tokens as rt')
      .join('admins as a', 'rt.admin_id', 'a.id')
      .join('admin_roles as ar', 'a.role_id', 'ar.id')
      .where({ 'rt.id': sessionId })
      .select('rt.*', 'a.id as admin_id', 'a.name', 'a.email', 'ar.name as role_name', 'a.role_id', 'a.status as admin_status', 'a.must_change_password')
      .first();

    if (!session) {
      throw new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Token Family Reuse Detection!
    if (session.is_revoked || session.token_hash !== tokenHash) {
      // SECURITY WARNING: Token Reuse Detected! Revoke entire token family!
      await db('refresh_tokens')
        .where({ family_id: session.family_id })
        .update({ is_revoked: true, revocation_reason: 'TOKEN_REUSE_DETECTED' });

      // Log Security Audit Event
      await db('audit_logs').insert({
        request_id: crypto.randomUUID(),
        admin_id: session.admin_id,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        target_type: 'token_family',
        target_id: session.family_id,
        before_json: JSON.stringify({ session_id: sessionId }),
        after_json: JSON.stringify({ action: 'FAMILY_REVOKED' }),
        success: false,
        failure_code: 'TOKEN_REUSE_SECURITY_LOCK',
        ip_address: String(ipAddress),
        user_agent: String(deviceInfo),
        created_at: new Date()
      });

      throw new AppError('Security Alert: Refresh token reuse detected. All session tokens revoked.', 401, 'REFRESH_TOKEN_REUSE_DETECTED');
    }

    if (new Date(session.expires_at) < new Date()) {
      await db('refresh_tokens').where({ id: sessionId }).update({ is_revoked: true, revocation_reason: 'EXPIRED' });
      throw new AppError('Refresh token expired. Please log in again.', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    // Mark current session as replaced / revoked
    await db('refresh_tokens').where({ id: sessionId }).update({ is_revoked: true, revocation_reason: 'ROTATED' });

    // Issue New Token in Same Family
    const newSessionId = crypto.randomUUID();
    const newRefreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshTokenRaw).digest('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').insert({
      id: newSessionId,
      family_id: session.family_id,
      admin_id: session.admin_id,
      token_hash: newRefreshTokenHash,
      parent_token_id: sessionId,
      device_info: deviceInfo,
      ip_address: ipAddress,
      is_revoked: false,
      expires_at: newExpiresAt
    });

    const tokenScope = session.must_change_password ? 'CHANGE_PASSWORD_ONLY' : 'FULL_ACCESS';
    const newAccessToken = jwt.sign(
      { admin_id: session.admin_id, email: session.email, role: session.role_name, scope: tokenScope },
      process.env.JWT_ACCESS_SECRET || 'super_secret_saas_admin_jwt_access_key_2026_x89234_secure_min32',
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    return {
      accessToken: newAccessToken,
      refreshToken: `${newSessionId}.${newRefreshTokenRaw}`
    };
  }

  async logout(refreshTokenStr) {
    if (!refreshTokenStr || !refreshTokenStr.includes('.')) return;
    const [sessionId] = refreshTokenStr.split('.');
    await db('refresh_tokens').where({ id: sessionId }).update({ is_revoked: true, revocation_reason: 'LOGOUT' });
  }

  async logoutAll(adminId) {
    await db('refresh_tokens').where({ admin_id: adminId }).update({ is_revoked: true, revocation_reason: 'LOGOUT_ALL' });
  }

  async getActiveSessions(adminId) {
    return await db('refresh_tokens')
      .where({ admin_id: adminId, is_revoked: false })
      .andWhere('expires_at', '>', new Date())
      .select('id', 'family_id', 'device_info', 'ip_address', 'created_at', 'expires_at');
  }
}

module.exports = new AuthService();
