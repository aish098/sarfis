exports.up = async function(knex) {
  // 1. Insert new permissions
  const newPermissions = [
    { code: 'period.view', module: 'admin', action: 'view', description: 'View accounting periods' },
    { code: 'period.manage', module: 'admin', action: 'manage', description: 'Create and lock accounting periods' },
    { code: 'approval.view', module: 'admin', action: 'view', description: 'View pending transaction approvals' },
    { code: 'approval.manage', module: 'admin', action: 'manage', description: 'Approve and post pending transactions' },
    { code: 'audit.view', module: 'admin', action: 'view', description: 'View system logs and active sessions' },
    { code: 'audit.manage', module: 'admin', action: 'manage', description: 'Export backups and terminate sessions' },
  ];

  await knex('permissions').insert(newPermissions);

  // 2. Fetch roles and permissions
  const roles = await knex('roles').select('*');
  const perms = await knex('permissions').select('*');

  const getPermId = (code) => perms.find(p => p.code === code)?.id;
  const getRoleId = (name) => roles.find(r => r.name === name)?.id;

  const roleMappings = [];

  // Admin gets all 6
  const adminId = getRoleId('Admin');
  if (adminId) {
    newPermissions.forEach(p => {
      const pid = getPermId(p.code);
      if (pid) roleMappings.push({ role_id: adminId, permission_id: pid });
    });
  }

  // Accountant mappings
  const accountantId = getRoleId('Accountant');
  if (accountantId) {
    const codes = ['period.view', 'period.manage', 'approval.view', 'approval.manage', 'audit.view'];
    codes.forEach(c => {
      const pid = getPermId(c);
      if (pid) roleMappings.push({ role_id: accountantId, permission_id: pid });
    });
  }

  // Finance Manager mappings
  const financeManagerId = getRoleId('Finance Manager');
  if (financeManagerId) {
    const codes = ['period.view', 'approval.view', 'audit.view'];
    codes.forEach(c => {
      const pid = getPermId(c);
      if (pid) roleMappings.push({ role_id: financeManagerId, permission_id: pid });
    });
  }

  // Sales Manager mappings
  const salesManagerId = getRoleId('Sales Manager');
  if (salesManagerId) {
    const codes = ['approval.view'];
    codes.forEach(c => {
      const pid = getPermId(c);
      if (pid) roleMappings.push({ role_id: salesManagerId, permission_id: pid });
    });
  }

  // Viewer mappings
  const viewerId = getRoleId('Viewer');
  if (viewerId) {
    const codes = ['period.view', 'approval.view', 'audit.view'];
    codes.forEach(c => {
      const pid = getPermId(c);
      if (pid) roleMappings.push({ role_id: viewerId, permission_id: pid });
    });
  }

  if (roleMappings.length > 0) {
    await knex('role_permissions').insert(roleMappings);
  }
};

exports.down = async function(knex) {
  const codes = ['period.view', 'period.manage', 'approval.view', 'approval.manage', 'audit.view', 'audit.manage'];
  // Delete role mappings first
  const perms = await knex('permissions').whereIn('code', codes).select('id');
  const permIds = perms.map(p => p.id);
  
  if (permIds.length > 0) {
    await knex('role_permissions').whereIn('permission_id', permIds).delete();
    await knex('permissions').whereIn('id', permIds).delete();
  }
};
