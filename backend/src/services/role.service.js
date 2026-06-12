const db = require('../config/db');

class RoleService {
  /**
   * Fetches all permission codes a user has for a specific company
   */
  static async getUserPermissions(userId, companyId) {
    const rows = await db('user_roles')
      .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('user_roles.user_id', userId)
      .andWhere('user_roles.company_id', companyId)
      .select('permissions.code');

    return rows.map(r => r.code);
  }

  /**
   * Fetches all global permissions for a Super Admin (simulated or explicit)
   */
  static async getSuperAdminPermissions() {
    const rows = await db('permissions').select('code');
    return rows.map(r => r.code);
  }

  /**
   * Assigns a role to a user in a company
   */
  static async assignRole(userId, companyId, roleId) {
    await db('user_roles')
      .insert({ user_id: userId, company_id: companyId, role_id: roleId })
      .onConflict(['user_id', 'company_id', 'role_id'])
      .ignore();
  }
}

module.exports = RoleService;
