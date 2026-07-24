require('dotenv').config();

function validateEnv() {
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'INITIAL_ADMIN_EMAIL',
    'INITIAL_ADMIN_PASSWORD',
    'ADMIN_FRONTEND_URL'
  ];

  const missing = [];
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`[CRITICAL STARTUP ERROR] Missing required environment variables: ${missing.join(', ')}`);
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
