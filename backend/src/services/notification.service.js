const db = require('../config/db');
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
   * Helper to retrieve all user IDs in a company who currently possess the specified permission.
   */
  static async getUsersWithPermission(companyId, permissionCode) {
    try {
      const roleUsers = await db('user_roles as ur')
        .join('role_permissions as rp', 'ur.role_id', 'rp.role_id')
        .join('permissions as p', 'rp.permission_id', 'p.id')
        .select('ur.user_id')
        .where('ur.company_id', companyId)
        .andWhere('p.code', permissionCode);

      const roleUserIds = roleUsers.map(r => r.user_id);

      const overrides = await db('user_permission_overrides as upo')
        .join('permissions as p', 'upo.permission_id', 'p.id')
        .select('upo.user_id', 'upo.is_allowed')
        .where('upo.company_id', companyId)
        .andWhere('p.code', permissionCode)
        .andWhere('upo.approval_status', 'APPROVED')
        .andWhere('upo.is_deleted', false);

      const grantedUserIds = overrides.filter(o => o.is_allowed).map(o => o.user_id);
      const revokedUserIds = overrides.filter(o => !o.is_allowed).map(o => o.user_id);

      const finalUserIds = new Set([
        ...roleUserIds.filter(uid => !revokedUserIds.includes(uid)),
        ...grantedUserIds
      ]);

      // Fallback: notify company admins/super admins
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
   * Central notify method mapping template variables, policy defaults, and preferences.
   */
  static async notify({ eventCode, companyId, payload = {}, forceUserIds = [], entityType = null, entityId = null }) {
    try {
      // 1. Fetch Event Definition
      const eventDef = await db('notification_events').where({ event_code: eventCode }).first();
      if (!eventDef) {
        console.warn(`[NOTIFY] Event definition not found for code: ${eventCode}`);
        return [];
      }

      // 2. Fetch Template
      const template = await db('notification_templates').where({ event_code: eventCode }).first();
      
      // Interpolate helper
      const interpolate = (str, vars = {}) => {
        let output = str || '';
        Object.entries(vars).forEach(([k, v]) => {
          output = output.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        });
        return output;
      };

      const title = template ? interpolate(template.subject, payload) : eventDef.event_name;
      const message = template ? interpolate(template.plain_body, payload) : JSON.stringify(payload);
      const htmlBody = template ? interpolate(template.html_body, payload) : `<p>${message}</p>`;

      // 3. Resolve Recipients
      let userIds = [...forceUserIds];
      if (userIds.length === 0) {
        const policies = await db('company_notification_policies')
          .where({ company_id: companyId, event_id: eventDef.id });

        const resolvedUsers = new Set();
        for (const policy of policies) {
          if (policy.recipient_type === 'USER') {
            resolvedUsers.add(parseInt(policy.recipient_value));
          } else if (policy.recipient_type === 'ROLE') {
            const roleUsers = await db('company_users')
              .where({ company_id: companyId, role: policy.recipient_value })
              .select('user_id');
            roleUsers.forEach(u => resolvedUsers.add(u.user_id));
          } else if (policy.recipient_type === 'PERMISSION') {
            const permUsers = await this.getUsersWithPermission(companyId, policy.recipient_value);
            permUsers.forEach(uid => resolvedUsers.add(uid));
          }
        }

        // Fallback to company admins if no policy exists
        if (resolvedUsers.size === 0) {
          const admins = await db('company_users')
            .where({ company_id: companyId })
            .whereIn('role', ['Company Admin', 'Super Admin', 'Admin'])
            .select('user_id');
          admins.forEach(u => resolvedUsers.add(u.user_id));
        }

        userIds = Array.from(resolvedUsers);
      }

      const results = [];

      // 4. Distribute Notifications per Recipient
      for (const userId of userIds) {
        // Load preference
        const pref = await db('user_notification_preferences')
          .where({ company_id: companyId, user_id: userId, event_id: eventDef.id })
          .first();

        const emailEnabled = pref ? pref.email : true;
        const appEnabled = pref ? pref.app : true;

        const recipient = await db('users').where({ id: userId }).first();
        if (!recipient) continue;

        // In-App delivery
        if (appEnabled) {
          const [notif] = await db('notifications')
            .insert({
              company_id: companyId,
              user_id: userId,
              event_code: eventCode,
              title,
              message,
              priority: eventDef.priority,
              is_read: false,
              entity_type: entityType,
              entity_id: entityId
            })
            .returning('*');

          // SSE real-time dispatch
          const connections = sseConnections.get(userId);
          if (connections && connections.length > 0) {
            const payloadStr = JSON.stringify(notif);
            connections.forEach(res => {
              res.write(`data: ${payloadStr}\n\n`);
            });
          }
          results.push({ userId, status: 'IN_APP_SENT', id: notif.id });
        }

        // Email Queue delivery
        if (emailEnabled) {
          await db('notification_queue').insert({
            company_id: companyId,
            user_id: userId,
            event_code: eventCode,
            recipient_email: recipient.email,
            subject: title,
            body: htmlBody,
            status: 'PENDING',
            attempts: 0,
            max_attempts: 3
          });
          results.push({ userId, status: 'EMAIL_QUEUED' });
        }
      }

      return results;
    } catch (err) {
      console.error('Central notify failed:', err);
      return [];
    }
  }

  /**
   * Scans queue and runs transactional sending loop.
   */
  static async processQueue() {
    try {
      const pendingItems = await db('notification_queue')
        .whereIn('status', ['PENDING', 'RETRY'])
        .andWhere('attempts', '<', db.ref('max_attempts'))
        .limit(30);

      for (const item of pendingItems) {
        const nextAttempts = item.attempts + 1;
        await db('notification_queue')
          .where({ id: item.id })
          .update({
            attempts: nextAttempts,
            last_attempt_at: db.fn.now()
          });

        try {
          // Simulate mailer - will trigger simulated fail if recipient is 'fail@domain.com'
          if (item.recipient_email === 'fail@domain.com') {
            throw new Error('SMTP connection rejected: Timeout');
          }

          console.log(`[EMAIL CENTER] Dispatched SMTP to ${item.recipient_email} | Subject: "${item.subject}"`);
          
          await db('notification_queue')
            .where({ id: item.id })
            .update({
              status: 'SENT',
              sent_at: db.fn.now(),
              error_log: null
            });
        } catch (err) {
          const reachedLimit = nextAttempts >= item.max_attempts;
          await db('notification_queue')
            .where({ id: item.id })
            .update({
              status: reachedLimit ? 'FAILED' : 'RETRY',
              error_log: err.message
            });
        }
      }
    } catch (err) {
      console.error('Queue runner failed:', err);
    }
  }

  /**
   * Reset attempts to queue resending.
   */
  static async resendQueueItem(itemId) {
    await db('notification_queue')
      .where({ id: itemId })
      .update({
        status: 'PENDING',
        attempts: 0,
        error_log: null,
        sent_at: null
      });
  }

  /**
   * Direct in-app sending (backward compatibility)
   */
  static async notifyDirect({ companyId, userIds, title, message, type = 'system', priority = 'MEDIUM', entityType = null, entityId = null }) {
    const results = [];
    for (const userId of userIds) {
      const [notif] = await db('notifications')
        .insert({
          company_id: companyId,
          user_id: userId,
          event_code: 'LOW_STOCK_ALERT', // default fallback code
          title,
          message,
          priority: priority?.toUpperCase() || 'MEDIUM',
          is_read: false,
          entity_type: entityType,
          entity_id: entityId
        })
        .returning('*');

      const connections = sseConnections.get(userId);
      if (connections && connections.length > 0) {
        const payloadStr = JSON.stringify(notif);
        connections.forEach(res => {
          res.write(`data: ${payloadStr}\n\n`);
        });
      }
      results.push(notif);
    }
    return results;
  }

  static async notifyUsersWithPermission({ companyId, permissionCode, title, message, type = 'system', priority = 'MEDIUM', entityType = null, entityId = null }) {
    const userIds = await this.getUsersWithPermission(companyId, permissionCode);
    return this.notifyDirect({ companyId, userIds, title, message, type, priority, entityType, entityId });
  }

  static async createNotification({ companyId, userId, title, message, type = 'system', priority = 'MEDIUM', entityType = null, entityId = null }) {
    return this.notifyDirect({ companyId, userIds: [userId], title, message, type, priority, entityType, entityId });
  }
}

// Start background queue processing ticker (every 10 seconds)
setInterval(() => {
  NotificationService.processQueue();
}, 10000);

module.exports = NotificationService;
