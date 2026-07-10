const db = require('../src/config/db');

async function listUsers() {
  try {
    const list = await db('users').select('id', 'email', 'name', 'role');
    console.log("Users in DB:", list);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

listUsers();
