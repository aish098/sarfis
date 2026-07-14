const db = require('../config/db');
const sseConnections = new Map();
let isProcessingQueue = false;

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

      // 3. Resolve Recipients & Channels
      let userIds = [];
      const recipientChannels = new Map(); // userId -> Set of channels

      if (forceUserIds.length > 0) {
        userIds = [...forceUserIds];
        userIds.forEach(uid => {
          recipientChannels.set(uid, new Set(['EMAIL', 'APP']));
        });
      } else {
        const subscriptions = await db('employee_notification_subscriptions as ens')
          .join('employees as e', 'ens.employee_id', 'e.id')
          .join('users as u', 'e.user_id', 'u.id')
          .select('e.user_id', 'ens.channel', 'ens.enabled')
          .where({
            'ens.company_id': companyId,
            'ens.event_id': eventDef.id,
            'e.status': 'Active',
            'ens.enabled': true
          });

        if (subscriptions.length > 0) {
          subscriptions.forEach(sub => {
            const uid = sub.user_id;
            if (!uid) return;
            if (!recipientChannels.has(uid)) {
              recipientChannels.set(uid, new Set());
            }
            recipientChannels.get(uid).add(sub.channel.toUpperCase());
          });
          userIds = Array.from(recipientChannels.keys());
        } else {
          // Fallback to company policies and roles
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

          if (resolvedUsers.size === 0) {
            const admins = await db('company_users')
              .where({ company_id: companyId })
              .whereIn('role', ['Company Admin', 'Super Admin', 'Admin', 'Owner', 'CEO'])
              .select('user_id');
            admins.forEach(u => resolvedUsers.add(u.user_id));
          }

          userIds = Array.from(resolvedUsers);
          userIds.forEach(uid => {
            recipientChannels.set(uid, new Set(['EMAIL', 'APP']));
          });
        }
      }

      const results = [];

      // 4. Distribute Notifications per Recipient
      for (const userId of userIds) {
        const recipient = await db('users').where({ id: userId }).first();
        if (!recipient) continue;

        const userChannels = recipientChannels.get(userId) || new Set();
        const emailEnabled = userChannels.has('EMAIL');
        const appEnabled = userChannels.has('APP');
        const smsEnabled = userChannels.has('SMS');

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

        // SMS Simulation Delivery
        if (smsEnabled) {
          console.log(`[SMS GATEWAY] Simulated SMS sent to user ${userId} (${recipient.email}) | Msg: "${message}"`);
          results.push({ userId, status: 'SMS_SENT' });
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
    if (isProcessingQueue) {
      console.log('[Notification Queue] Connection guard active (processing in progress). Skipping run...');
      return;
    }
    isProcessingQueue = true;

    try {
      const pendingItems = await db('notification_queue')
        .whereIn('status', ['PENDING', 'RETRY'])
        .andWhere('attempts', '<', db.ref('max_attempts'))
        .limit(30);

      if (pendingItems.length === 0) {
        return;
      }

      console.log(`[Notification Queue] Processing ${pendingItems.length} items...`);
      const updates = [];
      const MailProvider = require('./mail/mail.provider');

      for (const item of pendingItems) {
        const nextAttempts = item.attempts + 1;
        let success = false;
        let errorMsg = null;

        try {
          await MailProvider.send({
            companyId: item.company_id,
            to: item.recipient_email,
            subject: item.subject,
            html: item.body
          });
          success = true;
        } catch (err) {
          errorMsg = err.message;
        }

        updates.push({
          id: item.id,
          companyId: item.company_id,
          subject: item.subject,
          eventCode: item.event_code,
          nextAttempts,
          maxAttempts: item.max_attempts,
          success,
          errorMsg
        });
      }

      // Perform all database updates inside a single batch transaction to release connections immediately
      await db.transaction(async (trx) => {
        for (const update of updates) {
          if (update.success) {
            await trx('notification_queue')
              .where({ id: update.id })
              .update({
                attempts: update.nextAttempts,
                last_attempt_at: trx.fn.now(),
                status: 'SENT',
                sent_at: trx.fn.now(),
                error_log: null
              });

            if (update.eventCode === 'CUSTOM_COMMUNICATION') {
              await trx('communications')
                .where({
                  company_id: update.companyId,
                  subject: update.subject,
                  status: 'QUEUED'
                })
                .update({ status: 'SENT' });
            }
          } else {
            const reachedLimit = update.nextAttempts >= update.maxAttempts;
            await trx('notification_queue')
              .where({ id: update.id })
              .update({
                attempts: update.nextAttempts,
                last_attempt_at: trx.fn.now(),
                status: reachedLimit ? 'FAILED' : 'RETRY',
                error_log: update.errorMsg
              });

            if (update.eventCode === 'CUSTOM_COMMUNICATION' && reachedLimit) {
              await trx('communications')
                .where({
                  company_id: update.companyId,
                  subject: update.subject,
                  status: 'QUEUED'
                })
                .update({ status: 'FAILED' });
            }
          }
        }
      });
      console.log('[Notification Queue] Batch updates committed successfully.');

    } catch (err) {
      console.error('[Notification Queue] Queue processing failed:', err);
    } finally {
      isProcessingQueue = false;
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

  // Weekly Monday check for >90% budget utilization (Phase 16B)
  static async checkWeeklyBudgets() {
    const activeHeaders = await db('budget_headers').where({ status: 'ACTIVE' });
    for (const header of activeHeaders) {
      const companyId = header.company_id;
      const lines = await db('budget_control_lines').where({ budget_header_id: header.id });
      for (const line of lines) {
        const alloc = parseFloat(line.current_budget_amount || line.allocated_amount || 0);
        if (alloc <= 0) continue;

        const actualRes = await db('budget_control_transactions')
          .where({ budget_control_line_id: line.id, status: 'ACTUAL' })
          .sum('amount as total');
        const act = parseFloat(actualRes[0]?.total || 0);

        const committedRes = await db('budget_control_transactions')
          .where({ budget_control_line_id: line.id, status: 'COMMITTED' })
          .sum('amount as total');
        const com = parseFloat(committedRes[0]?.total || 0);

        const consumed = act + com;
        const pct = (consumed / alloc) * 100;

        if (pct >= 90.00) {
          const message = `Budget limit warning: Department ${line.department || 'General'} has utilized ${pct.toFixed(1)}% of its allocated budget (${consumed.toLocaleString()} / ${alloc.toLocaleString()}).`;
          const title = `Budget Alert: ${line.department || 'General'} > 90%`;

          const admins = await db('company_users')
            .where({ company_id: companyId })
            .whereIn('role', ['Company Admin', 'Super Admin', 'Admin', 'Owner', 'CEO'])
            .select('user_id');

          const userIds = admins.map(a => a.user_id);
          if (userIds.length > 0) {
            let event = await db('notification_events').where({ event_code: 'BUDGET_BREACH_WARNING' }).first();
            if (!event) {
              const [newEv] = await db('notification_events').insert({
                event_code: 'BUDGET_BREACH_WARNING',
                event_name: 'Budget Utilization Warning',
                category: 'FINANCE',
                priority: 'HIGH',
                description: 'Triggers when a budget line exceeds 90% utilization'
              }).returning('*');
              event = newEv;
            }

            await NotificationService.notify({
              eventCode: 'BUDGET_BREACH_WARNING',
              companyId,
              payload: { subject: title, plain_body: message, html_body: `<p>${message}</p>` },
              forceUserIds: userIds
            });
          }
        }
      }
    }
  }
}

// Start background queue processing ticker (every 10 seconds)
setInterval(() => {
  NotificationService.processQueue();
}, 10000);

let lastCheckDay = null;
// Every Monday budget check ticker (runs once a day on Monday)
setInterval(async () => {
  const d = new Date();
  const day = d.getDay(); // 1 = Monday
  const dayStr = d.toISOString().split('T')[0];
  if (day === 1 && lastCheckDay !== dayStr) {
    lastCheckDay = dayStr;
    try {
      await NotificationService.checkWeeklyBudgets();
    } catch (err) {
      console.error('Error running weekly budget check:', err);
    }
  }
}, 60000);

module.exports = NotificationService;
