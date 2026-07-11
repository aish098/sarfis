const request = require('supertest');
const jwt = require('jsonwebtoken');
const assert = require('assert');
const app = require('../src/app');
const db = require('../src/config/db');

describe('Payroll API Integration Tests', () => {
  let token;

  before(() => {
    // Generate valid admin test token
    token = jwt.sign(
      { 
        id: 1, 
        email: 'admin@sarfis.com', 
        role: 'ADMIN', 
        company_id: 1,
        permissions: ['user.manage']
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/payroll/1/reports/register', () => {
    it('returns the history register of payroll runs', async () => {
      const res = await request(app)
        .get('/api/payroll/1/reports/register')
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .expect(200);

      assert.ok(Array.isArray(res.body), 'Response should be an array');
    });
  });

  describe('GET /api/employees/1', () => {
    it('returns standard base HR employee directory rows', async () => {
      const res = await request(app)
        .get('/api/employees/1')
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .expect(200);

      assert.ok(Array.isArray(res.body), 'Response should be an array');
    });
  });

  describe('POST /api/payroll/1/formula/validate', () => {
    it('validates a correct formula expression successfully', async () => {
      const res = await request(app)
        .post('/api/payroll/1/formula/validate')
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .send({ formula: 'basic * 0.12', variables: ['basic'] })
        .expect(200);

      assert.strictEqual(res.body.valid, true, 'Formula should be valid');
    });

    it('rejects an invalid formula containing syntax errors', async () => {
      const res = await request(app)
        .post('/api/payroll/1/formula/validate')
        .set('Authorization', `Bearer ${token}`)
        .set('x-company-id', '1')
        .send({ formula: 'basic *+/', variables: ['basic'] })
        .expect(200);

      assert.strictEqual(res.body.valid, false, 'Formula should be invalid');
      assert.ok(res.body.error, 'Should return error detail explanation');
    });
  });
});
