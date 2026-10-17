const nodemailer = require('nodemailer');
const settingsService = require('./settingsService');

/**
 * Outgoing email (password resets, and notification copies when enabled).
 *
 * SMTP comes from Settings → Email, falling back to SMTP_* environment
 * variables. With neither configured, nothing is sent and the message is
 * printed to the server console instead — which is how a password reset
 * link can still be retrieved on a development machine.
 */

function configFrom(email) {
  const host = email.enabled && email.smtpHost ? email.smtpHost : process.env.SMTP_HOST;
  if (!host) return null;

  const fromSettings = email.enabled && email.smtpHost;
  return {
    transport: {
      host,
      port: Number(fromSettings ? email.smtpPort : process.env.SMTP_PORT) || 587,
      secure: fromSettings ? Boolean(email.smtpSecure) : process.env.SMTP_SECURE === 'true',
      auth: {
        user: fromSettings ? email.smtpUser : process.env.SMTP_USER,
        pass: fromSettings ? email.smtpPass : process.env.SMTP_PASS,
      },
    },
    from: {
      name: email.fromName || 'LMS',
      address: (fromSettings ? email.fromEmail : process.env.SMTP_FROM) || email.fromEmail,
    },
  };
}

/** True when an SMTP server is configured one way or the other. */
async function isConfigured() {
  const { email } = await settingsService.get();
  return Boolean(configFrom(email));
}

/**
 * Sends one message. Resolves { sent: boolean, error? } and never throws, so
 * a mail outage cannot fail the request that triggered the email.
 */
async function sendMail({ to, subject, text, html }) {
  const { email } = await settingsService.get();
  const config = configFrom(email);

  if (!config) {
    console.log(`\n[mail] SMTP not configured — not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text}\n`);
    return { sent: false, error: 'SMTP is not configured' };
  }

  try {
    const transporter = nodemailer.createTransport(config.transport);
    await transporter.sendMail({ from: config.from, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail, isConfigured };
