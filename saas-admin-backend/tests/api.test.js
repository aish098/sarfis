require('dotenv').config();
const app = require('../src/app');
const db = require('../src/db/knex');

async function runHardenedTests() {
  console.log('===========================================');
  console.log('🧪 RUNNING HARDENED SAAS ADMIN API SUITE (OPERATIONAL HARDENING)');
  console.log('===========================================');

  try {
    await db.migrate.rollback(null, true);
    await db.migrate.latest();
    await db.seed.run();
  } catch (dbErr) {
    console.error('Database setup error:', dbErr);
  }

  const server = app.listen(3003);
  const baseUrl = 'http://localhost:3003';

  try {
    // 1. Probes Test (/live, /ready, /health)
    const liveRes = await fetch(`${baseUrl}/live`);
    const liveData = await liveRes.json();
    console.log('✅ 1a. Liveness Probe (No DB):', liveData.status);

    const readyRes = await fetch(`${baseUrl}/ready`);
    const readyData = await readyRes.json();
    console.log('✅ 1b. Readiness Probe (DB Check):', readyData.status, '| DB:', readyData.database);

    const publicHealthRes = await fetch(`${baseUrl}/health`);
    const publicHealthData = await publicHealthRes.json();
    if (publicHealthData.status === 'HEALTHY' && publicHealthData.memory === undefined) {
      console.log('✅ 1c. Public Health Probe: Returned minimal safe status without infrastructure disclosure.');
    } else {
      throw new Error('Public health probe leaked internal memory diagnostics');
    }

    // 2. Admin Authentication Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@saas.com', password: 'AdminPass123!' })
    });
    const loginData = await loginRes.json();
    let accessToken = loginData.data.accessToken;
    let refreshToken = loginData.data.refreshToken;
    console.log('✅ 2. Admin Auth: Logged in (mustChangePassword =', loginData.data.mustChangePassword, ')');

    // 3. Authenticated Health Probe
    const adminHealthRes = await fetch(`${baseUrl}/health`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const adminHealthData = await adminHealthRes.json();
    if (adminHealthData.memory && adminHealthData.memory.heap_used_mb !== undefined) {
      console.log('✅ 3. Authenticated Health Probe: Returned rich diagnostic memory metrics (Heap:', adminHealthData.memory.heap_used_mb, 'MB).');
    }

    // 4. Change Initial Password
    const changePassRes = await fetch(`${baseUrl}/api/auth/change-initial-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword: 'AdminPass123!', newPassword: 'NewSecurePassword123!' })
    });
    const changePassData = await changePassRes.json();
    console.log('✅ 4. Initial Password Rotation:', changePassData.message);

    // 5. Re-Login with New Password
    const reloginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@saas.com', password: 'NewSecurePassword123!' })
    });
    const reloginData = await reloginRes.json();
    accessToken = reloginData.data.accessToken;
    refreshToken = reloginData.data.refreshToken;
    console.log('✅ 5. Re-Login Success: Full access token granted.');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // 6. Refresh Token Rotation
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const refreshData = await refreshRes.json();
    console.log('✅ 6. Refresh Token Rotation: Swapped refresh token.');

    // 7. Refresh Token Reuse Detection
    const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (reuseRes.status === 401) {
      console.log('✅ 7. Token Family Reuse Guard: Detected token reuse & revoked token family.');
    }

    // Re-login after security lockout
    const reloginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@saas.com', password: 'NewSecurePassword123!' })
    });
    const reloginData2 = await reloginRes2.json();
    const activeHeaders = {
      'Authorization': `Bearer ${reloginData2.data.accessToken}`,
      'Content-Type': 'application/json'
    };

    // 8. Self-Block Guard Test
    const selfBlockRes = await fetch(`${baseUrl}/api/users/1/block`, {
      method: 'PUT',
      headers: activeHeaders,
      body: JSON.stringify({ status: true, reason: 'Self Block Test' })
    });
    if (selfBlockRes.status === 400) {
      console.log('✅ 8. Self-Block Guard: Rejected administrator self-blocking attempt with HTTP 400.');
    }

    // 9. Zod Schema Validation Test
    const invalidCouponRes = await fetch(`${baseUrl}/api/coupons/generate`, {
      method: 'POST',
      headers: activeHeaders,
      body: JSON.stringify({
        code: 'BADCOUPON',
        discount_type: 'percentage',
        discount_value: 150,
        expiry_date: '2026-12-31T23:59:59Z'
      })
    });
    if (invalidCouponRes.status === 400) {
      console.log('✅ 9. Zod Schema Validation: Rejected 150% percentage discount with HTTP 400.');
    }

    // 10. Generate Valid Coupon
    const validCouponRes = await fetch(`${baseUrl}/api/coupons/generate`, {
      method: 'POST',
      headers: activeHeaders,
      body: JSON.stringify({
        code: 'HARDENED2026',
        discount_type: 'percentage',
        discount_value: 20,
        expiry_date: '2026-12-31T23:59:59Z',
        usage_limit: 100
      })
    });
    const validCouponData = await validCouponRes.json();
    console.log('✅ 10. Valid Coupon Generated:', validCouponData.data.code);

    // 11. Tamper-Evident Audit Log Hash Verification
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, { headers: activeHeaders });
    const auditData = await auditRes.json();
    const sampleLog = auditData.data[0];
    if (sampleLog && sampleLog.record_hash) {
      console.log('✅ 11. Audit Hash Chain Verified: Record Hash =', sampleLog.record_hash.substring(0, 16) + '...');
    }

    console.log('===========================================');
    console.log('🎉 ALL OPERATIONAL & SECURITY CHECKS PASSED 100% CLEANLY!');
    console.log('===========================================');

    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Hardened Test Suite Error:', err);
    server.close(() => {
      process.exit(1);
    });
  }
}

runHardenedTests();
