const User = require('../models/User');
const settingsService = require('./settingsService');
const mailService = require('./mailService');
const { appUrl } = require('../utils/url');

/**
 * The email channel for published tasks.
 *
 * Publishing a task ("Publish now and notify learners") notifies the assigned
 * learners twice, through independent channels:
 *   - in the app: a bell notification, stored and pushed live, and waiting
 *     for them the next time they sign in (notificationService);
 *   - by email: this file, so learners who are signed out hear about it too.
 *
 * Email is on by default (Settings → Email → "Email learners when a task is
 * published") and needs a working provider (Resend or SMTP). Each send is
 * logged with its counts, and the result goes back to the admin.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The server runs in UTC on Render; learners read times in Indian time.
const TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const MAX_INSTRUCTIONS = 1500;

/** "14 Nov 2026, 6:00 pm IST" — or '' when there is no due date. */
function formatDue(date) {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMessage({ to, name, platformName, title, courseTitle, due, maxScore, instructions, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const details = [
    ['Task', title],
    courseTitle ? ['Course', courseTitle] : null,
    due ? ['Due', due] : null,
    maxScore ? ['Max score', String(maxScore)] : null,
  ].filter(Boolean);

  const text = [
    greeting,
    '',
    `A new task has been assigned to you on ${platformName}.`,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(instructions ? ['', 'Instructions:', instructions] : []),
    '',
    'Open the task and submit your work here:',
    link,
    '',
    `You are receiving this because you are a learner on ${platformName}.`,
  ].join('\n');

  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;color:#0f172a;font-weight:600">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1e293b;max-width:560px">` +
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>A new task has been assigned to you on <strong>${escapeHtml(platformName)}</strong>.</p>` +
    `<table role="presentation" style="border-collapse:collapse;margin:12px 0">${rows}</table>` +
    (instructions
      ? `<p style="margin:16px 0 4px;color:#64748b">Instructions</p>` +
        `<div style="white-space:pre-wrap;border-left:3px solid #e2e8f0;padding-left:12px">${escapeHtml(instructions)}</div>`
      : '') +
    `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 20px;` +
    `background:#2450eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Open the task</a></p>` +
    `<p style="color:#64748b;font-size:13px">If the button does not work, open ${escapeHtml(link)}<br>` +
    `You are receiving this because you are a learner on ${escapeHtml(platformName)}.</p>` +
    `</div>`;

  return { to, subject: `New task: ${title}`, text, html };
}

/**
 * Emails a newly published task to its learners.
 *
 * Resolves a delivery summary, never throws:
 *   { status, attempted, sent, failed, skipped, error? }
 *   status: 'sent' | 'partial' | 'failed' | 'not_configured' | 'disabled' | 'no_recipients'
 *   skipped: recipients with no usable address (suspended, or a malformed email)
 */
async function emailNewTask(assignment, { course, recipientIds }) {
  const summary = { status: 'no_recipients', attempted: 0, sent: 0, failed: 0, skipped: 0 };
  try {
    const { email: emailSettings, branding } = await settingsService.get();
    if (emailSettings.taskEmails === false) return { ...summary, status: 'disabled' };
    if (!recipientIds?.length) return summary;

    const users = await User.find({ _id: { $in: recipientIds }, status: { $ne: 'suspended' } }).select('name email');
    const reachable = users.filter((u) => EMAIL_PATTERN.test(String(u.email || '').trim()));
    summary.skipped = recipientIds.length - reachable.length;
    if (!reachable.length) return summary;

    const instructions = String(assignment.description || '').trim();
    const shared = {
      platformName: branding.platformName || 'AnalyticsAvenue',
      title: assignment.title,
      courseTitle: course?.title || '',
      due: formatDue(assignment.dueDate),
      maxScore: assignment.maxScore,
      instructions: instructions.length > MAX_INSTRUCTIONS ? `${instructions.slice(0, MAX_INSTRUCTIONS)}…` : instructions,
      // Signed-out learners land on the sign-in page and come back here after.
      link: `${appUrl()}/tasks`,
    };
    const messages = reachable.map((user) => buildMessage({ ...shared, to: user.email.trim(), name: user.name }));

    const result = await mailService.sendMany(messages);
    summary.attempted = messages.length;
    summary.sent = result.sent;
    summary.failed = result.failed;
    if (result.error) summary.error = result.error;
    summary.status = result.notConfigured
      ? 'not_configured'
      : result.failed === 0
        ? 'sent'
        : result.sent > 0
          ? 'partial'
          : 'failed';

    console.log(
      `[task-email] "${assignment.title}": ${summary.sent} sent, ${summary.failed} failed, ` +
        `${summary.skipped} without a usable address${summary.error ? ` — ${summary.error}` : ''}`
    );
    return summary;
  } catch (err) {
    console.error('[task-email] failed:', err.message);
    return { ...summary, status: 'failed', error: err.message };
  }
}

/** One line for the admin and the activity log. */
function describeDelivery(summary) {
  if (!summary) return '';
  switch (summary.status) {
    case 'sent':
      return `emailed ${summary.sent} learner${summary.sent === 1 ? '' : 's'}`;
    case 'partial':
      return `emailed ${summary.sent}, ${summary.failed} email${summary.failed === 1 ? '' : 's'} failed`;
    case 'failed':
      return 'emails could not be sent';
    case 'not_configured':
      return 'no emails sent (email is not set up)';
    case 'disabled':
      return 'task emails are switched off';
    default:
      return '';
  }
}

module.exports = { emailNewTask, describeDelivery, formatDue };
