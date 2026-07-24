exports.up = function (knex) {
  return knex.schema
    // 1. Admin Roles & Permissions
    .createTable('admin_roles', table => {
      table.increments('id').primary();
      table.string('name').notNullable().unique(); // SUPER_ADMIN, ADMIN, SUPPORT, READ_ONLY
      table.string('description');
      table.timestamps(true, true);
    })
    .createTable('admin_permissions', table => {
      table.increments('id').primary();
      table.integer('role_id').unsigned().references('id').inTable('admin_roles').onDelete('CASCADE');
      table.string('permission').notNullable();
      table.timestamps(true, true);
      table.unique(['role_id', 'permission']);
    })
    .createTable('admins', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.integer('role_id').unsigned().references('id').inTable('admin_roles').onDelete('SET NULL');
      table.string('status').notNullable().defaultTo('ACTIVE'); // ACTIVE, SUSPENDED
      table.timestamp('last_login_at');
      table.timestamps(true, true);
    })
    .createTable('user_sessions', table => {
      table.string('id').primary();
      table.integer('admin_id').unsigned().references('id').inTable('admins').onDelete('CASCADE');
      table.string('token_hash').notNullable();
      table.string('ip_address');
      table.string('user_agent');
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // 2. Tenants (Companies) & SaaS Users
    .createTable('companies', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.string('status').notNullable().defaultTo('ACTIVE'); // ACTIVE, TRIAL, SUSPENDED
      table.string('owner_user_id');
      table.timestamps(true, true);
    })
    .createTable('users', table => {
      table.string('id').primary(); // UUID
      table.string('name').notNullable();
      table.string('email').notNullable().unique();
      table.string('status').notNullable().defaultTo('ACTIVE'); // ACTIVE, BLOCKED, PENDING, INVITED, SUSPENDED, DELETED
      table.string('role').notNullable().defaultTo('free_user'); // pro_user, free_user, enterprise_admin
      table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('SET NULL');
      table.integer('blocked_by_admin_id').unsigned().references('id').inTable('admins').onDelete('SET NULL');
      table.string('blocked_reason');
      table.timestamp('blocked_at');
      table.timestamp('last_login_at');
      table.integer('login_count').defaultTo(0);
      table.timestamps(true, true);
    })

    // 3. Plans & Subscriptions
    .createTable('plans', table => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('code').notNullable().unique(); // FREE, PRO_MONTHLY, ENTERPRISE_ANNUAL
      table.decimal('price', 10, 2).defaultTo(0);
      table.string('billing_cycle').defaultTo('monthly'); // monthly, annual
      table.text('features_json');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    .createTable('company_subscriptions', table => {
      table.increments('id').primary();
      table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('plan_id').unsigned().references('id').inTable('plans').onDelete('CASCADE');
      table.string('status').notNullable().defaultTo('ACTIVE'); // ACTIVE, PAST_DUE, CANCELED, EXPIRED
      table.timestamp('current_period_start');
      table.timestamp('current_period_end');
      table.boolean('cancel_at_period_end').defaultTo(false);
      table.timestamps(true, true);
    })

    // 4. Coupons & Redemptions
    .createTable('coupons', table => {
      table.string('id').primary(); // cop-XXXX-YYYY
      table.string('code').notNullable().unique();
      table.string('discount_type').notNullable(); // percentage, fixed, free_trial, upgrade_discount, lifetime, referral, partner, internal
      table.decimal('discount_value', 10, 2).notNullable();
      table.string('status').notNullable().defaultTo('active'); // active, disabled, expired
      table.timestamp('expiry_date').notNullable();
      table.integer('usage_limit').defaultTo(100);
      table.integer('used_count').defaultTo(0);
      table.integer('created_by_admin_id').unsigned().references('id').inTable('admins').onDelete('SET NULL');
      table.timestamps(true, true);
    })
    .createTable('coupon_redemptions', table => {
      table.increments('id').primary();
      table.string('coupon_id').references('id').inTable('coupons').onDelete('CASCADE');
      table.integer('company_id').unsigned().references('id').inTable('companies').onDelete('SET NULL');
      table.string('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.decimal('discount_applied', 10, 2).defaultTo(0);
      table.timestamp('redeemed_at').defaultTo(knex.fn.now());
    })

    // 5. Audit Logging Trail
    .createTable('audit_logs', table => {
      table.increments('id').primary();
      table.integer('admin_id').unsigned().references('id').inTable('admins').onDelete('SET NULL');
      table.string('action').notNullable(); // USER_BLOCKED, USER_UNBLOCKED, COUPON_CREATED, COUPON_DISABLED, PLAN_UPDATED
      table.string('target_type');
      table.string('target_id');
      table.text('payload_json');
      table.string('ip_address');
      table.string('user_agent');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('coupon_redemptions')
    .dropTableIfExists('coupons')
    .dropTableIfExists('company_subscriptions')
    .dropTableIfExists('plans')
    .dropTableIfExists('users')
    .dropTableIfExists('companies')
    .dropTableIfExists('user_sessions')
    .dropTableIfExists('admins')
    .dropTableIfExists('admin_permissions')
    .dropTableIfExists('admin_roles');
};
