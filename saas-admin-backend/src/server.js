require('dotenv').config();
const app = require('./app');
const db = require('./db/knex');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Run automated Knex migrations on startup
    console.log('🔄 Checking & applying database migrations...');
    await db.migrate.latest();
    console.log('✅ Database migrations up to date.');

    // Run seeders if database is empty
    const adminCount = await db('admins').count('id as count').first();
    if (parseInt(adminCount.count || 0, 10) === 0) {
      console.log('🌱 Database empty. Running initial seeders...');
      await db.seed.run();
      console.log('✅ Initial database seed completed.');
    }

    app.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(`🚀 SaaS Admin Server running on Port: ${PORT}`);
      console.log(`🔒 Security: JWT & RBAC Active`);
      console.log(`🗄️ Database: Knex + SQLite Connected`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
}

startServer();
