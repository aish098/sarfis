const db = require('../db/knex');

class AuditLogRepository {
  async findAll({ offset, limit, action, admin_id }) {
    let query = db('audit_logs as al')
      .leftJoin('admins as a', 'al.admin_id', 'a.id');

    if (action) {
      query = query.where('al.action', action);
    }

    if (admin_id) {
      query = query.where('al.admin_id', admin_id);
    }

    const totalResult = await query.clone().count('al.id as total').first();
    const totalItems = parseInt(totalResult.total || 0, 10);

    const auditLogs = await query
      .select(
        'al.id',
        'al.admin_id',
        'a.name as admin_name',
        'a.email as admin_email',
        'al.action',
        'al.target_type',
        'al.target_id',
        'al.payload_json',
        'al.ip_address',
        'al.user_agent',
        'al.created_at'
      )
      .orderBy('al.created_at', 'desc')
      .offset(offset)
      .limit(limit);

    return { auditLogs, totalItems };
  }
}

module.exports = new AuditLogRepository();
