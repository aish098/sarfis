const path = require('path');
require('dotenv').config();

const hasPgConfig = !!(process.env.DATABASE_URL || process.env.DB_HOST || process.env.PGHOST);

module.exports = {
  development: {
    client: hasPgConfig ? 'pg' : 'sqlite3',
    connection: hasPgConfig ? (process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: false
    } : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'safrs',
    }) : {
      filename: path.join(__dirname, 'src/db/dev.sqlite3')
    },
    useNullAsDefault: !hasPgConfig,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    }
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'src/db/test.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    }
  },
  production: {
    client: hasPgConfig ? 'pg' : 'sqlite3',
    connection: hasPgConfig ? (process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: (process.env.DB_SSL === 'false' || process.env.PGSSLMODE === 'disable' || (
        process.env.DATABASE_URL.includes('railway.internal') ||
        process.env.DATABASE_URL.includes('127.0.0.1') ||
        process.env.DATABASE_URL.includes('localhost') ||
        process.env.DATABASE_URL.includes('sslmode=disable')
      )) ? false : { rejectUnauthorized: false }
    } : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: false
    }) : {
      filename: path.join(__dirname, 'src/db/production.sqlite3')
    },
    useNullAsDefault: !hasPgConfig,
    pool: hasPgConfig ? {
      min: 0,
      max: 4,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      propagateCreateError: false
    } : { min: 1, max: 1 },
    acquireConnectionTimeout: 30000,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    }
  }
};
