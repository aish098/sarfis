const db = require('../config/db');

class AuditModel {
  static async logAction({ companyId, userId, action, entityType, entityId, beforeState, afterState, ipAddress, userAgent }) {
    const [inserted] = await db('audit_logs')
      .insert({
        company_id: companyId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        before_state: beforeState ? JSON.stringify(beforeState) : null,
        after_state: afterState ? JSON.stringify(afterState) : null,
        ip_address: ipAddress,
        user_agent: userAgent
      })
      .returning('*');
    return inserted;
  }

  static async getLogs(companyId, limit = 100, offset = 0) {
    const logs = await db('audit_logs')
      .select('audit_logs.*', 'users.name as user_name', 'users.email as user_email')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .where('audit_logs.company_id', companyId)
      .orderBy('audit_logs.created_at', 'desc')
      .limit(limit)
      .offset(offset);
      
    return logs;
  }
}

module.exports = AuditModel;
