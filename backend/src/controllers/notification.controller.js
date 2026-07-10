const db = require('../config/db');
const NotificationService = require('../services/notification.service');

exports.getNotifications = async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: 'Company context required.' });

  try {
    const { 
      includeArchived, 
      isRead, 
      priority, 
      type, 
      search, 
      startDate, 
      endDate 
    } = req.query;

    let query = db('notifications')
      .where({ company_id: companyId, user_id: req.user.id });

    // Handle archived filter
    if (includeArchived === 'true') {
      // Return both active and archived
    } else if (includeArchived === 'only') {
      query = query.where({ is_archived: true });
    } else {
      query = query.where({ is_archived: false });
    }

    // Handle read filter
    if (isRead === 'true') {
      query = query.where({ is_read: true });
    } else if (isRead === 'false') {
      query = query.where({ is_read: false });
    }

    // Handle priority filter
    if (priority) {
      query = query.where({ priority: priority.toUpperCase() });
    }

    // Handle type filter
    if (type) {
      query = query.where({ type });
    }

    // Handle search text
    if (search) {
      query = query.andWhere((builder) => {
        builder.whereILike('title', `%${search}%`)
               .orWhereILike('message', `%${search}%`);
      });
    }

    // Handle date range
    if (startDate) {
      query = query.where('created_at', '>=', new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.where('created_at', '<=', end);
    }

    const notifications = await query
      .orderBy('created_at', 'desc')
      .limit(200);

    res.json(notifications);
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.streamNotifications = (req, res) => {
  const userId = req.user.id;

  // Enforce SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // Establish stream immediately

  // Register client connection
  NotificationService.addConnection(userId, res);

  // Send initial ping to verify channel
  res.write("event: ping\ndata: {}\n\n");

  // Keep-alive heartbeat every 15 seconds to prevent Railway/proxy drops
  const pingInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(pingInterval);
      return;
    }
    res.write("event: ping\ndata: {}\n\n");
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    NotificationService.removeConnection(userId, res);
  });
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  try {
    await db('notifications')
      .where({ id, user_id: req.user.id, company_id: companyId })
      .update({ is_read: true });

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.archiveNotification = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  try {
    await db('notifications')
      .where({ id, user_id: req.user.id, company_id: companyId })
      .update({ is_archived: true });

    res.json({ success: true, message: 'Notification archived.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  const companyId = req.companyId;

  try {
    await db('notifications')
      .where({ user_id: req.user.id, company_id: companyId, is_archived: false })
      .update({ is_read: true });

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.unarchiveNotification = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  try {
    await db('notifications')
      .where({ id, user_id: req.user.id, company_id: companyId })
      .update({ is_archived: false });

    res.json({ success: true, message: 'Notification unarchived.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPreferences = async (req, res) => {
  const companyId = req.companyId;
  try {
    const events = await db('notification_events').orderBy('module').orderBy('event_name');
    const prefs = await db('user_notification_preferences').where({ user_id: req.user.id, company_id: companyId });

    const response = events.map(ev => {
      const p = prefs.find(x => x.event_id === ev.id);
      return {
        eventId: ev.id,
        eventCode: ev.event_code,
        eventName: ev.event_name,
        module: ev.module,
        category: ev.category,
        description: ev.description,
        email: p ? p.email : true,
        app: p ? p.app : true,
        sms: p ? p.sms : false,
        push: p ? p.push : false,
        whatsapp: p ? p.whatsapp : false
      };
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePreferences = async (req, res) => {
  const companyId = req.companyId;
  const { preferences } = req.body;

  try {
    await db.transaction(async trx => {
      for (const p of preferences) {
        const existing = await trx('user_notification_preferences')
          .where({ company_id: companyId, user_id: req.user.id, event_id: p.eventId })
          .first();

        if (existing) {
          await trx('user_notification_preferences')
            .where({ id: existing.id })
            .update({
              email: !!p.email,
              app: !!p.app,
              sms: !!p.sms,
              push: !!p.push,
              whatsapp: !!p.whatsapp
            });
        } else {
          await trx('user_notification_preferences')
            .insert({
              company_id: companyId,
              user_id: req.user.id,
              event_id: p.eventId,
              email: !!p.email,
              app: !!p.app,
              sms: !!p.sms,
              push: !!p.push,
              whatsapp: !!p.whatsapp
            });
        }
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── EMAIL CENTER ──────────────────────────────────────────
exports.getEmailQueue = async (req, res) => {
  const companyId = req.companyId;
  try {
    const { status, search } = req.query;

    let query = db('notification_queue as nq')
      .join('users as u', 'nq.user_id', 'u.id')
      .join('notification_events as ne', 'nq.event_code', 'ne.event_code')
      .where('nq.company_id', companyId)
      .select(
        'nq.*',
        'u.name as recipient_name',
        'ne.module',
        'ne.priority'
      );

    if (status) {
      query = query.where('nq.status', status.toUpperCase());
    }

    if (search) {
      query = query.andWhere(builder => {
        builder.whereILike('nq.recipient_email', `%${search}%`)
          .orWhereILike('nq.subject', `%${search}%`);
      });
    }

    const queue = await query.orderBy('nq.created_at', 'desc').limit(200);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resendEmail = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  try {
    const item = await db('notification_queue').where({ id, company_id: companyId }).first();
    if (!item) {
      return res.status(404).json({ error: 'Notification queue item not found.' });
    }

    await NotificationService.resendQueueItem(id);
    res.json({ success: true, message: 'Re-queued email for immediate delivery.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
