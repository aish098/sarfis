const db = require('../../config/db');
const { decrypt } = require('../../utils/crypto');
const MockProvider = require('./providers/mock.provider');
const SmtpProvider = require('./providers/smtp.provider');

class MailProvider {
  /**
   * Gets the provider instance for the company, or falls back to system defaults.
   */
  static async getProvider(companyId) {
    if (companyId) {
      const config = await db('mail_configurations')
        .where({ company_id: companyId, status: 'ACTIVE' })
        .first();

      if (config) {
        if (config.provider === 'SMTP') {
          const decryptedPassword = decrypt(config.password);
          return new SmtpProvider({
            ...config,
            password: decryptedPassword
          });
        } else {
          return new MockProvider();
        }
      }
    }

    // Fallback to system env
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      return new SmtpProvider({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        username: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        from_name: process.env.SMTP_FROM_NAME || 'ACCOUNTELLENCE ERP System',
        from_email: process.env.SMTP_FROM,
        encryption: process.env.SMTP_PORT === '465' ? 'SSL' : 'TLS'
      });
    }

    return new MockProvider();
  }

  /**
   * Dispatches email and writes a delivery log to email_delivery_logs.
   */
  static async send({ companyId, to, cc, bcc, subject, html, text, attachments = [] }) {
    const providerInstance = await this.getProvider(companyId);
    const providerName = providerInstance.constructor.name.replace('Provider', '').toUpperCase();

    const result = await providerInstance.send({ to, cc, bcc, subject, html, text, attachments });

    // Write audit log to email_delivery_logs
    try {
      await db('email_delivery_logs').insert({
        company_id: companyId || 1,
        recipient: to,
        subject: subject,
        provider: providerName,
        duration_ms: result.durationMs || 0,
        smtp_response: result.response || null,
        status: result.success ? 'SUCCESS' : 'FAILED',
        error_message: result.errorMessage || null
      });
    } catch (logErr) {
      console.error('[EMAIL AUDIT LOG ERROR] Failed to write delivery log:', logErr.message);
    }

    if (!result.success) {
      throw new Error(result.errorMessage || 'Email delivery failed');
    }

    return result;
  }
}

module.exports = MailProvider;
