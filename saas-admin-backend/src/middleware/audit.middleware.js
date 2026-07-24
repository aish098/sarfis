const crypto = require('crypto');
const db = require('../db/knex');

module.exports = (action, getTargetInfo = (req, resData) => ({})) => {
  return async (req, res, next) => {
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    const originalJson = res.json;

    res.json = function (data) {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      
      db.transaction(async (trx) => {
        try {
          const { targetType, targetId, beforeJson, afterJson } = getTargetInfo(req, data);
          const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'];
          const adminId = req.admin ? req.admin.id : null;
          const createdAt = new Date();

          // 1. Fetch last record hash for SHA-256 Tamper-Evident Chain
          const lastLog = await trx('audit_logs')
            .orderBy('id', 'desc')
            .select('record_hash')
            .first();

          const previousHash = lastLog?.record_hash || '0000000000000000000000000000000000000000000000000000000000000000';

          const beforeStr = beforeJson ? JSON.stringify(beforeJson) : '';
          const afterStr = afterJson ? JSON.stringify(afterJson) : JSON.stringify(data || {});

          // 2. Compute Immutable Record Hash
          const hashDataStr = `${previousHash}|${requestId}|${adminId || ''}|${action}|${targetType || ''}|${targetId || ''}|${beforeStr}|${afterStr}|${createdAt.toISOString()}`;
          const recordHash = crypto.createHash('sha256').update(hashDataStr).digest('hex');

          await trx('audit_logs').insert({
            request_id: requestId,
            admin_id: adminId,
            action,
            target_type: targetType || null,
            target_id: targetId ? String(targetId) : null,
            before_json: beforeStr || null,
            after_json: afterStr || null,
            success: isSuccess,
            failure_code: !isSuccess ? (data?.error || `HTTP_${res.statusCode}`) : null,
            ip_address: String(ipAddress || ''),
            user_agent: String(userAgent || ''),
            previous_hash: previousHash,
            record_hash: recordHash,
            created_at: createdAt
          });
        } catch (e) {
          console.error('Audit middleware error:', e);
        }
      }).catch(err => console.error('Audit transaction failed:', err));

      return originalJson.call(this, data);
    };

    next();
  };
};
