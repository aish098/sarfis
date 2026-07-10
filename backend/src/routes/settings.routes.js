const express = require('express');
const router = express.Router();
const SettingsModel = require('../models/settings.model');
const { authMiddleware, requirePermission, companyGuard } = require('../middleware/auth.middleware');

// SYSTEM HEALTH MONITORING ENDPOINT (Public)
router.get('/system/health', async (req, res) => {
  try {
    const db = require('../config/db');
    const os = require('os');
    
    // 1. Check Database connection
    let dbStatus = 'UP';
    let dbError = null;
    try {
      await db.raw('SELECT 1');
    } catch (err) {
      dbStatus = 'DOWN';
      dbError = err.message;
    }

    // 2. Query Knex Migration Version
    let migrationVersion = 'Unknown';
    try {
      migrationVersion = await db.migrate.currentVersion();
    } catch (err) {
      console.error(err);
    }

    // 3. Count Pending/Failed Queue Items
    let pendingQueueCount = 0;
    let failedQueueCount = 0;
    try {
      const pending = await db('notification_queue').where({ status: 'PENDING' }).count('id as count').first();
      const failed = await db('notification_queue').where({ status: 'FAILED' }).count('id as count').first();
      pendingQueueCount = parseInt(pending?.count || 0);
      failedQueueCount = parseInt(failed?.count || 0);
    } catch (err) {
      console.error(err);
    }

    // 4. Memory Metrics
    const memory = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    res.json({
      status: dbStatus === 'UP' ? 'HEALTHY' : 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      database: {
        status: dbStatus,
        version: migrationVersion,
        error: dbError
      },
      queue: {
        pending: pendingQueueCount,
        failed: failedQueueCount
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memoryUsageMB: Math.round(memory.rss / (1024 * 1024)),
        freeMemoryGB: Math.round(freeMem / (1024 * 1024 * 1024) * 100) / 100,
        totalMemoryGB: Math.round(totalMem / (1024 * 1024 * 1024) * 100) / 100
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authMiddleware);

// Get settings for a company
router.get('/:companyId', companyGuard, async (req, res) => {
  try {
    const { companyId } = req.params;
    const settings = await SettingsModel.getSettings(companyId);
    res.json(settings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// Update settings for a company
router.put('/:companyId', companyGuard, requirePermission('settings.manage'), async (req, res) => {
  try {
    const { companyId } = req.params;
    const value = req.body;
    
    const updatedSettings = await SettingsModel.upsertSettings(companyId, value);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET SMTP Mail Config
router.get('/:companyId/mail-config', companyGuard, async (req, res) => {
  try {
    const db = require('../config/db');
    const { companyId } = req.params;
    const config = await db('mail_configurations').where({ company_id: companyId }).first();
    
    if (config) {
      if (config.password) config.password = '********';
      res.json(config);
    } else {
      res.json({ provider: 'MOCK', encryption: 'TLS', status: 'ACTIVE' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SAVE SMTP Mail Config
router.put('/:companyId/mail-config', companyGuard, requirePermission('settings.manage'), async (req, res) => {
  try {
    const db = require('../config/db');
    const { encrypt } = require('../utils/crypto');
    const { companyId } = req.params;
    const { provider, host, port, username, password, from_name, from_email, encryption, status } = req.body;

    let finalPassword = password;
    if (password === '********') {
      const existing = await db('mail_configurations').where({ company_id: companyId }).first();
      finalPassword = existing ? existing.password : '';
    } else if (password) {
      finalPassword = encrypt(password);
    }

    const existing = await db('mail_configurations').where({ company_id: companyId }).first();
    if (existing) {
      await db('mail_configurations')
        .where({ company_id: companyId })
        .update({
          provider: provider || 'MOCK',
          host: host || null,
          port: port ? parseInt(port) : null,
          username: username || null,
          password: finalPassword || null,
          from_name: from_name || null,
          from_email: from_email || null,
          encryption: encryption || 'TLS',
          status: status || 'ACTIVE',
          updated_at: db.fn.now()
        });
    } else {
      await db('mail_configurations').insert({
        company_id: companyId,
        provider: provider || 'MOCK',
        host: host || null,
        port: port ? parseInt(port) : null,
        username: username || null,
        password: finalPassword || null,
        from_name: from_name || null,
        from_email: from_email || null,
        encryption: encryption || 'TLS',
        status: status || 'ACTIVE'
      });
    }

    res.json({ message: 'Mail server configuration saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEST SMTP CONNECTION
router.post('/:companyId/mail-config/test', companyGuard, requirePermission('settings.manage'), async (req, res) => {
  try {
    const db = require('../config/db');
    const { decrypt } = require('../utils/crypto');
    const SmtpProvider = require('../services/mail/providers/smtp.provider');
    const { companyId } = req.params;
    const { host, port, username, password, from_name, from_email, encryption, testEmail } = req.body;

    let finalPassword = password;
    if (password === '********') {
      const existing = await db('mail_configurations').where({ company_id: companyId }).first();
      finalPassword = existing ? decrypt(existing.password) : '';
    }

    const tester = new SmtpProvider({
      host,
      port: parseInt(port || '587'),
      username,
      password: finalPassword,
      from_name,
      from_email,
      encryption
    });

    const dest = testEmail || req.user?.email || username;
    const outcome = await tester.send({
      to: dest,
      subject: 'SARFIS Email Integration: Test Connection Success',
      html: `<h3>Test Connection Succeeded</h3>
             <p>This email confirms that your company SMTP mail server is correctly configured in SARFIS.</p>
             <p>Timestamp: ${new Date().toISOString()}</p>`
    });

    if (outcome.success) {
      res.json({ success: true, message: `SMTP test connection succeeded! Email sent to ${dest}.` });
    } else {
      res.status(400).json({ error: outcome.errorMessage });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET MAIL DELIVERY LOGS & METRICS
router.get('/:companyId/mail-logs', companyGuard, async (req, res) => {
  try {
    const db = require('../config/db');
    const { companyId } = req.params;

    const logs = await db('email_delivery_logs')
      .where({ company_id: companyId })
      .orderBy('id', 'desc')
      .limit(50);

    const stats = await db('email_delivery_logs')
      .where({ company_id: companyId })
      .select('status')
      .count('id as count')
      .groupBy('status');

    const queueStats = await db('notification_queue')
      .where({ company_id: companyId })
      .select('status')
      .count('id as count')
      .groupBy('status');

    res.json({ logs, stats, queueStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
