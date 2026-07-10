require('dotenv').config();
const db = require('./src/config/db');
const MailProvider = require('./src/services/mail/mail.provider');
const { encrypt, decrypt } = require('./src/utils/crypto');

async function runTests() {
  console.log("=========================================================");
  console.log("RUNNING REAL SMTP & MAIL PROVIDER INTEGRATION TESTS...");
  console.log("=========================================================");

  const companyId = 12;

  try {
    // 1. Test Password Encryption/Decryption
    console.log("\n[TEST 1] Testing AES-256 password encryption...");
    const plainText = "MySuperSecretPass123!";
    const cipherText = encrypt(plainText);
    console.log(`- Plain text: "${plainText}"`);
    console.log(`- Encrypted string: "${cipherText}"`);
    
    if (cipherText === plainText) {
      throw new Error("Encryption failed: plain text equals cipher text.");
    }

    const decrypted = decrypt(cipherText);
    console.log(`- Decrypted: "${decrypted}"`);
    if (decrypted !== plainText) {
      throw new Error("Decryption failed: decrypted text doesn't match original.");
    }
    console.log("✅ Encryption/Decryption test passed.");

    // 2. Configure Mail Server in Database
    console.log("\n[TEST 2] Configuring custom Mail Server in database...");
    // Clear existing configurations
    await db('mail_configurations').where({ company_id: companyId }).delete();
    
    await db('mail_configurations').insert({
      company_id: companyId,
      provider: 'MOCK',
      host: 'smtp.mockserver.local',
      port: 1025,
      username: 'user@mockserver.local',
      password: encrypt('mockPassKey123'),
      from_name: 'SARFIS Sandbox',
      from_email: 'sandbox@sarfis.com',
      encryption: 'TLS',
      status: 'ACTIVE'
    });
    console.log("- Configuration inserted successfully.");

    // Retrieve and verify password is encrypted in database
    const row = await db('mail_configurations').where({ company_id: companyId }).first();
    console.log(`- Stored Password in DB: "${row.password}"`);
    if (row.password === 'mockPassKey123') {
      throw new Error("Database Security breach: Password was stored in plain text.");
    }
    console.log("✅ Security audit passed: Password is encrypted in DB.");

    // 3. Resolve Provider Factory
    console.log("\n[TEST 3] Resolving provider via MailProvider factory...");
    const provider = await MailProvider.getProvider(companyId);
    console.log(`- Resolved provider class: ${provider.constructor.name}`);
    if (provider.constructor.name !== 'MockProvider') {
      throw new Error("Factory resolution failed: Expected MockProvider.");
    }
    console.log("✅ Provider Factory resolution passed.");

    // 4. Dispatch and check delivery logs
    console.log("\n[TEST 4] Dispatching test email via MailProvider...");
    // Clean old logs
    await db('email_delivery_logs').where({ company_id: companyId }).delete();

    const outcome = await MailProvider.send({
      companyId,
      to: 'employee@test.com',
      subject: 'SMTP Connection Direct Test',
      html: '<h3>Test Successful</h3>'
    });
    console.log(`- Send Latency: ${outcome.durationMs}ms`);

    // Verify Log entries
    const deliveryLog = await db('email_delivery_logs')
      .where({ company_id: companyId, recipient: 'employee@test.com' })
      .first();

    console.log(`- Created Delivery Log? ${deliveryLog ? 'Yes' : 'No'}`);
    if (!deliveryLog) {
      throw new Error("Delivery logging failed: no audit log found in email_delivery_logs.");
    }
    console.log(`- Logged Provider: "${deliveryLog.provider}"`);
    console.log(`- Logged Status: "${deliveryLog.status}"`);
    console.log(`- SMTP Server Response: "${deliveryLog.smtp_response}"`);

    if (deliveryLog.status !== 'SUCCESS' || deliveryLog.provider !== 'MOCK') {
      throw new Error("Delivery Log attributes mismatch.");
    }
    console.log("✅ Delivery Audit Logging passed.");

    // Cleanup
    await db('mail_configurations').where({ company_id: companyId }).delete();
    await db('email_delivery_logs').where({ company_id: companyId }).delete();
    console.log("\n[CLEANUP] Configs and delivery logs removed.");

  } catch (err) {
    console.error("\n❌ Test run failed with error:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
