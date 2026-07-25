exports.up = async function(knex) {
  // 1. Seed / ensure standard internal role codes in roles table
  const standardRoles = [
    { name: 'company_admin', description: 'Full Corporate Workspace Administrator' },
    { name: 'finance_director', description: 'Financial Statements, Approvals, & GL Postings' },
    { name: 'hr_manager', description: 'Employee Master, Payroll Calculation, & Attendance' },
    { name: 'accountant', description: 'Journal Entries, Vouchers, & Subledgers' },
    { name: 'viewer', description: 'Read-Only Workspace Inspector' }
  ];

  for (const r of standardRoles) {
    const existing = await knex('roles').where({ name: r.name }).first();
    if (!existing) {
      await knex('roles').insert(r);
    }
  }

  // Also support legacy 'Admin' role mapping for compatibility
  const adminRole = await knex('roles').where({ name: 'Admin' }).first();
  if (!adminRole) {
    await knex('roles').insert({ name: 'Admin', description: 'Legacy Admin Role' });
  }

  // 2. Fetch role lookup maps
  const rolesList = await knex('roles').select('*');
  const roleMap = {};
  rolesList.forEach(r => { roleMap[r.name] = r.id; });

  const companyAdminRoleId = roleMap['company_admin'] || roleMap['Admin'];
  const accountantRoleId = roleMap['accountant'] || roleMap['Accountant'] || roleMap['Admin'];
  const viewerRoleId = roleMap['viewer'] || roleMap['Viewer'];

  // 3. Normalize legacy role strings in company_users
  await knex('company_users')
    .whereIn('role', ['Admin', 'Owner', 'CEO', 'Super Admin'])
    .update({ role: 'company_admin' });

  // 4. Backfill user_roles for any company_users lacking user_roles records
  const companyUsers = await knex('company_users').select('*');
  for (const cu of companyUsers) {
    let targetRoleId = companyAdminRoleId;
    const lowerRole = String(cu.role || '').toLowerCase();
    
    if (lowerRole.includes('admin') || lowerRole.includes('owner') || lowerRole.includes('ceo')) {
      targetRoleId = companyAdminRoleId;
    } else if (lowerRole.includes('accountant') || lowerRole.includes('finance')) {
      targetRoleId = accountantRoleId;
    } else if (lowerRole.includes('viewer') || lowerRole.includes('read')) {
      targetRoleId = viewerRoleId;
    } else if (roleMap[cu.role]) {
      targetRoleId = roleMap[cu.role];
    }

    if (targetRoleId) {
      const existingUserRole = await knex('user_roles')
        .where({ user_id: cu.user_id, company_id: cu.company_id })
        .first();
      
      if (!existingUserRole) {
        await knex('user_roles').insert({
          user_id: cu.user_id,
          company_id: cu.company_id,
          role_id: targetRoleId
        }).catch(() => {});
      }
    }
  }

  // 5. Add unique constraint on (user_id, company_id, role_id) in user_roles if possible
  const hasTable = await knex.schema.hasTable('user_roles');
  if (hasTable) {
    try {
      await knex.schema.alterTable('user_roles', table => {
        table.unique(['user_id', 'company_id', 'role_id']);
      });
    } catch (e) {
      // Constraint may already exist
    }
  }
};

exports.down = async function(knex) {
  // Migration rollback logic
};
