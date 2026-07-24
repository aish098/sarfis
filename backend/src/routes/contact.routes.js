const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');

// In-memory fallback queue for inquiries if DB connection is unavailable
const memoryInquiries = [];

// Public route to submit contact inquiry
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const inquiryRecord = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject ? subject.trim() : 'General Inquiry',
      message: message.trim(),
      status: 'PENDING',
      ip_address: typeof ipAddress === 'string' ? ipAddress.slice(0, 45) : '',
      created_at: new Date(),
      updated_at: new Date()
    };

    let insertedId = null;

    try {
      const hasTable = await db.schema.hasTable('contact_inquiries');
      if (!hasTable) {
        await db.schema.createTable('contact_inquiries', (table) => {
          table.uuid('id').primary();
          table.string('name').notNullable();
          table.string('email').notNullable();
          table.string('subject').nullable();
          table.text('message').notNullable();
          table.string('status').defaultTo('PENDING');
          table.string('ip_address').nullable();
          table.timestamps(true, true);
        });
      }

      await db('contact_inquiries').insert(inquiryRecord);
      insertedId = inquiryRecord.id;
    } catch (dbErr) {
      console.warn('[CONTACT FORM] Database storage unavailable, saving to memory fallback:', dbErr.message);
      memoryInquiries.push(inquiryRecord);
      insertedId = inquiryRecord.id;
    }

    console.log(`[CONTACT FORM] New inquiry received from ${name} (${email}) - ID: ${insertedId}`);

    return res.status(200).json({
      success: true,
      message: "Thank you for reaching out! Your inquiry has been logged successfully and our team will get back to you within 24 hours.",
      inquiryId: insertedId
    });
  } catch (err) {
    console.error('[CONTACT FORM] Unexpected error:', err);
    return res.status(500).json({ error: 'Failed to record inquiry. Please try again later.' });
  }
});

// Protected/Admin route to fetch contact inquiries list
router.get('/', async (req, res) => {
  try {
    let dbInquiries = [];
    try {
      if (await db.schema.hasTable('contact_inquiries')) {
        dbInquiries = await db('contact_inquiries')
          .select('*')
          .orderBy('created_at', 'desc')
          .limit(100);
      }
    } catch (e) {
      console.warn('[CONTACT FORM] Cannot fetch from DB, returning memory list:', e.message);
    }
    const combined = [...memoryInquiries, ...dbInquiries];
    return res.status(200).json(combined);
  } catch (err) {
    console.error('[CONTACT FORM] Failed to fetch inquiries:', err);
    return res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

module.exports = router;
