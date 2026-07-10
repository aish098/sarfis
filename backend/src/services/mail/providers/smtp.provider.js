const nodemailer = require('nodemailer');

class SmtpProvider {
  constructor(config) {
    this.config = config;
    const isSecure = String(config.encryption).toUpperCase() === 'SSL';
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: isSecure, // true for SSL (465), false for TLS (587)
      auth: {
        user: config.username,
        pass: config.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async send({ to, cc, bcc, subject, html, text, attachments = [] }) {
    const startTime = Date.now();
    try {
      const fromName = this.config.from_name || 'SARFIS ERP';
      const fromEmail = this.config.from_email || this.config.username;
      
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        cc,
        bcc,
        subject,
        html,
        text,
        attachments: attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }))
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[SMTP MAIL PROVIDER] Email sent successfully to ${to} (MessageID: ${info.messageId})`);

      return {
        success: true,
        durationMs: Date.now() - startTime,
        response: info.response || `Sent: ${info.messageId}`
      };
    } catch (err) {
      console.error(`[SMTP MAIL PROVIDER ERROR] Failed to send email to ${to}:`, err);
      return {
        success: false,
        durationMs: Date.now() - startTime,
        errorMessage: err.message
      };
    }
  }
}

module.exports = SmtpProvider;
