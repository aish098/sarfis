const sseConnections = new Map();

class NotificationService {
  static getConnections() {
    return sseConnections;
  }

  static addConnection(userId, res) {
    if (!sseConnections.has(userId)) {
      sseConnections.set(userId, []);
    }
    sseConnections.get(userId).push(res);
  }

  static removeConnection(userId, res) {
    const list = sseConnections.get(userId);
    if (list) {
      const idx = list.indexOf(res);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        sseConnections.delete(userId);
      }
    }
  }

  /**
   * Retrieves all user IDs in a company who currently possess the specified permission,
   * accounting for roles, overrides, and administrative bypasses.
   */
  static async getUsersWithPermission(companyId, permissionCode) {
    const db = require('../config/db');
    try {
      // 1. Get all users who have the permission via their roles
      const roleUsers = await db('user_roles as ur')
        .join('role_permissions as rp', 'ur.role_id', 'rp.role_id')
        .join('permissions as p', 'rp.permission_id', 'p.id')
        .select('ur.user_id')
        .where('ur.company_id', companyId)
        .andWhere('p.code', permissionCode);

      const roleUserIds = roleUsers.map(r => r.user_id);

      // 2. Get overrides for this permission in the company
      const overrides = await db('user_permission_overrides as upo')
        .join('permissions as p', 'upo.permission_id', 'p.id')
        .select('upo.user_id', 'upo.is_allowed')
        .where('upo.company_id', companyId)
        .andWhere('p.code', permissionCode)
        .andWhere('upo.approval_status', 'APPROVED')
        .andWhere('upo.is_deleted', false);

      const grantedUserIds = overrides.filter(o => o.is_allowed).map(o => o.user_id);
      const revokedUserIds = overrides.filter(o => !o.is_allowed).map(o => o.user_id);

      // Combine: (Role users minus revoked users) plus explicitly granted users
      const finalUserIds = new Set([
        ...roleUserIds.filter(uid => !revokedUserIds.includes(uid)),
        ...grantedUserIds
      ]);

      // 3. Always notify company admins/super admins as they oversee all approvals
      const companyAdmins = await db('company_users')
        .select('user_id')
        .where('company_id', companyId)
        .whereIn('role', ['Company Admin', 'Super Admin', 'Admin', 'Owner', 'CEO']);
        
      companyAdmins.forEach(cu => finalUserIds.add(cu.user_id));

      return Array.from(finalUserIds);
    } catch (err) {
      console.error('Error resolving users with permission:', err);
      return [];
    }
  }

  /**
   * Create a notification record and stream it to the user if online.
   */
  static async createNotification({ companyId, userId, title, message, type = 'system', priority = 'MEDIUM', entityType = null, entityId = null }) {
    const db = require('../config/db');
    try {
      // 1. Retrieve user notification preferences (company-specific first, then global default)
      const pref = await db('user_notification_preferences')
        .where({ user_id: userId })
        .andWhere((builder) => {
          builder.where('company_id', companyId).orWhereNull('company_id');
        })
        .orderBy('company_id', 'desc')
        .first();

      const emailEnabled = pref ? pref.email_enabled : true;
      const inAppEnabled = pref ? pref.in_app_enabled : true;
      const criticalOnly = pref ? pref.critical_only : false;

      // 2. Filter priority if criticalOnly is enabled (only allow HIGH and CRITICAL)
      if (criticalOnly && !['HIGH', 'CRITICAL'].includes(priority?.toUpperCase())) {
        return null;
      }

      // 3. Simulate email dispatch if enabled
      if (emailEnabled) {
        const recipient = await db('users').where({ id: userId }).first();
        const email = recipient ? recipient.email : 'unknown@domain.com';
        console.log(`[EMAIL DISPATCH] Sending notification email to ${email} | Title: "${title}" | Message: "${message}"`);
      }

      // 4. Skip saving/streaming if in-app notifications are disabled
      if (!inAppEnabled) {
        return null;
      }

      const [notif] = await db('notifications')
        .insert({
          company_id: companyId,
          user_id: userId,
          title,
          message,
          type,
          priority,
          entity_type: entityType,
          entity_id: entityId,
          is_read: false,
          is_archived: false
        })
        .returning('*');

      // Dispatch real-time event via SSE if user is online
      const list = sseConnections.get(userId);
      if (list && list.length > 0) {
        const payload = JSON.stringify(notif);
        list.forEach(res => {
          res.write(`data: ${payload}\n\n`);
        });
      }
      return notif;
    } catch (err) {
      console.error('Failed to create notification:', err);
      return null;
    }
  }

  /**
   * Route a notification to all users holding a specific permission inside the company.
   */
  static async notifyUsersWithPermission({ companyId, permissionCode, title, message, type, priority = 'MEDIUM', entityType = null, entityId = null }) {
    const userIds = await this.getUsersWithPermission(companyId, permissionCode);
    const notifications = [];
    for (const userId of userIds) {
      const notif = await this.createNotification({
        companyId,
        userId,
        title,
        message,
        type,
        priority,
        entityType,
        entityId
      });
      if (notif) notifications.push(notif);
    }
    return notifications;
  }
}

module.exports = NotificationService;
