const db = require('../config/db');

class SessionService {
  /**
   * Fetch active sessions for a user
   */
  static async getUserSessions(userId) {
    return await db('user_sessions')
      .where({ user_id: userId, is_active: true })
      .orderBy('last_activity', 'desc')
      .select('id', 'authentication_method', 'ip_address', 'user_agent', 'device_name', 'browser', 'os', 'created_at', 'last_activity', 'expires_at');
  }

  /**
   * Revoke a single active session
   */
  static async revokeSession(sessionId, userId) {
    return await db('user_sessions')
      .where({ id: sessionId, user_id: userId })
      .update({
        is_active: false,
        revoked_at: db.fn.now()
      });
  }

  /**
   * Force logout from all active sessions
   */
  static async revokeAllUserSessions(userId, currentSessionId = null) {
    const query = db('user_sessions')
      .where({ user_id: userId, is_active: true });

    if (currentSessionId) {
      query.whereNot({ id: currentSessionId });
    }

    return await query.update({
      is_active: false,
      revoked_at: db.fn.now()
    });
  }
}

module.exports = SessionService;
