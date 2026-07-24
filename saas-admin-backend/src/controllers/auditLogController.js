const auditLogService = require('../services/auditLogService');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogs(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
