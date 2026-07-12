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
    // Dynamically heal/migrate System module to Communications for manual email triggers
    await db('notification_events')
      .where({ event_code: 'CUSTOM_COMMUNICATION', module: 'System' })
      .update({ module: 'Communications' });

    const events = await db('notification_events')
      .whereNot({ event_code: 'CUSTOM_COMMUNICATION' })
      .orderBy('module')
      .orderBy('event_name');
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
      .leftJoin('users as u', 'nq.user_id', 'u.id')
      .leftJoin('notification_events as ne', 'nq.event_code', 'ne.event_code')
      .where('nq.company_id', companyId)
      .select([
        'nq.*',
        db.raw("coalesce(u.name, nq.recipient_email) as recipient_name"),
        db.raw("coalesce(ne.module, 'ADMIN') as module"),
        db.raw("coalesce(ne.priority, 'MEDIUM') as priority")
      ]);

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

exports.composeCustomEmail = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.user?.id || 1;
  const { employeeId, subject, body } = req.body;

  if (!employeeId || !subject || !body) {
    return res.status(400).json({ error: 'Employee recipient, subject, and body are required.' });
  }

  try {
    // 1. Resolve employee email and linked user ID
    const employee = await db('employees as e')
      .leftJoin('users as u', 'e.user_id', 'u.id')
      .where({ 'e.id': employeeId, 'e.company_id': companyId })
      .select('e.*', 'u.email as user_email')
      .first();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const recipientEmail = employee.user_email || employee.email || null;
    if (!recipientEmail || recipientEmail === '—') {
      return res.status(400).json({ error: 'Selected employee does not have a registered corporate email address.' });
    }

    // 2. Ensure CUSTOM_COMMUNICATION event exists to satisfy foreign key constraints
    const eventExists = await db('notification_events').where({ event_code: 'CUSTOM_COMMUNICATION' }).first();
    if (!eventExists) {
      await db('notification_events').insert({
        event_code: 'CUSTOM_COMMUNICATION',
        event_name: 'Custom Email Communication',
        module: 'Communications',
        category: 'Communication',
        priority: 'LOW',
        description: 'Manually composed client/employee custom emails'
      });
    } else if (eventExists.module !== 'Communications') {
      await db('notification_events')
        .where({ event_code: 'CUSTOM_COMMUNICATION' })
        .update({ module: 'Communications' });
    }

    // 3. Insert custom email record into notification_queue
    const [queuedItem] = await db('notification_queue')
      .insert({
        company_id: companyId,
        user_id: employee.user_id || userId,
        event_code: 'CUSTOM_COMMUNICATION',
        recipient_email: recipientEmail,
        subject: subject,
        body: body,
        status: 'PENDING',
        attempts: 0,
        max_attempts: 3
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Custom communication email queued successfully.',
      item: queuedItem
    });
  } catch (err) {
    console.error('Failed to compose custom email:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEmailQueueItem = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const deleted = await db('notification_queue')
      .where({ id, company_id: companyId })
      .del();
    
    if (!deleted) return res.status(404).json({ error: 'Email queue item not found.' });
    res.json({ success: true, message: 'Email queue item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.purgeFailedEmailQueue = async (req, res) => {
  try {
    const { companyId } = req.params;
    const deleted = await db('notification_queue')
      .where({ company_id: companyId, status: 'FAILED' })
      .del();
    res.json({ success: true, message: `Successfully deleted ${deleted} failed email logs.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
