const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const Submission = require('../models/Submission');
const activity = require('../services/activityService');
const { grantedCourseIds, learnerIdsWithAccess } = require('../services/enrolmentService');
const { notifyUsers, activeLearnerIds } = require('../services/notificationService');
const { emailNewTask, describeDelivery, formatDue } = require('../services/taskEmailService');

/**
 * Assignments: tasks with a due date that the admin sets and learners hand
 * work in against. Publishing one notifies the learners it is for — that
 * course's enrolled learners, or everyone when it has no course — in the app
 * and by email, as two separate channels (see taskEmailService).
 */

function buildFields(body = {}) {
  const fields = {};
  if (body.title !== undefined) fields.title = String(body.title).trim().slice(0, 160);
  if (body.description !== undefined) fields.description = String(body.description).trim().slice(0, 4000);
  if (body.courseId !== undefined) fields.courseId = body.courseId || null;
  if (body.published !== undefined) fields.published = Boolean(body.published);
  if (body.maxScore !== undefined && body.maxScore !== '') {
    const max = Number(body.maxScore);
    if (Number.isFinite(max) && max >= 1 && max <= 1000) fields.maxScore = Math.round(max);
  }
  if (body.dueDate !== undefined) {
    if (!body.dueDate) fields.dueDate = null;
    else {
      const date = new Date(body.dueDate);
      if (!Number.isNaN(date.getTime())) fields.dueDate = date;
    }
  }
  return fields;
}

// In Indian time, not the server's (UTC on Render): "14 Nov 2026, 6:00 pm IST".
const dueText = formatDue;

/**
 * Tells a newly published task's learners about it, through both channels.
 * Returns { notified, email } — how many in-app notifications were created,
 * and the email delivery summary.
 */
async function announce(assignment) {
  // Course grants plus Full Access; suspended learners are filtered out either way.
  const recipients = assignment.courseId
    ? await learnerIdsWithAccess(assignment.courseId)
    : await activeLearnerIds();

  const course = assignment.courseId ? await Course.findById(assignment.courseId).select('title') : null;

  // In-app: stored, pushed to anyone online, and there at their next sign-in.
  const inApp = await notifyUsers(
    recipients,
    {
      type: 'task',
      title: 'New task assigned',
      message:
        `"${assignment.title}"${course ? ` for ${course.title}` : ''}` +
        (assignment.dueDate ? ` — due ${dueText(assignment.dueDate)}.` : '.'),
      courseId: assignment.courseId || undefined,
      link: '/tasks',
    },
    // The dedicated task email below replaces the generic email copy.
    { setting: 'learner.newTask', emailCopy: false }
  );

  // Email: its own channel, so it reaches learners who are signed out.
  const email = await emailNewTask(assignment, { course, recipientIds: recipients });

  return { notified: inApp.length, email };
}

/** "and notified 12 learners in the app, emailed 12 learners" for the activity log. */
function announcementSummary({ notified, email }) {
  const parts = [`notified ${notified} learner${notified === 1 ? '' : 's'} in the app`];
  const delivery = describeDelivery(email);
  if (delivery) parts.push(delivery);
  return parts.join(', ');
}

/* -------------------------------------------------------------- learner */

/** GET /api/assignments — open assignments for the courses this learner has. */
async function listForLearner(req, res, next) {
  try {
    // Full Access learners get every course's tasks.
    const filter = { published: true };
    if (!req.user.fullAccess) {
      const courseIds = await grantedCourseIds(req.user._id);
      filter.$or = [{ courseId: null }, { courseId: { $exists: false } }, { courseId: { $in: courseIds } }];
    }

    const assignments = await Assignment.find(filter)
      .populate('courseId', 'title')
      .sort({ dueDate: 1, createdAt: -1 });

    const mine = await Submission.find({
      studentId: req.user._id,
      assignmentId: { $in: assignments.map((a) => a._id) },
    }).select('assignmentId status score createdAt');
    const latest = new Map();
    for (const s of mine) {
      const key = String(s.assignmentId);
      if (!latest.has(key) || s.createdAt > latest.get(key).createdAt) latest.set(key, s);
    }

    res.json(
      assignments.map((a) => {
        const submission = latest.get(String(a._id));
        return {
          ...a.toJSON(),
          mySubmission: submission ? { status: submission.status, score: submission.score } : null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------------------------------------- admin */

/** GET /api/admin/assignments */
async function listAll(_req, res, next) {
  try {
    const [assignments, counts] = await Promise.all([
      Assignment.find().populate('courseId', 'title').sort({ createdAt: -1 }).limit(300),
      Submission.aggregate([
        { $match: { assignmentId: { $ne: null } } },
        {
          $group: {
            _id: '$assignmentId',
            total: { $sum: 1 },
            awaiting: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review']] }, 1, 0] } },
          },
        },
      ]),
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c]));

    // How many learners each task reaches: that course's enrolled learners
    // (plus Full Access), or everyone for a task with no course.
    const courseKeys = [...new Set(assignments.map((a) => String(a.courseId?._id || '')))];
    const audienceBy = new Map(
      await Promise.all(
        courseKeys.map(async (key) => [key, (key ? await learnerIdsWithAccess(key) : await activeLearnerIds()).length])
      )
    );

    res.json(
      assignments.map((a) => ({
        ...a.toJSON(),
        submissionCount: countBy.get(String(a._id))?.total || 0,
        awaitingReview: countBy.get(String(a._id))?.awaiting || 0,
        audienceCount: audienceBy.get(String(a.courseId?._id || '')) ?? 0,
      }))
    );
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/assignments  body: { title, description, courseId?, dueDate?, maxScore?, published? } */
async function create(req, res, next) {
  try {
    const fields = buildFields(req.body);
    if (!fields.title) return res.status(400).json({ error: 'Give the task a title' });

    const assignment = await Assignment.create({ published: true, ...fields, createdBy: req.user._id });
    const announced = assignment.published ? await announce(assignment) : null;

    await activity.log(req, {
      category: 'task',
      action: 'task.created',
      summary: `Created task "${assignment.title}"${assignment.dueDate ? ` due ${dueText(assignment.dueDate)}` : ''}${
        announced ? ` and ${announcementSummary(announced)}` : ' as a draft'
      }`,
      entityType: 'assignment',
      entityId: assignment._id,
      ...(announced ? { meta: { email: announced.email } } : {}),
    });

    res.status(201).json({ ...assignment.toJSON(), notified: announced?.notified || 0, email: announced?.email || null });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/admin/assignments/:id — publishing a draft announces it. */
async function update(req, res, next) {
  try {
    const before = await Assignment.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Task not found' });

    const assignment = await Assignment.findByIdAndUpdate(req.params.id, buildFields(req.body), {
      new: true,
      runValidators: true,
    });

    const announced = !before.published && assignment.published ? await announce(assignment) : null;

    await activity.log(req, {
      category: 'task',
      action: 'task.updated',
      summary: `Updated task "${assignment.title}"${announced ? ` and published it: ${announcementSummary(announced)}` : ''}`,
      entityType: 'assignment',
      entityId: assignment._id,
      ...(announced ? { meta: { email: announced.email } } : {}),
    });

    res.json({ ...assignment.toJSON(), notified: announced?.notified || 0, email: announced?.email || null });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/assignments/:id — submissions keep their content, lose the link. */
async function remove(req, res, next) {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Task not found' });
    await Submission.updateMany({ assignmentId: assignment._id }, { $unset: { assignmentId: 1 } });

    await activity.log(req, {
      category: 'task',
      action: 'task.deleted',
      summary: `Deleted task "${assignment.title}"`,
      entityType: 'assignment',
      entityId: assignment._id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listForLearner, listAll, create, update, remove };
