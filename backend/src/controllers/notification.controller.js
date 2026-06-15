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
      .update({ is_read: true, updated_at: db.fn.now() });

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
      .update({ is_archived: true, updated_at: db.fn.now() });

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
      .update({ is_read: true, updated_at: db.fn.now() });

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
      .update({ is_archived: false, updated_at: db.fn.now() });

    res.json({ success: true, message: 'Notification unarchived.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPreferences = async (req, res) => {
  const companyId = req.companyId;
  try {
    let pref = await db('user_notification_preferences')
      .where({ user_id: req.user.id })
      .andWhere((builder) => {
        builder.where('company_id', companyId).orWhereNull('company_id');
      })
      .orderBy('company_id', 'desc') // company-specific first
      .first();

    if (!pref) {
      pref = {
        email_enabled: true,
        in_app_enabled: true,
        critical_only: false
      };
    }
    res.json(pref);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePreferences = async (req, res) => {
  const companyId = req.companyId;
  const { email_enabled, in_app_enabled, critical_only } = req.body;

  try {
    // Check if preference already exists for this user/company
    const existing = await db('user_notification_preferences')
      .where({ user_id: req.user.id, company_id: companyId })
      .first();

    if (existing) {
      const [updated] = await db('user_notification_preferences')
        .where({ id: existing.id })
        .update({
          email_enabled: !!email_enabled,
          in_app_enabled: !!in_app_enabled,
          critical_only: !!critical_only,
          updated_at: db.fn.now()
        })
        .returning('*');
      res.json(updated);
    } else {
      const [inserted] = await db('user_notification_preferences')
        .insert({
          user_id: req.user.id,
          company_id: companyId,
          email_enabled: email_enabled !== undefined ? !!email_enabled : true,
          in_app_enabled: in_app_enabled !== undefined ? !!in_app_enabled : true,
          critical_only: !!critical_only
        })
        .returning('*');
      res.json(inserted);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
