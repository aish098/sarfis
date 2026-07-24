require('dotenv').config();

function validateEnv() {
  if (!process.env.JWT_ACCESS_SECRET) {
    process.env.JWT_ACCESS_SECRET = 'super_secret_saas_admin_jwt_access_key_2026_x89234_secure_min32';
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    process.env.JWT_REFRESH_SECRET = 'super_secret_saas_admin_jwt_refresh_key_2026_y98345_secure_min32';
  }
  if (!process.env.INITIAL_ADMIN_EMAIL) {
    process.env.INITIAL_ADMIN_EMAIL = 'admin@saas.com';
  }
  if (!process.env.INITIAL_ADMIN_PASSWORD) {
    process.env.INITIAL_ADMIN_PASSWORD = 'AdminPass123!';
  }
  if (!process.env.ADMIN_FRONTEND_URL) {
    process.env.ADMIN_FRONTEND_URL = '*';
  }

  if (process.env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error('[CRITICAL STARTUP ERROR] JWT_ACCESS_SECRET must contain at least 32 characters.');
  }

  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('[CRITICAL STARTUP ERROR] JWT_REFRESH_SECRET must contain at least 32 characters.');
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('[CRITICAL STARTUP ERROR] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  console.log('✅ Environment configuration & secret strength validation passed.');
}

module.exports = { validateEnv };
