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

    // 3. Ensure Master Super Admin exists and credentials are synced on startup
    const bcrypt = require('bcryptjs');
    const initialEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@saas.com';
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPass123!';

    const superAdminRole = await db('admin_roles').where({ name: 'SUPER_ADMIN' }).first();

    if (!superAdminRole) {
      console.log('🌱 Roles missing. Running initial seeders...');
      await db.seed.run();
    } else {
      const existingAdmin = await db('admins').whereRaw('LOWER(email) = ?', [initialEmail.toLowerCase()]).first();
      const passwordHash = await bcrypt.hash(initialPassword, 10);

      if (!existingAdmin) {
        console.log(`🌱 Master Admin (${initialEmail}) missing. Creating master admin...`);
        await db('admins').insert({
          name: 'Master Admin',
          email: initialEmail,
          password_hash: passwordHash,
          role_id: superAdminRole.id,
          status: 'ACTIVE',
          must_change_password: true
        });
      } else {
        await db('admins').where({ id: existingAdmin.id }).update({
          password_hash: passwordHash,
          status: 'ACTIVE',
          updated_at: new Date()
        });
        console.log(`✅ Master Admin (${initialEmail}) credentials synced successfully.`);
      }
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
