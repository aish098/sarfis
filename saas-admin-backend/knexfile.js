const path = require('path');
require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    }
  },
  production: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'src/db/saas_admin.sqlite3')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src/db/seeds')
    },
    pool: {
      afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
    }
  }
};
