exports.up = async function(knex) {
  const exists = await knex('notification_events').where({ event_code: 'CUSTOM_COMMUNICATION' }).first();
  if (!exists) {
    await knex('notification_events').insert({
      event_code: 'CUSTOM_COMMUNICATION',
      event_name: 'Custom Email Communication',
      module: 'Communications',
      category: 'General',
      priority: 'MEDIUM',
      description: 'Manually composed client/employee custom emails and internal chat notifications'
    });
  }
};

exports.down = async function(knex) {
  // Do not drop to prevent foreign key errors
};
