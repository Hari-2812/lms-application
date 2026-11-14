const crypto = require('crypto');
const nodemailer = require('nodemailer');
const settingsService = require('./settingsService');

/**
 * Outgoing email (password resets, test emails, and notification copies when
 * enabled), through Resend or an SMTP server.
 *
 * Which one is used:
 *   1. Settings → Email, when "Send email" is on: the chosen provider. With no
 *      provider chosen, Resend if an API key is available, otherwise SMTP.
 *      The Resend key can be saved there or put in server/.env as RESEND_API_KEY.
 *   2. Otherwise server/.env: RESEND_API_KEY, then SMTP_* variables.
 * With neither, nothing is sent and the message is printed to the server
 * console instead — which is how a password reset link can still be
 * retrieved on a development machine.
 */

const RESEND_API = 'https://api.resend.com';
// Resend's sandbox sender. It only delivers to the Resend account's own
// address, so it is a stop-gap until a domain is verified.
const RESEND_TEST_SENDER = 'onboarding@resend.dev';
// Resend's default limit is 2 requests per second per team.
const RESEND_MIN_GAP_MS = 550;
const RESEND_BATCH_SIZE = 100;
// A hung connection must not hang the request that is sending the email.
const RESEND_TIMEOUT_MS = 20000;
// Network errors and 5xx answers are retried this many times.
const RESEND_TRANSIENT_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** "Name <address>", with characters that would break the header removed. */
function formatFrom(name, address) {
  const cleanName = String(name || '').replace(/[<>"\r\n]/g, '').trim();
  return cleanName ? `${cleanName} <${address}>` : address;
}

/**
 * The provider to send with, or null when email is not set up.
 * { kind: 'resend' | 'smtp', source: 'settings' | 'env', from, ... }
 */
function resolve(email) {
  const fromName = email.fromName || 'LMS';
  const envKey = process.env.RESEND_API_KEY || '';
  const resend = (source, apiKey, address) => {
    const sender = address || RESEND_TEST_SENDER;
    return {
      kind: 'resend',
      source,
      apiKey,
      from: formatFrom(fromName, sender),
      fromAddress: sender,
      testSender: sender === RESEND_TEST_SENDER,
    };
  };

  if (email.enabled) {
    // A key saved in Settings wins; otherwise the one in server/.env.
    const settingsKey = email.resendApiKey || envKey;
    const provider = email.provider || (settingsKey ? 'resend' : 'smtp');
    if (provider === 'resend' && settingsKey) {
      return resend(email.resendApiKey ? 'settings' : 'env', settingsKey, email.fromEmail || process.env.RESEND_FROM);
    }
    if (provider === 'smtp' && email.smtpHost) {
      return {
        kind: 'smtp',
        source: 'settings',
        transport: {
          host: email.smtpHost,
          port: Number(email.smtpPort) || 587,
          secure: Boolean(email.smtpSecure),
          auth: { user: email.smtpUser, pass: email.smtpPass },
        },
        from: { name: fromName, address: email.fromEmail },
        fromAddress: email.fromEmail,
      };
    }
  }

  // "Send email" is off (or incomplete): server/.env only, like the SMTP fallback.
  if (envKey) return resend('env', envKey, process.env.RESEND_FROM || email.fromEmail);
  if (process.env.SMTP_HOST) {
    return {
      kind: 'smtp',
      source: 'env',
      transport: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      },
      from: { name: fromName, address: process.env.SMTP_FROM || email.fromEmail },
      fromAddress: process.env.SMTP_FROM || email.fromEmail,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ Resend */

let nextResendSlot = 0;

/** Spaces Resend requests out so a burst stays under the rate limit. */
async function resendSlot() {
  const now = Date.now();
  const at = Math.max(now, nextResendSlot);
  nextResendSlot = at + RESEND_MIN_GAP_MS;
  if (at > now) await sleep(at - now);
}

/** Turns a Resend error into something the admin can act on. */
function explainResend(status, data) {
  const detail = String(data?.message || data?.error || data?.name || `HTTP ${status}`);
  if (status === 401 || /api key is invalid|invalid api key|missing api key/i.test(detail)) {
    return 'Resend rejected the API key. Check it in Settings → Email, or RESEND_API_KEY in server/.env.';
  }
  if (/own email address|testing emails|domain is not verified|verify a domain|not verified/i.test(detail)) {
    return (
      `Resend: ${detail} Verify your domain in Resend (Domains → Add domain, then add the DNS records it ` +
      'shows), and set "From email" to an address on that domain.'
    );
  }
  return `Resend: ${detail}`;
}

/**
 * POSTs to Resend. Rate limits (429) are waited out; network failures,
 * timeouts and 5xx answers are retried a couple of times. Every attempt of one
 * call carries the same Idempotency-Key, so a retry after a lost response can
 * never send the email twice.
 */
async function resendPost(apiKey, path, body, attempt = 0, idempotencyKey = crypto.randomUUID()) {
  await resendSlot();
  const retryTransient = async (reason) => {
    if (attempt >= RESEND_TRANSIENT_RETRIES) throw new Error(reason);
    console.warn(`[mail] Resend attempt ${attempt + 1} failed (${reason}); retrying`);
    await sleep(1000 * 2 ** attempt);
    return resendPost(apiKey, path, body, attempt + 1, idempotencyKey);
  };

  let res;
  try {
    res = await fetch(`${RESEND_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'Resend did not answer in time' : `Could not reach Resend: ${err.message}`;
    return retryTransient(reason);
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1 + attempt) * 1000);
    return resendPost(apiKey, path, body, attempt + 1, idempotencyKey);
  }
  if (res.status >= 500) return retryTransient(explainResend(res.status, data));
  if (!res.ok) throw new Error(explainResend(res.status, data));
  return data;
}

const resendMessage = (config, { to, subject, text, html }) => ({
  from: config.from,
  to: [to],
  subject,
  ...(text ? { text } : {}),
  ...(html ? { html } : {}),
});

/* -------------------------------------------------------------- public API */

/** True when Resend or an SMTP server is configured one way or the other. */
async function isConfigured() {
  const { email } = await settingsService.get();
  return Boolean(resolve(email));
}

/** What the admin settings page shows about the current setup (no secrets). */
async function describe() {
  const { email } = await settingsService.get();
  const config = resolve(email);
  if (!config) return { configured: false };
  return {
    configured: true,
    provider: config.kind,
    source: config.source,
    fromAddress: config.fromAddress || '',
    testSender: Boolean(config.testSender),
  };
}

/**
 * Sends one message. Resolves { sent: boolean, provider?, error? } and never
 * throws, so a mail outage cannot fail the request that triggered the email.
 */
async function sendMail({ to, subject, text, html }) {
  const { email } = await settingsService.get();
  const config = resolve(email);

  if (!config) {
    console.log(`\n[mail] Email not configured — not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text}\n`);
    return { sent: false, error: 'Email is not configured' };
  }

  try {
    if (config.kind === 'resend') {
      await resendPost(config.apiKey, '/emails', resendMessage(config, { to, subject, text, html }));
    } else {
      const transporter = nodemailer.createTransport(config.transport);
      await transporter.sendMail({ from: config.from, to, subject, text, html });
    }
    return { sent: true, provider: config.kind };
  } catch (err) {
    console.error(`[mail] ${config.kind} send failed:`, err.message);
    return { sent: false, provider: config.kind, error: err.message };
  }
}

/**
 * Sends many messages (notification copies, task announcements). With Resend
 * they go out in batches of 100, so a notice to every learner is a handful of
 * requests rather than one per learner.
 *
 * Resolves { sent, failed, provider?, notConfigured?, error? } — `error` is
 * the first failure's reason, for the admin. Never throws.
 */
async function sendMany(messages) {
  if (!messages.length) return { sent: 0, failed: 0 };
  const { email } = await settingsService.get();
  const config = resolve(email);

  if (!config) {
    console.log(`[mail] Email not configured — ${messages.length} notification email(s) not sent.`);
    return { sent: 0, failed: messages.length, notConfigured: true, error: 'Email is not configured' };
  }

  if (config.kind === 'smtp') {
    const results = await Promise.allSettled(messages.map((message) => sendMail(message)));
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.sent).length;
    const error = results.find((r) => r.status === 'fulfilled' && !r.value.sent)?.value?.error;
    return { sent, failed: messages.length - sent, provider: 'smtp', ...(error ? { error } : {}) };
  }

  let sent = 0;
  let error;
  for (let i = 0; i < messages.length; i += RESEND_BATCH_SIZE) {
    const chunk = messages.slice(i, i + RESEND_BATCH_SIZE);
    try {
      await resendPost(config.apiKey, '/emails/batch', chunk.map((message) => resendMessage(config, message)));
      sent += chunk.length;
    } catch (err) {
      console.error(`[mail] resend batch of ${chunk.length} failed:`, err.message);
      error = error || err.message;
    }
  }
  return { sent, failed: messages.length - sent, provider: 'resend', ...(error ? { error } : {}) };
}

module.exports = { sendMail, sendMany, isConfigured, describe, RESEND_TEST_SENDER };
