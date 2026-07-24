const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Clear existing records
  await knex('audit_logs').del();
  await knex('coupon_redemptions').del();
  await knex('coupons').del();
  await knex('company_subscriptions').del();
  await knex('plans').del();
  await knex('users').del();
  await knex('companies').del();
  await knex('refresh_tokens').del();
  await knex('admins').del();
  await knex('admin_permissions').del();
  await knex('admin_roles').del();

  // 1. Insert Master Admin Roles
  const [superAdminRoleId] = await knex('admin_roles').insert({
    name: 'SUPER_ADMIN',
    description: 'Full unconstrained system administration access'
  });

  const [adminRoleId] = await knex('admin_roles').insert({
    name: 'ADMIN',
    description: 'Standard admin access with user and coupon management'
  });

  const [supportRoleId] = await knex('admin_roles').insert({
    name: 'SUPPORT',
    description: 'Support staff access with read-only & block permissions'
  });

  // 2. Insert Permissions
  const permissions = [
    'users.view', 'users.block', 'users.unblock', 'users.delete',
    'coupons.view', 'coupons.create', 'coupons.update', 'coupons.delete',
    'subscriptions.view', 'subscriptions.manage',
    'audit.view'
  ];

  for (const perm of permissions) {
    await knex('admin_permissions').insert({ role_id: superAdminRoleId, permission: perm });
    if (!perm.includes('delete')) {
      await knex('admin_permissions').insert({ role_id: adminRoleId, permission: perm });
    }
    if (perm.includes('view') || perm.includes('block')) {
      await knex('admin_permissions').insert({ role_id: supportRoleId, permission: perm });
    }
  }

  // 3. Strict Check: Read Master Administrator Credentials from Environment
  const initialEmail = process.env.INITIAL_ADMIN_EMAIL;
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!initialEmail || !initialPassword) {
    throw new Error('[CRITICAL SEED ERROR] INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD environment variables are required.');
  }

  const passwordHash = await bcrypt.hash(initialPassword, 10);
  await knex('admins').insert({
    name: 'Master Admin',
    email: initialEmail,
    password_hash: passwordHash,
    role_id: superAdminRoleId,
    status: 'ACTIVE',
    must_change_password: true // Require initial password rotation upon first login
  });

  // 4. Master Subscription Plans Only (No dummy users, companies, or coupons)
  await knex('plans').insert([
    {
      name: 'Free Starter',
      code: 'FREE',
      price: 0.00,
      billing_cycle: 'monthly',
      features_json: JSON.stringify(['Up to 5 Users', 'Basic Reports'])
    },
    {
      name: 'Pro Business',
      code: 'PRO_MONTHLY',
      price: 49.00,
      billing_cycle: 'monthly',
      features_json: JSON.stringify(['Unlimited Users', 'Advanced Analytics', 'Priority Support'])
    },
    {
      name: 'Enterprise Annual',
      code: 'ENTERPRISE_ANNUAL',
      price: 499.00,
      billing_cycle: 'annual',
      features_json: JSON.stringify(['Dedicated Account Manager', 'Custom Workflows', 'SLA Guarantee'])
    }
  ]);

  console.log(`✅ Production Seed completed: Master Admin (${initialEmail}) initialized. All dummy sample data removed.`);
};
