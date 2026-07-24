/**
 * Knex Migration: Enterprise Auth, Identity, Session, Subscription & Entitlements Schema
 */
exports.up = async function(knex) {
  // 1. Pure Global User Identity Table
  const hasUserAuthIdentities = await knex.schema.hasTable('user_auth_identities');
  if (!hasUserAuthIdentities) {
    await knex.schema.createTable('user_auth_identities', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('provider', 30).notNullable().defaultTo('GOOGLE');
      table.string('provider_subject', 255).notNullable();
      table.string('provider_email', 255).nullable();
      table.boolean('provider_email_verified').notNullable().defaultTo(false);
      table.text('provider_picture_url').nullable();
      table.bigInteger('linked_by_user_id').unsigned().nullable();
      table.timestamp('disabled_at').nullable();
      table.bigInteger('disabled_by_user_id').unsigned().nullable();
      table.bigInteger('last_used_company_id').unsigned().nullable();
      table.timestamp('linked_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('last_login_at').nullable();
      table.timestamps(true, true);

      table.unique(['provider', 'provider_subject']);
      table.unique(['user_id', 'provider']);
      table.index(['provider', 'provider_email'], 'idx_auth_identity_email');
    });
  }

  // 2. Trusted User Sessions Table (Device Tracking & Remote Revocation)
  const hasUserSessions = await knex.schema.hasTable('user_sessions');
  if (!hasUserSessions) {
    await knex.schema.createTable('user_sessions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.bigInteger('company_id').unsigned().nullable()
        .references('id').inTable('companies').onDelete('SET NULL');
      table.string('refresh_token_hash', 255).nullable();
      table.string('authentication_method', 30).notNullable().defaultTo('GOOGLE');
      table.string('device_name', 100).nullable();
      table.string('browser', 50).nullable();
      table.string('os', 50).nullable();
      table.string('ip_address', 64).nullable();
      table.string('country', 50).nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('last_activity').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at').nullable();
      table.timestamp('revoked_at').nullable();

      table.index(['user_id', 'is_active'], 'idx_sessions_user_active');
    });
  } else {
    await knex.schema.alterTable('user_sessions', (table) => {
      table.string('refresh_token_hash', 255).nullable();
      table.string('authentication_method', 30).notNullable().defaultTo('PASSWORD');
      table.string('device_name', 100).nullable();
      table.string('browser', 50).nullable();
      table.string('os', 50).nullable();
      table.string('country', 50).nullable();
      table.timestamp('expires_at').nullable();
      table.timestamp('revoked_at').nullable();
    });
  }

  // 3. User Access Invitations Table
  const hasUserInvitations = await knex.schema.hasTable('user_access_invitations');
  if (!hasUserInvitations) {
    await knex.schema.createTable('user_access_invitations', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable()
        .references('id').inTable('companies').onDelete('CASCADE');
      table.string('email', 255).notNullable();
      table.string('invitation_status', 30).notNullable().defaultTo('PENDING');
      table.string('role_name', 50).notNullable().defaultTo('Accountant');
      table.timestamp('expires_at').nullable();
      table.bigInteger('invited_by').unsigned().notNullable();
      table.bigInteger('accepted_by_user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('accepted_at').nullable();
      table.timestamps(true, true);

      table.unique(['company_id', 'email']);
    });
  }

  // 4. Company Subscriptions Table with License Limits
  const hasCompanySubscriptions = await knex.schema.hasTable('company_subscriptions');
  if (!hasCompanySubscriptions) {
    await knex.schema.createTable('company_subscriptions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable()
        .references('id').inTable('companies').onDelete('CASCADE');
      table.string('provider', 30).notNullable().defaultTo('STRIPE');
      table.string('external_customer_id', 255).nullable();
      table.string('external_subscription_id', 255).nullable();
      table.string('plan_code', 100).notNullable().defaultTo('ENTERPRISE');
      table.string('status', 30).notNullable().defaultTo('ACTIVE');
      table.integer('max_user_licenses').notNullable().defaultTo(50);
      table.timestamp('current_period_end').nullable();
      table.timestamps(true, true);

      table.unique('company_id');
    });
  }

  // 5. Company Module Entitlements Table
  const hasCompanyModuleEntitlements = await knex.schema.hasTable('company_module_entitlements');
  if (!hasCompanyModuleEntitlements) {
    await knex.schema.createTable('company_module_entitlements', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable()
        .references('id').inTable('companies').onDelete('CASCADE');
      table.string('module_code', 100).notNullable();
      table.boolean('enabled').notNullable().defaultTo(true);
      table.timestamp('starts_at').nullable();
      table.timestamp('expires_at').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      table.unique(['company_id', 'module_code']);
    });
  }

  // 6. Company Authentication Policy Settings
  const hasCompanyAuthSettings = await knex.schema.hasTable('company_auth_settings');
  if (!hasCompanyAuthSettings) {
    await knex.schema.createTable('company_auth_settings', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().notNullable()
        .references('id').inTable('companies').onDelete('CASCADE');
      table.boolean('google_login_enabled').notNullable().defaultTo(false);
      table.boolean('allow_google_account_linking').notNullable().defaultTo(false);
      table.boolean('allow_google_auto_provisioning').notNullable().defaultTo(false);
      table.boolean('requires_admin_approval').notNullable().defaultTo(false);
      table.json('allowed_google_domains').nullable();
      table.timestamps(true, true);

      table.unique('company_id');
    });
  }

  // 7. Authentication Audit Logs
  const hasAuthAuditLogs = await knex.schema.hasTable('authentication_audit_logs');
  if (!hasAuthAuditLogs) {
    await knex.schema.createTable('authentication_audit_logs', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('company_id').unsigned().nullable()
        .references('id').inTable('companies').onDelete('SET NULL');
      table.bigInteger('user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.string('provider', 30).notNullable().defaultTo('GOOGLE');
      table.string('event_type', 50).notNullable();
      table.boolean('success').notNullable();
      table.string('failure_code', 100).nullable();
      table.string('email', 255).nullable();
      table.string('ip_address', 64).nullable();
      table.text('user_agent').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      table.index(['company_id', 'created_at'], 'idx_auth_audit_company_created');
      table.index(['user_id', 'created_at'], 'idx_auth_audit_user_created');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('authentication_audit_logs');
  await knex.schema.dropTableIfExists('company_auth_settings');
  await knex.schema.dropTableIfExists('company_module_entitlements');
  await knex.schema.dropTableIfExists('company_subscriptions');
  await knex.schema.dropTableIfExists('user_access_invitations');
  await knex.schema.dropTableIfExists('user_auth_identities');
};
