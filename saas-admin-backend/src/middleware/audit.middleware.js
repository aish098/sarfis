const crypto = require('crypto');
const db = require('../db/knex');

module.exports = (action, getTargetInfo = (req, resData) => ({})) => {
  return async (req, res, next) => {
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    const originalJson = res.json;

    res.json = function (data) {
      try {
        const { targetType, targetId, beforeJson, afterJson } = getTargetInfo(req, data);
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

        db('audit_logs').insert({
          request_id: requestId,
          admin_id: req.admin ? req.admin.id : null,
          action,
          target_type: targetType || null,
          target_id: targetId ? String(targetId) : null,
          before_json: beforeJson ? JSON.stringify(beforeJson) : null,
          after_json: afterJson ? JSON.stringify(afterJson) : JSON.stringify(data || {}),
          success: isSuccess,
          failure_code: !isSuccess ? (data?.error || `HTTP_${res.statusCode}`) : null,
          ip_address: String(ipAddress || ''),
          user_agent: String(userAgent || ''),
          created_at: new Date()
        }).catch(err => console.error('Audit logging failed:', err));
      } catch (e) {
        console.error('Audit middleware error:', e);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};
