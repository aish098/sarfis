const path = require('path');
require('dotenv').config();

const dbClient = process.env.DB_CLIENT || 'sqlite3';
const isPg = dbClient === 'pg' || dbClient === 'postgres';

module.exports = {
  development: {
    client: isPg ? 'pg' : 'sqlite3',
    connection: isPg ? {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'saas_admin',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    } : {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: !isPg,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: isPg ? { min: 2, max: 10 } : {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    }
  },
  production: {
    client: isPg ? 'pg' : 'sqlite3',
    connection: isPg ? {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'saas_admin',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    } : {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: !isPg,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: isPg ? { min: 2, max: 20 } : {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    }
  }
};
