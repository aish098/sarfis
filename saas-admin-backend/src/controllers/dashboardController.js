const db = require('../db/knex');

exports.getStats = async (req, res, next) => {
  try {
    const [totalUsersRes] = await db('users').count('id as total');
    const [activeUsersRes] = await db('users').where({ status: 'ACTIVE' }).count('id as total');
    const [blockedUsersRes] = await db('users').where({ status: 'BLOCKED' }).count('id as total');

    const [totalCompaniesRes] = await db('companies').count('id as total');
    const [activeCouponsRes] = await db('coupons').where({ status: 'active' }).count('id as total');
    const [totalAuditLogsRes] = await db('audit_logs').count('id as total');

    const recentAuditLogs = await db('audit_logs as al')
      .leftJoin('admins as a', 'al.admin_id', 'a.id')
      .select('al.id', 'al.action', 'al.target_type', 'al.target_id', 'a.name as admin_name', 'al.created_at')
      .orderBy('al.created_at', 'desc')
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: parseInt(totalUsersRes.total || 0, 10),
          active: parseInt(activeUsersRes.total || 0, 10),
          blocked: parseInt(blockedUsersRes.total || 0, 10)
        },
        companies: {
          total: parseInt(totalCompaniesRes.total || 0, 10)
        },
        coupons: {
          active: parseInt(activeCouponsRes.total || 0, 10)
        },
        auditLogs: {
          total: parseInt(totalAuditLogsRes.total || 0, 10)
        },
        recentActivity: recentAuditLogs
      }
    });
  } catch (err) {
    next(err);
  }
};
