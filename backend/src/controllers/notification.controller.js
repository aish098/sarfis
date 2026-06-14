const db = require('../config/db');
const NotificationService = require('../services/notification.service');

exports.getNotifications = async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: 'Company context required.' });

  try {
    const notifications = await db('notifications')
      .where({ 
        company_id: companyId, 
        user_id: req.user.id,
        is_archived: false 
      })
      .orderBy('created_at', 'desc')
      .limit(100);

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
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish stream immediately

  // Register client connection
  NotificationService.addConnection(userId, res);

  // Send initial ping to verify channel
  res.write("event: ping\ndata: {}\n\n");

  // Keep-alive heartbeat every 30 seconds to prevent Railway/proxy drops
  const pingInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(pingInterval);
      return;
    }
    res.write("event: ping\ndata: {}\n\n");
  }, 30000);

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
