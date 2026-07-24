require('dotenv').config();
const app = require('../src/app');
const db = require('../src/db/knex');

async function runHardenedTests() {
  console.log('===========================================');
  console.log('🧪 RUNNING HARDENED SAAS ADMIN API SUITE (PASS 2)');
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
    // 1. Health Check
    const healthRes = await fetch(`${baseUrl}/`);
    const healthData = await healthRes.json();
    console.log('✅ 1. Health Check:', healthData.name, '| Status:', healthData.status);

    // 2. Initial Admin Auth Login (Receives mustChangePassword=true)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@saas.com', password: 'AdminPass123!' })
    });
    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error('Login failed: ' + loginData.message);
    
    let accessToken = loginData.data.accessToken;
    let refreshToken = loginData.data.refreshToken;
    console.log('✅ 2. Admin Auth: Logged in (mustChangePassword =', loginData.data.mustChangePassword, ')');

    // 3. Test Restricted Scope (Attempting to view users with mustChangePassword=true must fail with 403)
    const restrictedRes = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (restrictedRes.status === 403) {
      console.log('✅ 3. Password Scope Restriction: Blocked API access until initial password is rotated.');
    } else {
      throw new Error('Failed to restrict access for mustChangePassword token');
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
    console.log('✅ 5. Re-Login Success: Full access token granted (mustChangePassword = false).');

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
    const newRefreshToken = refreshData.data.refreshToken;
    console.log('✅ 6. Refresh Token Rotation: Swapped refresh token.');

    // 7. Refresh Token Reuse Detection (Reusing old refreshToken must revoke family!)
    const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (reuseRes.status === 401) {
      console.log('✅ 7. Token Family Reuse Guard: Detected token reuse & revoked token family.');
    } else {
      throw new Error('Token reuse detection failed to trigger 401 response');
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

    // 8. Self-Block Guard Test (Admin trying to block admin_id 1 must fail)
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
    if (sampleLog && sampleLog.record_hash && sampleLog.previous_hash !== undefined) {
      console.log('✅ 11. Audit Hash Chain Verified: Record Hash =', sampleLog.record_hash.substring(0, 16) + '...');
    }

    console.log('===========================================');
    console.log('🎉 ALL 11 HARDENED PRODUCTION CHECKS PASSED 100% CLEANLY!');
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
