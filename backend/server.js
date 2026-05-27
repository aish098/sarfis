require('dotenv').config();
const app = require('./src/app');
const db = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[Migrations] Running migrations...');
    await db.migrate.latest();
    console.log('[Migrations] Migrations completed successfully');
  } catch (error) {
    console.error('[Migrations] Migration failed:', error.message);
    console.error('[Migrations] Continuing server startup despite migration failure.');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
