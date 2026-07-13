require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'safrs',
    },
    migrations: {
      directory: require('path').join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: require('path').join(__dirname, 'src/db/seeds')
    }
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 0,
      max: 4,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      propagateCreateError: false
    },
    acquireConnectionTimeout: 30000,
    migrations: {
      directory: require('path').join(__dirname, 'src/db/migrations')
    },
    seeds: {
      directory: require('path').join(__dirname, 'src/db/seeds')
    }
  }
};
