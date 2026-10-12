const Event = require('../models/Event');
const CourseAccess = require('../models/CourseAccess');
const { sanitizeHtml } = require('../utils/sanitizeHtml');
const { notifyUsers } = require('../services/notificationService');
const User = require('../models/User');

/** Fields the admin dashboard may set on an event. */
function buildFields(body = {}) {
  const fields = {};

  for (const key of ['title', 'summary', 'location', 'joinUrl', 'host']) {
    if (body[key] !== undefined) fields[key] = String(body[key]).trim();
  }

  if (body.type !== undefined) fields.type = String(body.type);
  if (body.published !== undefined) fields.published = Boolean(body.published);

  if (body.descriptionHtml !== undefined) {
    fields.descriptionHtml = sanitizeHtml(String(body.descriptionHtml));
  }

  for (const key of ['startsAt', 'endsAt']) {
    if (body[key] === undefined) continue;
    if (!body[key]) {
      fields[key] = null;
      continue;
    }
    const date = new Date(body[key]);
    if (!Number.isNaN(date.getTime())) fields[key] = date;
  }

  // Empty string means "not tied to a course"; undefined means "leave alone".
  if (body.courseId !== undefined) fields.courseId = body.courseId || null;

  return fields;
}

/**
 * The joining link is withheld until the event is near, so a link posted
 * weeks ahead cannot circulate before it is meant to.
 */
const JOIN_WINDOW_MS = 24 * 60 * 60 * 1000;

function forStudent(event) {
  const json = event.toJSON();
  const startsAt = new Date(json.startsAt).getTime();
  const withinWindow = startsAt - Date.now() <= JOIN_WINDOW_MS;

  if (!withinWindow) {
    delete json.joinUrl;
    json.joinUrlAvailableAt = new Date(startsAt - JOIN_WINDOW_MS);
  }
  return json;
}

/**
 * GET /api/events?scope=upcoming|past|all
 * Public: the events list is part of the marketing surface.
 */
async function listEvents(req, res, next) {
  try {
    const scope = req.query.scope || 'upcoming';
    const now = new Date();

    const filter = { published: true };
    let sort = { startsAt: 1 };

    if (scope === 'upcoming') {
      // An event that has started but not finished still counts as current.
      filter.$or = [{ startsAt: { $gte: now } }, { endsAt: { $gte: now } }];
    } else if (scope === 'past') {
      filter.startsAt = { $lt: now };
      sort = { startsAt: -1 };
    }

    const events = await Event.find(filter).sort(sort).limit(100);
    res.json(events.map(forStudent));
  } catch (err) {
    next(err);
  }
}

/** GET /api/events/:id */
async function getEvent(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || !event.published) return res.status(404).json({ error: 'Event not found' });
    res.json(forStudent(event));
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------------------------------------- admin */

/** GET /api/admin/events — includes drafts and full join links. */
async function listAllEvents(_req, res, next) {
  try {
    const events = await Event.find().sort({ startsAt: -1 }).limit(200);
    res.json(events);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/events */
async function createEvent(req, res, next) {
  try {
    const fields = buildFields(req.body);
    if (!fields.title) return res.status(400).json({ error: 'title is required' });
    if (!fields.startsAt) return res.status(400).json({ error: 'A valid start date/time is required' });

    const event = await Event.create({ ...fields, createdBy: req.user._id });

    // Announce it, either to one course's students or to everyone.
    if (req.body?.notifyStudents && event.published) {
      const recipients = event.courseId
        ? (await CourseAccess.find({ courseId: event.courseId, active: true }).select('studentId')).map(
            (g) => g.studentId
          )
        : (await User.find({ role: { $ne: 'admin' } }).select('_id')).map((u) => u._id);

      await notifyUsers(recipients, {
        type: 'event',
        title: 'Upcoming event',
        message: `${event.title} — ${new Date(event.startsAt).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`,
        courseId: event.courseId || undefined,
        link: '/events',
      });
    }

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/admin/events/:id */
async function updateEvent(req, res, next) {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, buildFields(req.body), {
      new: true,
      runValidators: true,
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/events/:id */
async function deleteEvent(req, res, next) {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEvents,
  getEvent,
  listAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
