const auditLogRepository = require('../repositories/auditLogRepository');
const { getPagination, formatPaginatedResponse } = require('../utils/pagination');

class AuditLogService {
  async getAuditLogs(query) {
    const { page, limit, offset } = getPagination(query);
    const { action, admin_id } = query;

    const { auditLogs, totalItems } = await auditLogRepository.findAll({
      offset,
      limit,
      action,
      admin_id
    });

    return formatPaginatedResponse({ data: auditLogs, totalItems, page, limit });
  }
}

module.exports = new AuditLogService();
