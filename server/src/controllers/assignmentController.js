const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const Submission = require('../models/Submission');
const activity = require('../services/activityService');
const { grantedCourseIds, learnerIdsWithAccess } = require('../services/enrolmentService');
const { notifyUsers, activeLearnerIds } = require('../services/notificationService');

/**
 * Assignments: tasks with a due date that the admin sets and learners hand
 * work in against. Publishing one notifies the learners it is for — that
 * course's enrolled learners, or everyone when it has no course.
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

const dueText = (date) =>
  date
    ? new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

async function announce(assignment) {
  // Course grants plus Full Access; suspended learners are filtered out either way.
  const recipients = assignment.courseId
    ? await learnerIdsWithAccess(assignment.courseId)
    : await activeLearnerIds();

  const course = assignment.courseId ? await Course.findById(assignment.courseId).select('title') : null;
  await notifyUsers(
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
    { setting: 'learner.newTask' }
  );
  return recipients.length;
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

    res.json(
      assignments.map((a) => ({
        ...a.toJSON(),
        submissionCount: countBy.get(String(a._id))?.total || 0,
        awaitingReview: countBy.get(String(a._id))?.awaiting || 0,
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
    const notified = assignment.published ? await announce(assignment) : 0;

    await activity.log(req, {
      category: 'task',
      action: 'task.created',
      summary: `Created task "${assignment.title}"${assignment.dueDate ? ` due ${dueText(assignment.dueDate)}` : ''}${
        assignment.published ? ` and notified ${notified} learner${notified === 1 ? '' : 's'}` : ' as a draft'
      }`,
      entityType: 'assignment',
      entityId: assignment._id,
    });

    res.status(201).json({ ...assignment.toJSON(), notified });
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

    let notified = 0;
    if (!before.published && assignment.published) notified = await announce(assignment);

    await activity.log(req, {
      category: 'task',
      action: 'task.updated',
      summary: `Updated task "${assignment.title}"${notified ? ` and published it to ${notified} learners` : ''}`,
      entityType: 'assignment',
      entityId: assignment._id,
    });

    res.json({ ...assignment.toJSON(), notified });
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
