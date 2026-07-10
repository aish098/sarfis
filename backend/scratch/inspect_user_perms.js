const db = require('../src/config/db');

async function inspectPerms() {
  const adminUser = await db('users')
    .join('user_roles', 'users.id', 'user_roles.user_id')
    .where('user_roles.company_id', 1)
    .select('users.id', 'users.email', 'user_roles.role_id')
    .first();

  console.log("Admin User:", adminUser);

  if (adminUser) {
    const role = await db('roles').where({ id: adminUser.role_id }).first();
    console.log("Role:", role);

    const permissions = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where({ role_id: adminUser.role_id })
      .select('permissions.code');
    console.log("Permissions:", permissions.map(p => p.code));
  }

  process.exit(0);
}

inspectPerms();
