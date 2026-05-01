const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
console.log(`[DB] Initializing in ${environment} mode...`);
const db = knex(knexConfig[environment]);

db.raw('SELECT 1').then(() => {
  console.log(`[DB] Successfully connected to database.`);
}).catch(err => {
  console.error(`[DB] Connection FAILED:`, err.message);
});

module.exports = db;
