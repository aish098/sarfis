const db = require('../db/knex');

module.exports = (action, getTargetInfo = (req, resData) => ({})) => {
  return async (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const { targetType, targetId, payload } = getTargetInfo(req, data);
          const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'];

          db('audit_logs').insert({
            admin_id: req.admin ? req.admin.id : null,
            action,
            target_type: targetType || null,
            target_id: targetId ? String(targetId) : null,
            payload_json: JSON.stringify(payload || req.body || {}),
            ip_address: String(ipAddress || ''),
            user_agent: String(userAgent || ''),
            created_at: new Date()
          }).catch(err => console.error('Audit logging failed:', err));
        } catch (e) {
          console.error('Audit middleware error:', e);
        }
      }
      return originalJson.call(this, data);
    };

    next();
  };
};
