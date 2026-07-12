/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('communications', table => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE');
    table.integer('sender_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('sender_type', 30).notNullable(); // 'ADMIN' | 'EMPLOYEE'
    table.string('subject', 255).notNullable();
    table.text('body').notNullable();
    table.string('status', 30).defaultTo('QUEUED').notNullable(); // 'QUEUED' | 'SENT' | 'READ'
    table.integer('parent_id').nullable().references('id').inTable('communications').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('read_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('communications');
};
