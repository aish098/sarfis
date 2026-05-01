const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

if (environment === 'production' && config.connection && typeof config.connection.connectionString === 'string') {
  const masked = config.connection.connectionString.replace(/:([^:@]+)@/, ':***@');
  console.log(`[DB] Initializing in production mode... Target: ${masked}`);
} else {
  console.log(`[DB] Initializing in ${environment} mode...`);
}

const db = knex(config);

module.exports = db;
