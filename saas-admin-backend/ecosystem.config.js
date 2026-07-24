module.exports = {
  apps: [
    {
      name: 'saas-admin-backend',
      script: 'src/server.js',
      instances: 1, // Single instance required for SQLite to prevent database file locking
      exec_mode: 'fork', // Fork mode for SQLite persistence
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
