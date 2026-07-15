exports.up = async function(knex) {
  await knex.schema
    // 1. Core training resources page config
    .createTable('training_resources', table => {
      table.increments('id').primary();
      table.integer('company_id').nullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('page_title', 255).notNullable().defaultTo('Training & Tutorial Center');
      table.text('page_description').nullable();
      table.boolean('is_published').notNullable().defaultTo(false);
      table.integer('published_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('published_at').nullable();
      table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.integer('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    })

    // 2. Training Videos
    .createTable('training_videos', table => {
      table.increments('id').primary();
      table.integer('resource_id').notNullable().references('id').inTable('training_resources').onDelete('CASCADE');
      table.string('title', 255).notNullable();
      table.string('category', 100).notNullable().defaultTo('Getting Started');
      table.string('video_file', 255).notNullable();
      table.integer('duration_minutes').notNullable().defaultTo(0);
      table.integer('sequence_order').notNullable().defaultTo(0);
      table.integer('views').notNullable().defaultTo(0);
      table.integer('total_watch_seconds').notNullable().defaultTo(0);
      table.timestamps(true, true);
    })

    // 3. Training Manual Versions
    .createTable('training_manual_versions', table => {
      table.increments('id').primary();
      table.integer('resource_id').notNullable().references('id').inTable('training_resources').onDelete('CASCADE');
      table.string('version_number', 50).notNullable();
      table.string('file_path', 255).notNullable();
      table.string('description', 255).nullable();
      table.integer('downloads').notNullable().defaultTo(0);
      table.timestamps(true, true);
    });

  // Insert permissions
  const newPermissions = [
    { code: 'tutorial.view', module: 'admin', action: 'view', description: 'View public tutorial and manual' },
    { code: 'tutorial.manage', module: 'admin', action: 'manage', description: 'Manage tutorial and manual content' },
    { code: 'tutorial.publish', module: 'admin', action: 'publish', description: 'Publish tutorial and manual changes' }
  ];

  await knex('permissions').insert(newPermissions);

  // Map permissions to roles
  const roles = await knex('roles').select('*');
  const perms = await knex('permissions').select('*');

  const getPermId = (code) => perms.find(p => p.code === code)?.id;
  const getRoleId = (name) => roles.find(r => r.name === name)?.id;

  const roleMappings = [];

  // Admin gets all 3
  const adminId = getRoleId('Admin');
  if (adminId) {
    newPermissions.forEach(p => {
      const pid = getPermId(p.code);
      if (pid) roleMappings.push({ role_id: adminId, permission_id: pid });
    });
  }

  // Everyone else gets tutorial.view
  const otherRoles = ['Accountant', 'Inventory Manager', 'Sales Manager', 'Finance Manager', 'Viewer'];
  const viewPermId = getPermId('tutorial.view');
  if (viewPermId) {
    otherRoles.forEach(roleName => {
      const rid = getRoleId(roleName);
      if (rid) {
        roleMappings.push({ role_id: rid, permission_id: viewPermId });
      }
    });
  }

  if (roleMappings.length > 0) {
    await knex('role_permissions').insert(roleMappings);
  }
};

exports.down = async function(knex) {
  // Map permissions to delete
  const codes = ['tutorial.view', 'tutorial.manage', 'tutorial.publish'];
  const perms = await knex('permissions').whereIn('code', codes).select('id');
  const permIds = perms.map(p => p.id);

  if (permIds.length > 0) {
    await knex('role_permissions').whereIn('permission_id', permIds).del();
    await knex('permissions').whereIn('id', permIds).del();
  }

  await knex.schema
    .dropTableIfExists('training_manual_versions')
    .dropTableIfExists('training_videos')
    .dropTableIfExists('training_resources');
};
