const path = require('path');
require('dotenv').config();

const dbClient = process.env.DB_CLIENT || 'sqlite3';

module.exports = {
  development: {
    client: dbClient,
    connection: dbClient === 'sqlite3' ? {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    } : {
      host: process.env.PG_HOST || '127.0.0.1',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      database: process.env.PG_DATABASE || 'saas_admin'
    },
    useNullAsDefault: dbClient === 'sqlite3',
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: dbClient === 'sqlite3' ? {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    } : { min: 2, max: 10 }
  },
  production: {
    client: dbClient,
    connection: dbClient === 'sqlite3' ? {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    } : {
      host: process.env.PG_HOST || '127.0.0.1',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      database: process.env.PG_DATABASE || 'saas_admin',
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    useNullAsDefault: dbClient === 'sqlite3',
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: dbClient === 'sqlite3' ? {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    } : { min: 2, max: 20 }
  }
};
