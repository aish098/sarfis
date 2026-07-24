exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('contact_inquiries');
  if (!hasTable) {
    await knex.schema.createTable('contact_inquiries', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('email').notNullable();
      table.string('subject').nullable();
      table.text('message').notNullable();
      table.string('status').defaultTo('PENDING'); // PENDING, RESPONDED, ARCHIVED
      table.string('ip_address').nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('contact_inquiries');
};
