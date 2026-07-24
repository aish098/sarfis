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

    const server = app.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(`🚀 SaaS Admin Server running on Port: ${PORT}`);
      console.log(`🔒 Security: JWT + Refresh Rotation, Zod Validation, RBAC`);
      console.log(`📜 Audit: Tamper-Evident SHA-256 Hash Chaining Active`);
      console.log(`🗄️ Database: Knex Connected (${process.env.DB_CLIENT || 'sqlite3'})`);
      console.log(`===========================================`);
    });

    // --- GRACEFUL SHUTDOWN HANDLER (SIGTERM & SIGINT) ---
    const shutdown = async (signal) => {
      console.log(`\n⚠️ ${signal} received. Initiating graceful shutdown...`);

      // 10-Second Fallback Force Exit Timer
      const forceExitTimer = setTimeout(() => {
        console.error('❌ Graceful shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      server.close(async () => {
        console.log('🔌 HTTP server closed. Disconnecting database connections...');
        try {
          await db.destroy();
          console.log('✅ Database connection pool destroyed cleanly.');
          process.exit(0);
        } catch (dbErr) {
          console.error('❌ Database disconnection error during shutdown:', dbErr);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1);
  }
}

startServer();
