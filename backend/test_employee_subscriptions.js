require('dotenv').config();
const db = require('./src/config/db');
const NotificationService = require('./src/services/notification.service');

async function runTests() {
  console.log("=========================================================");
  console.log("RUNNING EMPLOYEE NOTIFICATION SUBSCRIPTION TESTS...");
  console.log("=========================================================");

  const companyId = 12;
  const userId = 2; // Test Admin user

  try {
    // 1. Resolve or create test employee linked to user 2
    let emp = await db('employees').where({ user_id: userId, company_id: companyId }).first();
    if (!emp) {
      [emp] = await db('employees')
        .insert({
          company_id: companyId,
          user_id: userId,
          name: 'Bisma Khan (Admin Test)',
          role: 'Finance Manager',
          department: 'Finance',
          salary: 120000,
          status: 'Active'
        })
        .returning('*');
      console.log(`[SETUP] Created test employee ID: ${emp.id}`);
    } else {
      await db('employees').where({ id: emp.id }).update({ status: 'Active' });
      console.log(`[SETUP] Resolved existing employee ID: ${emp.id}`);
    }

    const eventDef = await db('notification_events').where({ event_code: 'JOURNAL_POSTED' }).first();
    if (!eventDef) {
      throw new Error("Seeded 'JOURNAL_POSTED' event code not found in notification_events.");
    }

    // Clear old subscriptions for this test
    await db('employee_notification_subscriptions').where({ employee_id: emp.id }).delete();
    console.log("[SETUP] Cleared prior notification subscriptions.");

    // Clear old queue entries for this test
    await db('notification_queue').where({ user_id: userId, event_code: 'JOURNAL_POSTED' }).delete();

    // ==========================================
    // TEST CASE A: Explicit Subscription (EMAIL ONLY)
    // ==========================================
    console.log("\n[TEST A] Subscribing employee to EMAIL channel only...");
    await db('employee_notification_subscriptions').insert({
      company_id: companyId,
      employee_id: emp.id,
      event_id: eventDef.id,
      channel: 'EMAIL',
      enabled: true
    });
    await db('employee_notification_subscriptions').insert({
      company_id: companyId,
      employee_id: emp.id,
      event_id: eventDef.id,
      channel: 'APP',
      enabled: false
    });

    console.log("- Triggering JOURNAL_POSTED notification...");
    await NotificationService.notify({
      eventCode: 'JOURNAL_POSTED',
      companyId,
      payload: { id: 999, reference: 'TEST-A', amount: 5000 }
    });

    // Verify: should have queued 1 email, but 0 in-app notifications
    const queuedEmailsA = await db('notification_queue')
      .where({ user_id: userId, event_code: 'JOURNAL_POSTED' });
    console.log(`- Queued emails count: ${queuedEmailsA.length}`);

    const inAppA = await db('notifications')
      .where({ user_id: userId, event_code: 'JOURNAL_POSTED' });
    console.log(`- In-app alerts count: ${inAppA.length}`);

    if (queuedEmailsA.length !== 1) {
      throw new Error("Test A Failed: Expected exactly 1 queued email.");
    }
    console.log("✅ Test Case A passed.");

    // ==========================================
    // TEST CASE B: Explicit Subscription (APP ONLY)
    // ==========================================
    console.log("\n[TEST B] Toggling subscription to APP channel only...");
    await db('employee_notification_subscriptions')
      .where({ employee_id: emp.id, channel: 'EMAIL' })
      .update({ enabled: false });
    await db('employee_notification_subscriptions')
      .where({ employee_id: emp.id, channel: 'APP' })
      .update({ enabled: true });

    // Clean tables
    await db('notification_queue').where({ user_id: userId, event_code: 'JOURNAL_POSTED' }).delete();
    await db('notifications').where({ user_id: userId, event_code: 'JOURNAL_POSTED' }).delete();

    console.log("- Triggering JOURNAL_POSTED notification...");
    await NotificationService.notify({
      eventCode: 'JOURNAL_POSTED',
      companyId,
      payload: { id: 999, reference: 'TEST-B', amount: 5000 }
    });

    const queuedEmailsB = await db('notification_queue')
      .where({ user_id: userId, event_code: 'JOURNAL_POSTED' });
    console.log(`- Queued emails count: ${queuedEmailsB.length}`);

    const inAppB = await db('notifications')
      .where({ user_id: userId, event_code: 'JOURNAL_POSTED' });
    console.log(`- In-app alerts count: ${inAppB.length}`);

    if (inAppB.length !== 1 || queuedEmailsB.length !== 0) {
      throw new Error("Test B Failed: Expected exactly 1 in-app alert and 0 queued emails.");
    }
    console.log("✅ Test Case B passed.");

    // Cleanup
    await db('employee_notification_subscriptions').where({ employee_id: emp.id }).delete();
    await db('notification_queue').where({ user_id: userId, event_code: 'JOURNAL_POSTED' }).delete();
    await db('notifications').where({ user_id: userId, event_code: 'JOURNAL_POSTED' }).delete();
    console.log("\n[CLEANUP] Test subscriptions cleared.");

  } catch (err) {
    console.error("\n❌ Test run encountered error:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
