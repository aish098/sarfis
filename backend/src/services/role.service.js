const db = require('../config/db');

class RoleService {
  /**
   * Fetches all permission codes a user has for a specific company
   */
  static async getUserPermissions(userId, companyId) {
    // 1. Super Admin inherits everything
    const user = await db('users').where({ id: userId }).first();
    if (user && user.role === 'Super Admin') {
      return this.getSuperAdminPermissions();
    }

    // 2. Fetch default role permissions
    const defaultRows = await db('user_roles')
      .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('user_roles.user_id', userId)
      .andWhere('user_roles.company_id', companyId)
      .select('permissions.code');

    const calculated = new Set();
    for (const row of defaultRows) {
      calculated.add(row.code);
    }

    // 3. Fetch overrides and apply active dates (excluding soft-deleted & pending 4-Eyes overrides)
    const now = new Date();
    const overrides = await db('user_permission_overrides')
      .join('permissions', 'user_permission_overrides.permission_id', 'permissions.id')
      .where({ 
        user_id: userId, 
        company_id: companyId,
        is_deleted: false,
        approval_status: 'APPROVED'
      })
      .select(
        'permissions.code',
        'user_permission_overrides.is_allowed',
        'user_permission_overrides.start_date',
        'user_permission_overrides.end_date'
      );

    for (const ovr of overrides) {
      let active = true;
      if (ovr.start_date) {
        const start = new Date(ovr.start_date);
        if (now < start) active = false;
      }
      if (ovr.end_date) {
        const end = new Date(ovr.end_date);
        end.setHours(23, 59, 59, 999); // inclusive of end date
        if (now > end) active = false;
      }

      if (active) {
        if (ovr.is_allowed) {
          calculated.add(ovr.code);
        } else {
          calculated.delete(ovr.code); // Force revoke
        }
      }
    }

    return Array.from(calculated);
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
