const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Clear existing records
  await knex('coupon_redemptions').del();
  await knex('coupons').del();
  await knex('company_subscriptions').del();
  await knex('plans').del();
  await knex('users').del();
  await knex('companies').del();
  await knex('user_sessions').del();
  await knex('admins').del();
  await knex('admin_permissions').del();
  await knex('admin_roles').del();

  // 1. Insert Admin Roles
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

  // 3. Insert Default Super Admin (`admin@saas.com` / `AdminPass123!`)
  const passwordHash = await bcrypt.hash('AdminPass123!', 10);
  const [adminId] = await knex('admins').insert({
    name: 'Master Admin',
    email: 'admin@saas.com',
    password_hash: passwordHash,
    role_id: superAdminRoleId,
    status: 'ACTIVE'
  });

  // 4. Sample Companies
  const [c1] = await knex('companies').insert({
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'ACTIVE'
  });

  const [c2] = await knex('companies').insert({
    name: 'Global Tech Ltd',
    slug: 'global-tech',
    status: 'TRIAL'
  });

  // 5. Sample Users
  await knex('users').insert([
    {
      id: 'd3b07384-d113-4ec6-a558-71ebb398d8b2',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      status: 'ACTIVE',
      role: 'pro_user',
      company_id: c1,
      login_count: 14
    },
    {
      id: 'a98dfb84-1234-4567-b558-71ebb398fa21',
      name: 'Bob Smith',
      email: 'bob@example.com',
      status: 'BLOCKED',
      role: 'free_user',
      company_id: c2,
      blocked_by_admin_id: adminId,
      blocked_reason: 'Violation of terms of service',
      blocked_at: new Date()
    },
    {
      id: 'c89ef123-9876-5432-1234-71ebb398ff99',
      name: 'Charlie Davis',
      email: 'charlie@dev.com',
      status: 'ACTIVE',
      role: 'enterprise_admin',
      company_id: c1,
      login_count: 42
    }
  ]);

  // 6. Sample Plans
  const [freePlanId] = await knex('plans').insert({
    name: 'Free Starter',
    code: 'FREE',
    price: 0.00,
    billing_cycle: 'monthly',
    features_json: JSON.stringify(['Up to 5 Users', 'Basic Reports'])
  });

  const [proPlanId] = await knex('plans').insert({
    name: 'Pro Business',
    code: 'PRO_MONTHLY',
    price: 49.00,
    billing_cycle: 'monthly',
    features_json: JSON.stringify(['Unlimited Users', 'Advanced Analytics', 'Priority Support'])
  });

  // 7. Sample Subscriptions
  await knex('company_subscriptions').insert([
    {
      company_id: c1,
      plan_id: proPlanId,
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    {
      company_id: c2,
      plan_id: freePlanId,
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    }
  ]);

  // 8. Sample Coupons
  await knex('coupons').insert([
    {
      id: 'cop-9012-3211',
      code: 'WELCOME10',
      discount_type: 'percentage',
      discount_value: 10.00,
      status: 'active',
      expiry_date: new Date('2026-12-31T23:59:59Z'),
      usage_limit: 500,
      used_count: 42,
      created_by_admin_id: adminId
    },
    {
      id: 'cop-5432-8890',
      code: 'BLACKFRIDAY',
      discount_type: 'fixed',
      discount_value: 50.00,
      status: 'expired',
      expiry_date: new Date('2025-11-30T23:59:59Z'),
      usage_limit: 100,
      used_count: 100,
      created_by_admin_id: adminId
    }
  ]);

  console.log('✅ Seed completed: Super Admin (admin@saas.com / AdminPass123!) created with sample users, plans, and coupons.');
};
