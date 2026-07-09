exports.up = async function(knex) {
  // 1. Drop existing tables to avoid conflict
  await knex.schema.dropTableIfExists('user_notification_preferences');
  await knex.schema.dropTableIfExists('notifications');

  // 2. Create notification_events table
  await knex.schema.createTable('notification_events', table => {
    table.increments('id').primary();
    table.string('event_code', 100).unique().notNullable();
    table.string('event_name', 150).notNullable();
    table.string('module', 50).notNullable();
    table.string('category', 50).notNullable(); // 'Alerts' | 'Operations' | 'Accounting' | 'Finance'
    table.string('priority', 20).defaultTo('MEDIUM').notNullable(); // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 3. Create notification_templates table
  await knex.schema.createTable('notification_templates', table => {
    table.increments('id').primary();
    table.string('event_code', 100).notNullable().references('event_code').inTable('notification_events').onDelete('CASCADE');
    table.string('subject', 200).notNullable();
    table.text('html_body').notNullable();
    table.text('plain_body').notNullable();
    table.jsonb('variables').nullable(); // e.g. ["product", "warehouse", "qty"]
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 4. Create overhauled user_notification_preferences table
  await knex.schema.createTable('user_notification_preferences', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('event_id').notNullable().references('id').inTable('notification_events').onDelete('CASCADE');
    table.boolean('email').defaultTo(true).notNullable();
    table.boolean('app').defaultTo(true).notNullable();
    table.boolean('sms').defaultTo(false).notNullable();
    table.boolean('push').defaultTo(false).notNullable();
    table.boolean('whatsapp').defaultTo(false).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['company_id', 'user_id', 'event_id']);
  });

  // 5. Create company_notification_policies table
  await knex.schema.createTable('company_notification_policies', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('event_id').notNullable().references('id').inTable('notification_events').onDelete('CASCADE');
    table.string('recipient_type', 50).notNullable(); // 'ROLE' | 'USER' | 'PERMISSION' | 'DEPARTMENT'
    table.string('recipient_value', 150).notNullable(); // e.g. 'Inventory Manager'
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 6. Create overhauled notifications table
  await knex.schema.createTable('notifications', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('event_code', 100).notNullable().references('event_code').inTable('notification_events').onDelete('CASCADE');
    table.string('title', 200).notNullable();
    table.text('message').notNullable();
    table.string('priority', 20).defaultTo('MEDIUM').notNullable();
    table.boolean('is_read').defaultTo(false).notNullable();
    table.timestamp('read_at').nullable();
    table.string('entity_type', 50).nullable(); // e.g. 'asset' | 'voucher'
    table.integer('entity_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 7. Create notification_queue table
  await knex.schema.createTable('notification_queue', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('event_code', 100).notNullable().references('event_code').inTable('notification_events').onDelete('CASCADE');
    table.string('recipient_email', 150).notNullable();
    table.string('subject', 200).notNullable();
    table.text('body').notNullable();
    table.string('status', 30).defaultTo('PENDING').notNullable(); // 'PENDING' | 'SENT' | 'FAILED' | 'RETRY'
    table.integer('attempts').defaultTo(0).notNullable();
    table.integer('max_attempts').defaultTo(3).notNullable();
    table.timestamp('last_attempt_at').nullable();
    table.text('error_log').nullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 8. Seed default events
  const defaultEvents = [
    { event_code: 'LOW_STOCK_ALERT', event_name: 'Low Stock Alert', module: 'Inventory', category: 'Alerts', priority: 'MEDIUM', description: 'Triggered when product inventory falls below reorder level' },
    { event_code: 'STOCK_REORDER_ALERT', event_name: 'Stock Reorder Recommendation', module: 'Inventory', category: 'Alerts', priority: 'MEDIUM', description: 'Triggered when products are suggested for restock' },
    { event_code: 'RISK_OVERRIDE_REQUESTED', event_name: 'Credit Risk Override Requested', module: 'Risk', category: 'Operations', priority: 'HIGH', description: 'Triggered when an order requires manual risk limit override approval' },
    { event_code: 'RISK_OVERRIDE_APPROVED', event_name: 'Credit Risk Override Approved', module: 'Risk', category: 'Operations', priority: 'MEDIUM', description: 'Triggered when a credit limit override request is approved' },
    { event_code: 'RISK_OVERRIDE_REJECTED', event_name: 'Credit Risk Override Rejected', module: 'Risk', category: 'Operations', priority: 'MEDIUM', description: 'Triggered when a credit limit override request is rejected' },
    { event_code: 'ASSET_TRANSFER_PENDING', event_name: 'Asset Location Transfer Pending', module: 'Assets', category: 'Operations', priority: 'MEDIUM', description: 'Triggered when fixed assets require location transfer authorization' },
    { event_code: 'DEPRECIATION_RUN_COMPLETE', event_name: 'Depreciation Wizard Session Completed', module: 'Assets', category: 'Accounting', priority: 'LOW', description: 'Triggered when depreciation calculations are posted' },
    { event_code: 'JOURNAL_POSTED', event_name: 'Manual Journal Entry Posted', module: 'Finance', category: 'Finance', priority: 'LOW', description: 'Triggered when manual journal vouchers are authorized and posted' }
  ];

  await knex('notification_events').insert(defaultEvents);

  // 9. Seed default templates
  const defaultTemplates = [
    {
      event_code: 'LOW_STOCK_ALERT',
      subject: 'Low Stock Warning: {{product}}',
      html_body: '<p>Warning: Product <strong>{{product}}</strong> in warehouse <strong>{{warehouse}}</strong> has fallen to <strong>{{qty}}</strong> units. Minimum threshold level is <strong>{{min}}</strong>.</p>',
      plain_body: 'Warning: Product {{product}} in warehouse {{warehouse}} has fallen to {{qty}} units. Minimum threshold level is {{min}}.',
      variables: JSON.stringify(['product', 'warehouse', 'qty', 'min'])
    },
    {
      event_code: 'RISK_OVERRIDE_REQUESTED',
      subject: 'Manual Credit Override Approval Required: {{customer}}',
      html_body: '<p>Customer <strong>{{customer}}</strong> has exceeded their credit limits. An override approval request for <strong>PKR {{amount}}</strong> has been submitted. Override Code: <strong>{{code}}</strong>.</p>',
      plain_body: 'Customer {{customer}} has exceeded their credit limits. An override approval request for PKR {{amount}} has been submitted. Override Code: {{code}}.',
      variables: JSON.stringify(['customer', 'amount', 'code'])
    },
    {
      event_code: 'RISK_OVERRIDE_APPROVED',
      subject: 'Credit Override APPROVED: {{code}}',
      html_body: '<p>Override request <strong>{{code}}</strong> for customer <strong>{{customer}}</strong> has been APPROVED by admin user.</p>',
      plain_body: 'Override request {{code}} for customer {{customer}} has been APPROVED by admin user.',
      variables: JSON.stringify(['code', 'customer'])
    },
    {
      event_code: 'ASSET_TRANSFER_PENDING',
      subject: 'Fixed Asset Transfer Approval Requested: {{assetTag}}',
      html_body: '<p>Asset <strong>{{assetName}} ({{assetTag}})</strong> is requested for location transfer from <strong>{{fromLoc}}</strong> to <strong>{{toLoc}}</strong>. Target Date: {{date}}.</p>',
      plain_body: 'Asset {{assetName}} ({{assetTag}}) is requested for location transfer from {{fromLoc}} to {{toLoc}}. Target Date: {{date}}.',
      variables: JSON.stringify(['assetName', 'assetTag', 'fromLoc', 'toLoc', 'date'])
    }
  ];

  await knex('notification_templates').insert(defaultTemplates);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('notification_queue');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('company_notification_policies');
  await knex.schema.dropTableIfExists('user_notification_preferences');
  await knex.schema.dropTableIfExists('notification_templates');
  await knex.schema.dropTableIfExists('notification_events');
};
