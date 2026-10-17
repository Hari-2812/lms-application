const crypto = require('crypto');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const Submission = require('../models/Submission');
const User = require('../models/User');
const activity = require('../services/activityService');
const mailService = require('../services/mailService');
const settingsService = require('../services/settingsService');
const { grantCourseAccess, revokeCourseAccess, isGrantLive } = require('../services/enrolmentService');
const { sendResetLink } = require('./authController');

/**
 * Admin → Learners: the directory of registered learners, one learner's full
 * record (courses and progress, payments, submissions, certificates), and
 * the actions on it (enrol, suspend, password reset).
 */

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEARNER_FILTER = { role: { $ne: 'admin' } };

/**
 * GET /api/admin/learners?search=&courseId=&status=&payment=
 *   status  — active | suspended
 *   payment — pending | failed | paid | none
 */
async function listLearners(req, res, next) {
  try {
    const { search, courseId, status, payment } = req.query;
    const filter = { ...LEARNER_FILTER };

    if (status === 'active') filter.status = { $ne: 'suspended' };
    else if (status === 'suspended') filter.status = 'suspended';

    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
    }

    if (courseId) {
      const grants = await CourseAccess.find({ courseId, active: true }).select('studentId expiresAt active');
      filter._id = { $in: grants.filter(isGrantLive).map((g) => g.studentId) };
    }

    const learners = await User.find(filter).sort({ createdAt: -1 }).limit(1000);
    const ids = learners.map((l) => l._id);

    const [grants, enrollments, submissionCounts, lastProgress] = await Promise.all([
      CourseAccess.find({ studentId: { $in: ids }, active: true }).select('studentId courseId expiresAt active'),
      Enrollment.find({ studentId: { $in: ids }, amount: { $gt: 0 } }).select('studentId status amount'),
      Submission.aggregate([
        { $match: { studentId: { $in: ids } } },
        { $group: { _id: '$studentId', count: { $sum: 1 } } },
      ]),
      // Progress.studentId is a string column, so match on the string form.
      Progress.aggregate([
        { $match: { studentId: { $in: ids.map(String) } } },
        { $group: { _id: '$studentId', at: { $max: '$updatedAt' } } },
      ]),
    ]);

    const courseCount = new Map();
    for (const grant of grants) {
      if (!isGrantLive(grant)) continue;
      const key = String(grant.studentId);
      courseCount.set(key, (courseCount.get(key) || 0) + 1);
    }

    const payments = new Map();
    for (const e of enrollments) {
      const key = String(e.studentId);
      const row = payments.get(key) || { pending: 0, failed: 0, paidTotal: 0, paidCount: 0 };
      if (e.status === 'pending') row.pending += 1;
      if (e.status === 'failed') row.failed += 1;
      if (e.status === 'completed') {
        row.paidTotal += e.amount;
        row.paidCount += 1;
      }
      payments.set(key, row);
    }

    const submissionsBy = new Map(submissionCounts.map((r) => [String(r._id), r.count]));
    const activeBy = new Map(lastProgress.map((r) => [String(r._id), r.at]));

    let rows = learners.map((learner) => {
      const key = String(learner._id);
      const pay = payments.get(key) || { pending: 0, failed: 0, paidTotal: 0, paidCount: 0 };
      return {
        ...learner.toJSON(),
        courseCount: courseCount.get(key) || 0,
        pendingPayments: pay.pending,
        failedPayments: pay.failed,
        paidTotal: pay.paidTotal,
        paidCount: pay.paidCount,
        submissionCount: submissionsBy.get(key) || 0,
        lastActiveAt: activeBy.get(key) || learner.lastLoginAt || null,
      };
    });

    if (payment === 'pending') rows = rows.filter((r) => r.pendingPayments > 0);
    else if (payment === 'failed') rows = rows.filter((r) => r.failedPayments > 0);
    else if (payment === 'paid') rows = rows.filter((r) => r.paidCount > 0);
    else if (payment === 'none') rows = rows.filter((r) => r.paidCount + r.pendingPayments + r.failedPayments === 0);

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/learners/:id — everything about one learner. */
async function getLearner(req, res, next) {
  try {
    const learner = await User.findOne({ _id: req.params.id, ...LEARNER_FILTER });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const id = learner._id;
    const [grants, enrollments, submissions, certificates, progressRows] = await Promise.all([
      CourseAccess.find({ studentId: id }).populate('courseId', 'title slug thumbnail price published'),
      Enrollment.find({ studentId: id }).populate('courseId', 'title price').sort({ createdAt: -1 }),
      Submission.find({ studentId: id })
        .populate('courseId', 'title')
        .populate('assignmentId', 'title maxScore dueDate')
        .sort({ createdAt: -1 }),
      Certificate.find({ userId: id, kind: 'course' }).sort({ issuedAt: -1 }),
      Progress.find({ studentId: String(id) }).select('courseId completed updatedAt').lean(),
    ]);

    const courseIds = grants.map((g) => g.courseId?._id).filter(Boolean);
    const lessonCounts = await Lesson.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]);
    const lessonsBy = new Map(lessonCounts.map((r) => [String(r._id), r.count]));

    const progressBy = new Map();
    for (const row of progressRows) {
      const key = String(row.courseId);
      const entry = progressBy.get(key) || { completed: 0, lastActivity: null };
      if (row.completed) entry.completed += 1;
      if (!entry.lastActivity || row.updatedAt > entry.lastActivity) entry.lastActivity = row.updatedAt;
      progressBy.set(key, entry);
    }

    const certificateBy = new Map(certificates.map((c) => [String(c.courseId), c]));

    const courses = grants
      .filter((g) => g.courseId)
      .map((grant) => {
        const key = String(grant.courseId._id);
        const lessonCount = lessonsBy.get(key) || 0;
        const progress = progressBy.get(key) || { completed: 0, lastActivity: null };
        return {
          courseId: grant.courseId._id,
          title: grant.courseId.title,
          thumbnail: grant.courseId.thumbnail,
          live: isGrantLive(grant),
          active: grant.active,
          expiresAt: grant.expiresAt || null,
          source: grant.source || 'manual',
          grantedAt: grant.createdAt,
          lessonCount,
          completedLessons: progress.completed,
          progress: lessonCount ? Math.round((progress.completed / lessonCount) * 100) : 0,
          lastActivity: progress.lastActivity,
          certificateSerial: certificateBy.get(key)?.serial || null,
        };
      })
      .sort((a, b) => Number(b.live) - Number(a.live) || new Date(b.grantedAt) - new Date(a.grantedAt));

    res.json({
      learner,
      courses,
      enrollments,
      submissions,
      certificates,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/learners/:id/status  body: { status: 'active' | 'suspended', reason? } */
async function setLearnerStatus(req, res, next) {
  try {
    const { status, reason } = req.body || {};
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'status must be active or suspended' });
    }

    const learner = await User.findOne({ _id: req.params.id, ...LEARNER_FILTER });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    if (learner.status === status) return res.json(learner);

    learner.status = status;
    learner.suspendedAt = status === 'suspended' ? new Date() : undefined;
    learner.suspendedReason = status === 'suspended' ? String(reason || '').trim().slice(0, 300) : '';
    await learner.save();

    await activity.log(req, {
      category: 'learner',
      action: status === 'suspended' ? 'learner.suspended' : 'learner.activated',
      summary:
        status === 'suspended'
          ? `Suspended ${learner.name} (${learner.email})${learner.suspendedReason ? `: ${learner.suspendedReason}` : ''}`
          : `Re-activated ${learner.name} (${learner.email})`,
      entityType: 'user',
      entityId: learner._id,
    });

    res.json(learner);
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/learners/:id/enrol  body: { courseId } — manual enrolment. */
async function enrolLearner(req, res, next) {
  try {
    const { courseId } = req.body || {};
    if (!courseId) return res.status(400).json({ error: 'Choose a course' });

    const [learner, course] = await Promise.all([
      User.findOne({ _id: req.params.id, ...LEARNER_FILTER }),
      Course.findById(courseId),
    ]);
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { alreadyActive } = await grantCourseAccess(learner._id, course, { by: req.user._id, source: 'manual' });
    if (alreadyActive) return res.status(409).json({ error: `${learner.name} already has access to this course` });

    await activity.log(req, {
      category: 'enrolment',
      action: 'enrolment.manual',
      summary: `Manually enrolled ${learner.name} in "${course.title}"`,
      entityType: 'user',
      entityId: learner._id,
      meta: { courseId: String(course._id) },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/learners/:id/enrol/:courseId — removes access. */
async function unenrolLearner(req, res, next) {
  try {
    const [learner, course] = await Promise.all([
      User.findOne({ _id: req.params.id, ...LEARNER_FILTER }),
      Course.findById(req.params.courseId),
    ]);
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const grant = await revokeCourseAccess(learner._id, course);
    if (!grant) return res.status(404).json({ error: 'This learner was not enrolled in that course' });

    await activity.log(req, {
      category: 'enrolment',
      action: 'enrolment.revoked',
      summary: `Removed ${learner.name}'s access to "${course.title}"`,
      entityType: 'user',
      entityId: learner._id,
      meta: { courseId: String(course._id) },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** A readable one-time password: no 0/O/1/l look-alikes. */
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * POST /api/admin/users/:id/reset-password  body: { mode: 'link' | 'temporary' }
 *
 * For learners and staff alike. 'link' emails the normal reset link (needs
 * SMTP); 'temporary' sets a one-time password and returns it once, for the
 * admin to pass on. Either way every existing session is signed out.
 */
async function resetUserPassword(req, res, next) {
  try {
    const mode = req.body?.mode === 'link' ? 'link' : 'temporary';
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Account not found' });

    let password = '';
    if (mode === 'link') {
      if (!(await mailService.isConfigured())) {
        return res.status(400).json({ error: 'Email is not set up yet. Configure SMTP in Settings, or use a temporary password.' });
      }
      const { sent, error } = await sendResetLink(user);
      if (!sent) return res.status(502).json({ error: `The email could not be sent: ${error}` });
    } else {
      password = temporaryPassword();
      user.password = password;
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    await activity.log(req, {
      category: 'security',
      action: mode === 'link' ? 'auth.reset_link_sent' : 'auth.temporary_password',
      summary:
        mode === 'link'
          ? `Sent a password reset link to ${user.name} (${user.email})`
          : `Set a temporary password for ${user.name} (${user.email})`,
      entityType: 'user',
      entityId: user._id,
    });

    const { branding } = await settingsService.get();
    res.json(
      mode === 'link'
        ? { success: true, message: `A reset link was emailed to ${user.email}.` }
        : {
            success: true,
            temporaryPassword: password,
            message: `Share this one-time password with ${user.name}. They can change it from ${branding.platformName} → Settings.`,
          }
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLearners,
  getLearner,
  setLearnerStatus,
  enrolLearner,
  unenrolLearner,
  resetUserPassword,
  temporaryPassword,
};
