const path = require('path');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;
const dbClient = process.env.DB_CLIENT || (isProduction ? 'pg' : 'sqlite3');
const isPg = dbClient === 'pg' || dbClient === 'postgres' || !!process.env.DATABASE_URL;

module.exports = {
  development: {
    client: isPg ? 'pg' : 'sqlite3',
    connection: isPg ? (process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: false
    } : {
      host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
      user: process.env.DB_USER || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
      database: process.env.DB_NAME || process.env.PGDATABASE || 'saas_admin'
    }) : {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: !isPg,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: !isPg ? {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    } : { min: 2, max: 10 }
  },
  production: {
    client: isPg ? 'pg' : 'sqlite3',
    connection: isPg ? {
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
      user: process.env.DB_USER || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
      database: process.env.DB_NAME || process.env.PGDATABASE || 'saas_admin',
      ssl: (process.env.DB_SSL === 'false' || process.env.PGSSLMODE === 'disable' || (
        process.env.DATABASE_URL && (
          process.env.DATABASE_URL.includes('railway.internal') ||
          process.env.DATABASE_URL.includes('127.0.0.1') ||
          process.env.DATABASE_URL.includes('localhost') ||
          process.env.DATABASE_URL.includes('sslmode=disable')
        )
      )) ? false : { rejectUnauthorized: false }
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
    pool: !isPg ? {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    } : { min: 0, max: 10 }
  }
};
