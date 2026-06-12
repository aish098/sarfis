exports.up = async function(knex) {
  // 1. Create permissions table
  await knex.schema.createTable('permissions', table => {
    table.increments('id').primary();
    table.string('code', 100).notNullable().unique(); // e.g. 'voucher.create'
    table.string('module', 50).notNullable(); // e.g. 'accounting'
    table.string('action', 50).notNullable(); // e.g. 'create'
    table.string('description').nullable();
    table.timestamps(true, true);
  });

  // 2. Create roles table
  await knex.schema.createTable('roles', table => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique(); // e.g. 'Accountant'
    table.string('description').nullable();
    table.boolean('is_system').defaultTo(true); // Built-in roles
    table.timestamps(true, true);
  });

  // 3. Create role_permissions pivot table
  await knex.schema.createTable('role_permissions', table => {
    table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('CASCADE');
    table.integer('permission_id').unsigned().references('id').inTable('permissions').onDelete('CASCADE');
    table.primary(['role_id', 'permission_id']);
  });

  // 4. Create user_roles table (Replaces company_users role string)
  await knex.schema.createTable('user_roles', table => {
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['user_id', 'company_id', 'role_id']);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ==========================================
  // SEED DATA
  // ==========================================

  const permissionsToInsert = [
    // Vouchers
    { code: 'voucher.view', module: 'voucher', action: 'view' },
    { code: 'voucher.create', module: 'voucher', action: 'create' },
    { code: 'voucher.edit', module: 'voucher', action: 'edit' },
    { code: 'voucher.delete', module: 'voucher', action: 'delete' },
    { code: 'voucher.post', module: 'voucher', action: 'post' },
    { code: 'voucher.approve', module: 'voucher', action: 'approve' },
    
    // Journals & Ledger
    { code: 'journal.view', module: 'accounting', action: 'view' },
    { code: 'journal.create', module: 'accounting', action: 'create' },
    { code: 'journal.post', module: 'accounting', action: 'post' },
    { code: 'ledger.view', module: 'accounting', action: 'view' },
    
    // Inventory
    { code: 'inventory.view', module: 'inventory', action: 'view' },
    { code: 'inventory.edit', module: 'inventory', action: 'edit' },
    { code: 'warehouse.manage', module: 'inventory', action: 'manage' },
    { code: 'product.manage', module: 'inventory', action: 'manage' },
    
    // Settings & Admin
    { code: 'settings.manage', module: 'admin', action: 'manage' },
    { code: 'user.manage', module: 'admin', action: 'manage' },
    
    // Analytics & Reports
    { code: 'report.view', module: 'analytics', action: 'view' },
    { code: 'analytics.view', module: 'analytics', action: 'view' },
    
    // CRM
    { code: 'client.manage', module: 'crm', action: 'manage' },
    { code: 'vendor.manage', module: 'crm', action: 'manage' }
  ];

  await knex('permissions').insert(permissionsToInsert);

  const rolesToInsert = [
    { name: 'Admin', description: 'Full company access' },
    { name: 'Accountant', description: 'Accounting and financial reporting' },
    { name: 'Inventory Manager', description: 'Warehouse and product management' },
    { name: 'Sales Manager', description: 'Clients and sales vouchers' },
    { name: 'Finance Manager', description: 'Analytics and financial monitoring' },
    { name: 'Viewer', description: 'Read-only access to all modules' }
  ];

  await knex('roles').insert(rolesToInsert);

  // Fetch inserted roles and permissions
  const roles = await knex('roles').select('*');
  const perms = await knex('permissions').select('*');

  const getPermIds = (codes) => codes.map(c => perms.find(p => p.code === c).id);

  const rolePerms = [];

  for (const role of roles) {
    let assignedCodes = [];
    
    switch (role.name) {
      case 'Admin':
        // Admin gets everything
        assignedCodes = perms.map(p => p.code);
        break;
      case 'Accountant':
        assignedCodes = [
          'voucher.view', 'voucher.create', 'voucher.edit', 'voucher.post',
          'journal.view', 'journal.create', 'journal.post', 'ledger.view',
          'report.view', 'client.manage', 'vendor.manage'
        ];
        break;
      case 'Inventory Manager':
        assignedCodes = [
          'inventory.view', 'inventory.edit', 'warehouse.manage', 'product.manage',
          'voucher.view' // to see item receipts/deliveries
        ];
        break;
      case 'Sales Manager':
        assignedCodes = [
          'client.manage', 'voucher.view', 'voucher.create', 'report.view', 'analytics.view'
        ];
        break;
      case 'Finance Manager':
        assignedCodes = [
          'report.view', 'analytics.view', 'ledger.view', 'voucher.view', 'journal.view'
        ];
        break;
      case 'Viewer':
        assignedCodes = [
          'voucher.view', 'journal.view', 'ledger.view', 'inventory.view', 'report.view', 'analytics.view'
        ];
        break;
    }

    const permIds = getPermIds(assignedCodes);
    permIds.forEach(pid => {
      rolePerms.push({ role_id: role.id, permission_id: pid });
    });
  }

  await knex('role_permissions').insert(rolePerms);

  // Migrate existing users from company_users to user_roles
  const existingCompanyUsers = await knex('company_users').select('*');
  
  const userRolesData = [];
  for (const cu of existingCompanyUsers) {
    // Attempt to map the old string role to the new role ID
    // E.g., 'Company Admin' -> 'Admin'
    let mappedRoleName = cu.role;
    if (cu.role === 'Company Admin') mappedRoleName = 'Admin';
    if (cu.role === 'Super Admin') mappedRoleName = 'Admin'; // Super Admin handles global separately, but give Admin here
    
    const matchedRole = roles.find(r => r.name === mappedRoleName);
    if (matchedRole) {
      userRolesData.push({
        user_id: cu.user_id,
        company_id: cu.company_id,
        role_id: matchedRole.id
      });
    } else {
      // Default fallback to Admin if unrecognized, to prevent lockout
      const adminRole = roles.find(r => r.name === 'Admin');
      userRolesData.push({
        user_id: cu.user_id,
        company_id: cu.company_id,
        role_id: adminRole.id
      });
    }
  }

  if (userRolesData.length > 0) {
    // Use ignore on conflict in case of duplicates
    await knex('user_roles').insert(userRolesData).onConflict(['user_id', 'company_id', 'role_id']).ignore();
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('permissions');
};
