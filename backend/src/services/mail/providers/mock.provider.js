class MockProvider {
  async send({ to, cc, bcc, subject, html, text, attachments = [] }) {
    const startTime = Date.now();
    try {
      if (to === 'fail@domain.com') {
        throw new Error('Simulated SMTP Timeout');
      }

      console.log(`[MOCK MAIL PROVIDER] Simulating send email:`);
      console.log(`  To: ${to}`);
      if (cc) console.log(`  Cc: ${cc}`);
      if (bcc) console.log(`  Bcc: ${bcc}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Attachments count: ${attachments.length}`);

      return {
        success: true,
        durationMs: Date.now() - startTime,
        response: '250 2.0.0 OK (Simulated Sandbox)'
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        errorMessage: err.message
      };
    }
  }
}

module.exports = MockProvider;
