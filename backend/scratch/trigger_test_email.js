require('dotenv').config();
const db = require('../src/config/db');

async function triggerEmails() {
  const companyId = 12; // Standard test company ID
  const userId = 2; // Test user ID

  console.log("=========================================================");
  console.log("TRIGGERING TEST EMAILS FOR NOTIFICATION MODULE...");
  console.log("=========================================================");

  try {
    // 1. Insert standard successful test email
    const [successId] = await db('notification_queue')
      .insert({
        company_id: companyId,
        user_id: userId,
        event_code: 'TEST_SUCCESS',
        recipient_email: 'recipient@example.com',
        subject: 'SUCCESS TEST: SARFIS Notification Engine',
        body: '<h1>Congratulations!</h1><p>Your email system is functioning correctly.</p>',
        status: 'PENDING',
        attempts: 0,
        max_attempts: 3
      })
      .returning('id');

    console.log(`✅ Queued successful email (ID: ${typeof successId === 'object' ? successId.id : successId}, recipient: recipient@example.com)`);

    // 2. Insert failure test email to verify retry logs
    const [failId] = await db('notification_queue')
      .insert({
        company_id: companyId,
        user_id: userId,
        event_code: 'TEST_FAILURE',
        recipient_email: 'fail@domain.com', // triggers simulated fail in SMTP mailer
        subject: 'FAILURE TEST: SMTP Connection Timeout',
        body: '<h1>Warning!</h1><p>This email is destined to fail to test recovery paths.</p>',
        status: 'PENDING',
        attempts: 0,
        max_attempts: 3
      })
      .returning('id');

    console.log(`✅ Queued failing email (ID: ${typeof failId === 'object' ? failId.id : failId}, recipient: fail@domain.com)`);
    console.log("\nQueue items written. The background email runner will process them within 10 seconds.");
    console.log("Open your browser and navigate to the Email Center at '/dashboard/admin/emails' to view the results.");

  } catch (err) {
    console.error("❌ Error writing test emails:", err);
  } finally {
    process.exit(0);
  }
}

triggerEmails();
