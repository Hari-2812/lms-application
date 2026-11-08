const activity = require('../services/activityService');
const mailService = require('../services/mailService');
const settingsService = require('../services/settingsService');
const driveService = require('../services/googleDriveService');

const SECTION_LABELS = {
  branding: 'Branding',
  loginPage: 'Sign-in page',
  homepage: 'Homepage',
  integrations: 'Google Sheet',
  certificate: 'Certificate template',
  payments: 'Payment gateway',
  email: 'Email',
  notifications: 'Notifications',
  learning: 'Course access & completion rules',
};

/** GET /api/settings/public — branding and how to pay; no secrets. */
async function getPublic(_req, res, next) {
  try {
    res.json(settingsService.forPublic(await settingsService.get()));
  } catch (err) {
    next(err);
  }
}

/** The settings form's payload, plus the address the admin shares the Google Sheet with. */
async function adminPayload(settings) {
  return {
    settings: settingsService.forAdmin(settings),
    emailConfigured: await mailService.isConfigured(),
    // Which provider is live and where its key came from — never the key itself.
    emailStatus: await mailService.describe(),
    serviceAccountEmail: driveService.getConfigSummary().clientEmail || null,
  };
}

/** GET /api/admin/settings */
async function getAdmin(_req, res, next) {
  try {
    res.json(await adminPayload(await settingsService.get()));
  } catch (err) {
    next(err);
  }
}

/** Human-readable list of what changed, for the activity log. */
function describeChanges(before, after, sections) {
  const changes = [];
  for (const section of sections) {
    const was = before[section] || {};
    const now = after[section] || {};
    for (const key of Object.keys(now)) {
      if (typeof now[key] === 'object') {
        for (const inner of Object.keys(now[key] || {})) {
          if (now[key][inner] !== was[key]?.[inner]) changes.push(`${section}.${key}.${inner}`);
        }
      } else if (now[key] !== was[key]) {
        // Never write a secret's value into the log — only that it changed.
        changes.push(`${section}.${key}`);
      }
    }
  }
  return changes;
}

/** PUT /api/admin/settings  body: any subset of the settings sections */
async function updateAdmin(req, res, next) {
  try {
    const before = JSON.parse(JSON.stringify(await settingsService.get()));
    const { settings, changedSections } = await settingsService.update(req.body || {}, req.user._id);
    const changes = describeChanges(before, settings, changedSections);

    if (changes.length) {
      const sectionNames = [...new Set(changes.map((c) => SECTION_LABELS[c.split('.')[0]]))].join(', ');
      await activity.log(req, {
        category: 'settings',
        action: 'settings.updated',
        summary: `Updated settings: ${sectionNames} (${changes.length} change${changes.length === 1 ? '' : 's'})`,
        entityType: 'settings',
        meta: { changes },
      });
    }

    res.json(await adminPayload(settings));
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/settings/test-email — sends a test message to the signed-in admin. */
async function sendTestEmail(req, res, next) {
  try {
    const { branding } = await settingsService.get();
    const status = await mailService.describe();
    const via = status.provider === 'resend' ? 'Resend' : 'SMTP';
    const result = await mailService.sendMail({
      to: req.user.email,
      subject: `${branding.platformName}: test email`,
      text: `Your email settings work — this message was sent from the admin panel via ${via}.`,
    });
    if (!result.sent) return res.status(400).json({ error: `Not sent: ${result.error}` });
    res.json({ success: true, message: `Test email sent to ${req.user.email} via ${via}.` });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublic, getAdmin, updateAdmin, sendTestEmail };
