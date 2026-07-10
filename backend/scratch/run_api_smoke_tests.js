require('dotenv').config();
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Programmatically generate a high-privilege Super Admin JWT token
const token = jwt.sign(
  { id: 1, email: 'admin@sarfis.com', role: 'Super Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const endpoints = [
  { path: '/settings/system/health', method: 'GET', auth: false },
  { path: '/companies', method: 'GET', auth: true, headers: { 'x-company-id': '1' } },
  { path: '/journal', method: 'GET', auth: true, headers: { 'x-company-id': '1' } },
  { path: '/budgets', method: 'GET', auth: true, headers: { 'x-company-id': '1' } },
  { path: '/workflows/pending', method: 'GET', auth: true, headers: { 'x-company-id': '1' } },
  { path: '/settings/1/mail-config', method: 'GET', auth: true, headers: { 'x-company-id': '1' } },
  { path: '/settings/1/mail-logs', method: 'GET', auth: true, headers: { 'x-company-id': '1' } }
];

async function runSmokeTests() {
  console.log("=========================================================");
  console.log("                SARFIS ERP API SMOKE TESTS               ");
  console.log("=========================================================");
  console.log(`Base URL: ${BASE_URL}\n`);

  for (const ep of endpoints) {
    const url = `${BASE_URL}${ep.path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(ep.headers || {})
    };

    if (ep.auth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: ep.method,
        headers
      });
      const latency = Date.now() - start;
      const status = res.status;
      
      const bodyText = await res.text();

      if (status >= 200 && status < 300) {
        console.log(`✅ [${status}] ${ep.method} ${ep.path} - PASSED (${latency}ms)`);
      } else {
        console.error(`❌ [${status}] ${ep.method} ${ep.path} - FAILED (${latency}ms)`);
        console.error(`   Response Body:`, bodyText);
      }
    } catch (err) {
      console.error(`❌ [ERR] ${ep.method} ${ep.path} - FAILED`);
      console.error(`   Error message: ${err.message}`);
    }
  }

  process.exit(0);
}

runSmokeTests();
