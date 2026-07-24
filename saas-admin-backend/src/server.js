require('dotenv').config();
const { validateEnv } = require('./config/env');
const app = require('./app');
const db = require('./db/knex');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1. Enforce Environment & Secret Strength Validation at Startup
    validateEnv();

    // 2. Run automated Knex migrations on startup
    console.log('🔄 Checking & applying database migrations...');
    await db.migrate.latest();
    console.log('✅ Database migrations up to date.');

    // 3. Run seeders if database is empty
    const adminCount = await db('admins').count('id as count').first();
    if (parseInt(adminCount.count || 0, 10) === 0) {
      console.log('🌱 Database empty. Running initial seeders...');
      await db.seed.run();
      console.log('✅ Initial database seed completed.');
    }

    app.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(`🚀 SaaS Admin Server running on Port: ${PORT}`);
      console.log(`🔒 Security: JWT + Refresh Rotation, Zod Validation, RBAC`);
      console.log(`📜 Audit: Tamper-Evident SHA-256 Hash Chaining Active`);
      console.log(`🗄️ Database: Knex + SQLite Connected (Single Process)`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1);
  }
}

startServer();
