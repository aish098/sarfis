exports.up = async function(knex) {
  await knex.schema
    // 1. asset_transfer_requests
    .createTable('asset_transfer_requests', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.integer('from_location_id').nullable().references('id').inTable('warehouses').onDelete('SET NULL');
      table.integer('to_location_id').nullable().references('id').inTable('warehouses').onDelete('SET NULL');
      table.integer('from_custodian_employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL');
      table.integer('to_custodian_employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL');
      table.date('transfer_date').notNullable();
      table.text('notes').nullable();
      table.string('status', 30).notNullable().defaultTo('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED'
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    })

    // 2. asset_transfers (completed movement logs)
    .createTable('asset_transfers', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.integer('request_id').nullable().references('id').inTable('asset_transfer_requests').onDelete('SET NULL');
      table.integer('from_location_id').nullable().references('id').inTable('warehouses').onDelete('SET NULL');
      table.integer('to_location_id').nullable().references('id').inTable('warehouses').onDelete('SET NULL');
      table.integer('from_custodian_employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL');
      table.integer('to_custodian_employee_id').nullable().references('id').inTable('employees').onDelete('SET NULL');
      table.date('transfer_date').notNullable();
      table.text('notes').nullable();
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // 3. asset_work_orders (structured work orders)
    .createTable('asset_work_orders', table => {
      table.increments('id').primary();
      table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
      table.string('work_order_number', 100).notNullable();
      table.string('maintenance_type', 50).notNullable(); // 'PREVENTIVE' | 'CORRECTIVE' | 'CALIBRATION' | 'INSPECTION' | 'WARRANTY' | 'EMERGENCY'
      table.text('description').notNullable();
      table.string('technician_name', 150).nullable();
      table.text('parts_used').nullable();
      table.decimal('labor_cost', 15, 2).notNullable().defaultTo(0.00);
      table.decimal('maintenance_cost', 15, 2).notNullable().defaultTo(0.00);
      table.date('maintenance_date').notNullable();
      table.date('next_scheduled_date').nullable();
      table.string('status', 30).notNullable().defaultTo('OPEN'); // 'OPEN' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'CANCELLED'
      table.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.timestamps(true, true);
    });
};

exports.down = async function(knex) {
  await knex.schema
    .dropTableIfExists('asset_work_orders')
    .dropTableIfExists('asset_transfers')
    .dropTableIfExists('asset_transfer_requests');
};
