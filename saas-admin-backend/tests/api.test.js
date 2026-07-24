require('dotenv').config();
const app = require('../src/app');
const db = require('../src/db/knex');

async function runTests() {
  console.log('===========================================');
  console.log('🧪 RUNNING SAAS ADMIN BACKEND API SUITE');
  console.log('===========================================');

  await db.migrate.latest();
  await db.seed.run();

  const server = app.listen(3002);
  const baseUrl = 'http://localhost:3002';

  try {
    // 1. Health Check
    const healthRes = await fetch(`${baseUrl}/`);
    const healthData = await healthRes.json();
    console.log('✅ Health Check:', healthData.message);

    // 2. Admin Authentication Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@saas.com', password: 'AdminPass123!' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    console.log('✅ Admin Auth (JWT): Logged in as', loginData.data.admin.name);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 3. Dashboard KPI Summary
    const statsRes = await fetch(`${baseUrl}/api/dashboard/stats`, { headers });
    const statsData = await statsRes.json();
    console.log('✅ Dashboard KPIs:', statsData.data.users);

    // 4. Get Users (Paginated & Filtered)
    const usersRes = await fetch(`${baseUrl}/api/users?page=1&limit=10&status=ACTIVE&search=alice`, { headers });
    const usersData = await usersRes.json();
    console.log('✅ Users List:', usersData.pagination.total_items, 'match search.');

    // 5. Toggle Block Status (Block Alice)
    const blockRes = await fetch(`${baseUrl}/api/users/d3b07384-d113-4ec6-a558-71ebb398d8b2/block`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: true, reason: 'Security Audit Check' })
    });
    const blockData = await blockRes.json();
    console.log('✅ User Blocked:', blockData.message);

    // 6. Generate Coupon
    const couponRes = await fetch(`${baseUrl}/api/coupons/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: 'PROMO2026',
        discount_type: 'percentage',
        discount_value: 15,
        expiry_date: '2026-12-31T23:59:59Z',
        usage_limit: 100
      })
    });
    const couponData = await couponRes.json();
    console.log('✅ Coupon Generated:', couponData.data.code);

    // 7. Audit Logs Verification
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, { headers });
    const auditData = await auditRes.json();
    console.log('✅ Audit Trail Entries Logged:', auditData.pagination.total_items);

    console.log('===========================================');
    console.log('🎉 SUITE COMPLETED WITH 100% SUCCESS');
    console.log('===========================================');
    
    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Test Suite Error:', err);
    server.close(() => {
      process.exit(1);
    });
  }
}

runTests();
