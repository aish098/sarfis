const AuditModel = require('../models/audit.model');

exports.getLogs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    const logs = await AuditModel.getLogs(companyId, limit, offset);
    res.json({ logs });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
};

exports.logAction = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { action, entityType, entityId, beforeState, afterState } = req.body;
    
    // User is extracted from auth middleware
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const log = await AuditModel.logAction({
      companyId,
      userId,
      action,
      entityType,
      entityId,
      beforeState,
      afterState,
      ipAddress,
      userAgent
    });

    res.status(201).json(log);
  } catch (error) {
    console.error('Failed to save audit log:', error);
    res.status(500).json({ error: 'Failed to save audit log' });
  }
};
