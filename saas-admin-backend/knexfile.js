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
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'saas_admin'
    }) : {
      filename: path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: !hasPgConfig,
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
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: false
    }) : {
      filename: path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: !hasPgConfig,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    }
  }
};
