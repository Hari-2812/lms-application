const Setting = require('../models/Setting');

/**
 * Platform settings: branding, payment gateway, email, notification switches
 * and the learning rules (lesson completion, certificate eligibility, access
 * duration).
 *
 * Stored as one document and cached in memory — progress saves read the
 * learning rules on every call, so this must not cost a query each time.
 * The cache is replaced on every update, and this is a single-process server,
 * so it can never be stale for longer than one write.
 */

const KEY = 'platform';

/** Every setting and its default. A stored document is merged over this. */
const DEFAULTS = {
  branding: {
    platformName: 'AnalyticsAvenue',
    tagline: 'EduTech',
    logoUrl: '',
    supportEmail: '',
  },
  // Fixed text on the certificate template. The learner name, course name and
  // month/year are filled in per certificate.
  certificate: {
    companyName: 'Analytics Avenue',
    tagline: 'Building Smarter Teams with AI and L&D',
    title: 'Course Completion Certificate',
    issuerName: 'Subramani',
    issuerTitle: 'Data Scientist',
    issuerRole: 'Chief Data Scientist Mentor',
  },
  payments: {
    // 'manual' — the learner pays by UPI / bank transfer and an admin marks it paid.
    // 'razorpay' — Razorpay Checkout; a verified payment enrols the learner automatically.
    gateway: 'manual',
    currency: 'INR',
    autoEnrolOnSuccess: true,
    razorpayKeyId: '',
    razorpayKeySecret: '',
    razorpayWebhookSecret: '',
    upiId: '',
    bankDetails: '',
    instructions: '',
  },
  email: {
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromName: 'AnalyticsAvenue',
    fromEmail: '',
    // Also email a copy of in-app notifications, not just password resets.
    notificationCopies: false,
  },
  notifications: {
    admin: {
      learnerRegistered: true,
      paymentReceived: true,
      paymentPending: true,
      paymentFailed: true,
      taskSubmitted: true,
      learnerEnrolled: true,
      certificateIssued: true,
    },
    learner: {
      newCourse: true,
      newTask: true,
      taskReviewed: true,
      newEvent: true,
      paymentConfirmed: true,
      certificateReady: true,
    },
  },
  learning: {
    // Share of a lesson video that has to be watched for it to count as complete.
    lessonCompletePercent: 90,
    // Share of a course's lessons that has to be complete to finish the course
    // and earn its certificate.
    certificateCompletionPercent: 100,
    // When on, a course certificate also needs an accepted task submission
    // for that course.
    requireAcceptedTask: false,
    // 0 = lifetime access; otherwise access ends this many days after enrolment.
    accessDurationDays: 0,
    // When off, enrolling in a free course waits for an admin like a paid one.
    freeCourseSelfEnrol: true,
  },
};

/** Fields never sent to the browser in clear; the admin sees `hasX` flags instead. */
const SECRET_FIELDS = {
  payments: ['razorpayKeySecret', 'razorpayWebhookSecret'],
  email: ['smtpPass'],
};

let cache = null;

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

/** Defaults with stored values laid over them, one level of sections deep (two for notifications). */
function merge(defaults, stored = {}) {
  const out = {};
  for (const [key, value] of Object.entries(defaults)) {
    const incoming = stored?.[key];
    if (isPlainObject(value)) out[key] = merge(value, isPlainObject(incoming) ? incoming : {});
    else out[key] = incoming === undefined ? value : incoming;
  }
  return out;
}

/** Coerces an incoming value to the type of its default; returns undefined to reject it. */
function coerce(defaultValue, value) {
  if (typeof defaultValue === 'boolean') return Boolean(value);
  if (typeof defaultValue === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof defaultValue === 'string') return String(value ?? '').trim().slice(0, 2000);
  return undefined;
}

/** Only known keys, coerced to the right type — never spread a request body into settings. */
function sanitizePatch(defaults, patch) {
  const out = {};
  if (!isPlainObject(patch)) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) continue;
    if (isPlainObject(defaults[key])) {
      const nested = sanitizePatch(defaults[key], value);
      if (Object.keys(nested).length) out[key] = nested;
    } else {
      const coerced = coerce(defaults[key], value);
      if (coerced !== undefined) out[key] = coerced;
    }
  }
  return out;
}

/** Range checks that keep the learning rules meaningful. */
function clampLearning(learning) {
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(n)));
  learning.lessonCompletePercent = clamp(learning.lessonCompletePercent, 10, 100);
  learning.certificateCompletionPercent = clamp(learning.certificateCompletionPercent, 1, 100);
  learning.accessDurationDays = clamp(learning.accessDurationDays, 0, 3650);
  return learning;
}

async function get() {
  if (cache) return cache;
  const doc = await Setting.findOne({ key: KEY }).lean();
  cache = merge(DEFAULTS, doc?.data);
  return cache;
}

/**
 * Applies a partial update. A secret sent as an empty string is left as it
 * was — the form never receives secrets, so "blank" means "unchanged".
 * Returns { settings, changedSections }.
 */
async function update(patch, userId) {
  const current = await get();
  const clean = sanitizePatch(DEFAULTS, patch);

  for (const [section, fields] of Object.entries(SECRET_FIELDS)) {
    for (const field of fields) {
      if (clean[section] && clean[section][field] === '') delete clean[section][field];
    }
  }

  const next = merge(DEFAULTS, merge(current, clean));
  next.learning = clampLearning(next.learning);
  if (!['manual', 'razorpay'].includes(next.payments.gateway)) next.payments.gateway = 'manual';

  await Setting.findOneAndUpdate(
    { key: KEY },
    { key: KEY, data: next, updatedBy: userId },
    { upsert: true, new: true }
  );
  cache = next;

  return { settings: next, changedSections: Object.keys(clean) };
}

/** Settings as the admin form sees them: secrets replaced by "is it set" flags. */
function forAdmin(settings) {
  const copy = JSON.parse(JSON.stringify(settings));
  for (const [section, fields] of Object.entries(SECRET_FIELDS)) {
    for (const field of fields) {
      copy[section][`has${field[0].toUpperCase()}${field.slice(1)}`] = Boolean(copy[section][field]);
      copy[section][field] = '';
    }
  }
  return copy;
}

/** What any visitor may read: branding, and how to pay. */
function forPublic(settings) {
  const { payments } = settings;
  const razorpayReady =
    payments.gateway === 'razorpay' && Boolean(payments.razorpayKeyId && payments.razorpayKeySecret);
  return {
    branding: settings.branding,
    certificate: settings.certificate,
    payments: {
      gateway: razorpayReady ? 'razorpay' : 'manual',
      currency: payments.currency,
      razorpayKeyId: razorpayReady ? payments.razorpayKeyId : '',
      upiId: payments.upiId,
      bankDetails: payments.bankDetails,
      instructions: payments.instructions,
    },
    learning: {
      certificateCompletionPercent: settings.learning.certificateCompletionPercent,
      accessDurationDays: settings.learning.accessDurationDays,
    },
  };
}

/** True unless the admin switched this notification off in Settings. */
async function isNotificationEnabled(audience, key) {
  if (!audience || !key) return true;
  const settings = await get();
  return settings.notifications?.[audience]?.[key] !== false;
}

module.exports = { get, update, forAdmin, forPublic, isNotificationEnabled, DEFAULTS };
