const mongoose = require('mongoose');
const Enquiry = require('../models/Enquiry');
const settingsService = require('../services/settingsService');
const sheets = require('../services/googleSheetsService');
const { notifyAdmins } = require('../services/notificationService');

/**
 * The homepage "Enroll Now" form.
 *
 * Every response is saved to MongoDB first and then appended to the Google
 * Sheet in Settings → Google Sheet. A failed copy never loses the response:
 * it is marked `failed` with the reason, and staff can retry it from
 * Admin → Enquiries once the sheet is fixed.
 */

/**
 * Column order in the sheet. Changing it only affects rows written afterwards,
 * so new columns go on the end: a sheet that already has a header row keeps
 * its existing columns lined up.
 */
const SHEET_HEADERS = [
  'Submitted at', 'Name', 'Email', 'Phone', 'Program', 'Location', 'Profile summary', 'Source', 'Enquiry ID',
  'Status', 'Designation', 'Alternate number',
];

/** What the homepage form enrols people for; used when the form sends none. */
const DEFAULT_PROGRAM = 'Nationwide Gen AI Program';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* --- a small per-IP limit, so the public form cannot be used to flood the sheet --- */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

/**
 * The visitor's address for rate limiting. Behind a hosting proxy req.ip is
 * the proxy's, which would make every visitor share one limit, so the first
 * X-Forwarded-For entry is used when present. A spoofed header only gets
 * around this light anti-spam limit; it is not trusted for anything else.
 */
function clientKey(req) {
  const forwarded = String(req.get('x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || req.ip || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  // Keep the map from growing without bound on a busy day.
  if (recent.size > 5000) {
    for (const [key, times] of recent) if (!times.some((t) => now - t < WINDOW_MS)) recent.delete(key);
  }
  return false;
}

const sheetRow = (enquiry) => [
  new Date(enquiry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
  enquiry.name,
  enquiry.email,
  enquiry.phone,
  enquiry.program,
  enquiry.city,
  enquiry.message,
  enquiry.source,
  String(enquiry._id),
  enquiry.careerStatus,
  enquiry.designation,
  enquiry.alternatePhone,
];

/** Copies one enquiry to the sheet and records how it went. Never throws. */
async function syncToSheet(enquiry) {
  try {
    const { integrations } = await settingsService.get();
    if (!integrations.googleSheetEnabled) {
      enquiry.sheetStatus = 'skipped';
      enquiry.sheetError = 'Google Sheet sync is switched off in Settings.';
    } else if (!integrations.googleSheetWebAppUrl) {
      enquiry.sheetStatus = 'skipped';
      enquiry.sheetError = 'No Apps Script web app URL is set in Settings → Google Sheet.';
    } else {
      await sheets.appendRow(integrations, SHEET_HEADERS, sheetRow(enquiry));
      enquiry.sheetStatus = 'synced';
      enquiry.sheetError = '';
      enquiry.sheetSyncedAt = new Date();
    }
  } catch (err) {
    console.error('[enquiry] sheet sync failed:', err.message);
    enquiry.sheetStatus = 'failed';
    enquiry.sheetError = String(err.message || 'Unknown error').slice(0, 500);
  }
  await enquiry.save().catch((err) => console.error('[enquiry] could not record sync result:', err.message));
  return enquiry;
}

/** Validates the public form. Returns { fields } or { error }. */
function readForm(body = {}) {
  const text = (key, max) => String(body[key] ?? '').trim().slice(0, max);
  const fields = {
    name: text('name', 80),
    email: text('email', 120).toLowerCase(),
    phone: text('phone', 20),
    program: text('program', 120) || DEFAULT_PROGRAM,
    city: text('city', 80),
    message: text('message', 1000),
    careerStatus: text('careerStatus', 60),
    designation: text('designation', 100),
    alternatePhone: text('alternatePhone', 20),
  };
  const validPhone = (value) => PHONE.test(value) && value.replace(/\D/g, '').length >= 7;

  if (fields.name.length < 2) return { error: 'Enter your full name.' };
  if (!EMAIL.test(fields.email)) return { error: 'Enter a valid email address.' };
  if (!validPhone(fields.phone)) return { error: 'Enter a valid phone number.' };
  if (!Enquiry.CAREER_STATUSES.includes(fields.careerStatus)) return { error: 'Select your current status.' };
  if (fields.city.length < 2) return { error: 'Enter your location.' };
  if (!validPhone(fields.alternatePhone)) return { error: 'Enter a valid alternate number.' };
  if (fields.message.length < 3) return { error: 'Add a brief profile summary.' };
  return { fields };
}

/** POST /api/enquiries — public. */
async function create(req, res, next) {
  try {
    // Bots fill every field; people never see this one.
    if (String(req.body?.website || '').trim()) return res.status(201).json({ success: true });

    if (rateLimited(clientKey(req))) {
      return res.status(429).json({ error: 'Too many enquiries from this connection. Please try again in a few minutes.' });
    }

    const { fields, error } = readForm(req.body);
    if (error) return res.status(400).json({ error });

    const enquiry = await Enquiry.create({ ...fields, source: 'homepage', userId: req.user?._id });

    // Answer the visitor straight away; the sheet copy and the admin bell follow.
    res.status(201).json({ success: true, id: enquiry._id });

    await syncToSheet(enquiry);
    await notifyAdmins(
      {
        type: 'enquiry',
        title: 'New enrolment enquiry',
        message: `${enquiry.name} (${enquiry.phone}) asked about ${enquiry.program || 'the programs'}.`,
        link: '/admin/enquiries',
      },
      { setting: 'admin.newEnquiry' }
    ).catch((err) => console.error('[enquiry] admin notification failed:', err.message));
  } catch (err) {
    if (res.headersSent) console.error('[enquiry] after response:', err.message);
    else next(err);
  }
}

/* ---------------------------------------------------------------- admin */

/** GET /api/admin/enquiries?search=&sheet=&from=&to= */
async function listAll(req, res, next) {
  try {
    const { search, sheet, from, to } = req.query;
    const filter = {};
    if (Enquiry.SHEET_STATUSES.includes(sheet)) filter.sheetStatus = sheet;
    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [
        { name: pattern },
        { email: pattern },
        { phone: pattern },
        { alternatePhone: pattern },
        { program: pattern },
        { city: pattern },
        { careerStatus: pattern },
        { designation: pattern },
      ];
    }
    const range = {};
    if (from && !Number.isNaN(new Date(from).getTime())) range.$gte = new Date(from);
    if (to && !Number.isNaN(new Date(to).getTime())) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    if (Object.keys(range).length) filter.createdAt = range;

    const [enquiries, counts] = await Promise.all([
      Enquiry.find(filter).sort({ createdAt: -1 }).limit(1000),
      Enquiry.aggregate([{ $group: { _id: '$sheetStatus', count: { $sum: 1 } } }]),
    ]);
    const byStatus = Object.fromEntries(Enquiry.SHEET_STATUSES.map((s) => [s, 0]));
    for (const row of counts) byStatus[row._id] = row.count;

    res.json({ enquiries, summary: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/enquiries/:id/sync — retry one. */
async function resync(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Enquiry not found' });
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
    if (enquiry.sheetStatus === 'synced') return res.json(enquiry);

    await syncToSheet(enquiry);
    if (enquiry.sheetStatus === 'failed') return res.status(502).json({ error: enquiry.sheetError, enquiry });
    res.json(enquiry);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/enquiries/sync — retry every enquiry not yet in the sheet, oldest first. */
async function resyncAll(_req, res, next) {
  try {
    const pending = await Enquiry.find({ sheetStatus: { $in: ['pending', 'failed', 'skipped'] } }).sort({ createdAt: 1 }).limit(200);
    let synced = 0;
    for (const enquiry of pending) {
      await syncToSheet(enquiry);
      if (enquiry.sheetStatus === 'synced') synced += 1;
      // One failure (sheet unshared, API off) will fail the rest the same way.
      else if (enquiry.sheetStatus === 'failed') {
        return res.status(502).json({ error: enquiry.sheetError, synced, remaining: pending.length - synced });
      } else break;
    }
    res.json({ success: true, synced, remaining: pending.length - synced });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/integrations/google-sheet/test — checks the sheet is writable and adds the header row. */
async function testSheet(_req, res, next) {
  try {
    const { integrations } = await settingsService.get();
    const result = await sheets.testConnection(integrations, SHEET_HEADERS);
    res.json({
      success: true,
      ...result,
      message: `Connected to "${result.title}" → tab "${result.tab}".${result.headerWritten ? ' Column headings were added.' : ''}`,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/enquiries/options — public; the form's Status dropdown. */
function options(_req, res) {
  res.json({ careerStatuses: Enquiry.CAREER_STATUSES, program: DEFAULT_PROGRAM });
}

module.exports = { create, options, listAll, resync, resyncAll, testSheet, SHEET_HEADERS };
