const crypto = require('crypto');
const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const CourseAccess = require('../models/CourseAccess');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const Resource = require('../models/Resource');
const ResourceAccess = require('../models/ResourceAccess');
const Submission = require('../models/Submission');
const User = require('../models/User');
const activity = require('../services/activityService');
const mailService = require('../services/mailService');
const settingsService = require('../services/settingsService');
const { grantCourseAccess, revokeCourseAccess, isGrantLive, setFullAccess } = require('../services/enrolmentService');
const { notifyUser } = require('../services/notificationService');
const { sendResetLink } = require('./authController');

/**
 * Admin → Learners: the directory of registered learners, one learner's full
 * record (courses and progress, payments, submissions, certificates), and
 * the actions on it (enrol, suspend, password reset).
 */

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEARNER_FILTER = { role: { $ne: 'admin' } };
const PROGRESS_STATES = ['not_enrolled', 'not_started', 'in_progress', 'completed'];

/**
 * GET /api/admin/learners
 *   search   — name, email or phone
 *   courseId — learners who can open this course (grant or Full Access);
 *              progress and task figures are then for this course only
 *   status   — active | suspended
 *   payment  — pending | failed | paid | none
 *   access   — full | courses | materials | none
 *   progress — not_enrolled | not_started | in_progress | completed
 *   tasks    — pending | overdue | all_done | awaiting_review | needs_revision | none_submitted
 */
async function listLearners(req, res, next) {
  try {
    const { search, courseId, status, payment, access, progress, tasks } = req.query;
    const filter = { ...LEARNER_FILTER };
    const and = [];

    if (status === 'active') filter.status = { $ne: 'suspended' };
    else if (status === 'suspended') filter.status = 'suspended';

    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      and.push({ $or: [{ name: pattern }, { email: pattern }, { phone: pattern }] });
    }

    const scopedCourse = courseId && mongoose.isValidObjectId(courseId) ? String(courseId) : null;
    if (courseId && !scopedCourse) return res.json([]);
    if (scopedCourse) {
      const grants = await CourseAccess.find({ courseId: scopedCourse, active: true }).select('studentId expiresAt active');
      and.push({ $or: [{ _id: { $in: grants.filter(isGrantLive).map((g) => g.studentId) } }, { fullAccess: true }] });
    }
    if (access === 'full') filter.fullAccess = true;
    if (and.length) filter.$and = and;

    const learners = await User.find(filter).sort({ createdAt: -1 }).limit(1000);
    const ids = learners.map((l) => l._id);

    const [grants, enrollments, submissions, progressRows, lessonCounts, assignments, materialCounts] = await Promise.all([
      CourseAccess.find({ studentId: { $in: ids }, active: true }).select('studentId courseId expiresAt active'),
      Enrollment.find({ studentId: { $in: ids }, amount: { $gt: 0 } }).select('studentId status amount'),
      Submission.find({ studentId: { $in: ids } }).select('studentId assignmentId courseId status'),
      // Progress.studentId is a string column, so match on the string form.
      Progress.aggregate([
        { $match: { studentId: { $in: ids.map(String) } } },
        {
          $group: {
            _id: { student: '$studentId', course: '$courseId' },
            completed: { $sum: { $cond: ['$completed', 1, 0] } },
            at: { $max: '$updatedAt' },
          },
        },
      ]),
      Lesson.aggregate([{ $group: { _id: '$courseId', count: { $sum: 1 } } }]),
      Assignment.find({ published: true }).select('courseId dueDate'),
      ResourceAccess.aggregate([
        { $match: { studentId: { $in: ids } } },
        { $group: { _id: '$studentId', count: { $sum: 1 } } },
      ]),
    ]);

    const lessonsIn = new Map(lessonCounts.map((r) => [String(r._id), r.count]));
    const materialsBy = new Map(materialCounts.map((r) => [String(r._id), r.count]));

    const coursesBy = new Map();
    for (const grant of grants) {
      if (!isGrantLive(grant)) continue;
      const key = String(grant.studentId);
      if (!coursesBy.has(key)) coursesBy.set(key, new Set());
      coursesBy.get(key).add(String(grant.courseId));
    }

    // studentId → courseId → { completed, at }
    const progressBy = new Map();
    for (const row of progressRows) {
      const key = String(row._id.student);
      if (!progressBy.has(key)) progressBy.set(key, new Map());
      progressBy.get(key).set(String(row._id.course), row);
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

    const submissionsBy = new Map();
    for (const s of submissions) {
      const key = String(s.studentId);
      if (!submissionsBy.has(key)) submissionsBy.set(key, []);
      submissionsBy.get(key).push(s);
    }

    const now = Date.now();

    let rows = learners.map((learner) => {
      const key = String(learner._id);
      const pay = payments.get(key) || { pending: 0, failed: 0, paidTotal: 0, paidCount: 0 };
      const granted = coursesBy.get(key) || new Set();
      const progressRowsFor = progressBy.get(key) || new Map();

      // The courses progress is measured over: the filtered course, or every
      // course the learner holds (for Full Access, the ones they have started).
      let scope;
      if (scopedCourse) scope = [scopedCourse];
      else if (learner.fullAccess) scope = [...new Set([...granted, ...progressRowsFor.keys()])];
      else scope = [...granted];

      let totalLessons = 0;
      let completedLessons = 0;
      let coursesCompleted = 0;
      let lastActiveAt = null;
      for (const course of scope) {
        const lessons = lessonsIn.get(course) || 0;
        const done = Math.min(progressRowsFor.get(course)?.completed || 0, lessons);
        totalLessons += lessons;
        completedLessons += done;
        if (lessons > 0 && done >= lessons) coursesCompleted += 1;
      }
      for (const row of progressRowsFor.values()) {
        if (!lastActiveAt || row.at > lastActiveAt) lastActiveAt = row.at;
      }
      const progressPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
      // Full Access means every course is open, so "not started" rather than "no course yet".
      const progressState = !scope.length && !(learner.fullAccess && !scopedCourse)
        ? 'not_enrolled'
        : completedLessons === 0
          ? 'not_started'
          : progressPercent >= 100
            ? 'completed'
            : 'in_progress';

      // Tasks set for this learner: course tasks for courses they hold (all,
      // with Full Access) plus general ones — or just the filtered course's.
      const applicable = assignments.filter((a) => {
        const course = a.courseId ? String(a.courseId) : null;
        if (scopedCourse) return course === scopedCourse;
        return !course || learner.fullAccess || granted.has(course);
      });
      const mine = submissionsBy.get(key) || [];
      const handedIn = new Set(mine.filter((s) => s.assignmentId).map((s) => String(s.assignmentId)));
      const pendingTasks = applicable.filter((a) => !handedIn.has(String(a._id)));
      const scopedSubmissions = scopedCourse ? mine.filter((s) => String(s.courseId) === scopedCourse) : mine;

      return {
        ...learner.toJSON(),
        courseCount: granted.size,
        materialCount: materialsBy.get(key) || 0,
        pendingPayments: pay.pending,
        failedPayments: pay.failed,
        paidTotal: pay.paidTotal,
        paidCount: pay.paidCount,
        submissionCount: mine.length,
        lastActiveAt: lastActiveAt || learner.lastLoginAt || null,

        progressPercent,
        progressState,
        completedLessons,
        totalLessons,
        coursesCompleted,

        tasksAssigned: applicable.length,
        tasksSubmitted: applicable.length - pendingTasks.length,
        tasksPending: pendingTasks.length,
        tasksOverdue: pendingTasks.filter((a) => a.dueDate && new Date(a.dueDate).getTime() < now).length,
        awaitingReview: scopedSubmissions.filter((s) => s.status === 'submitted' || s.status === 'under_review').length,
        needsRevision: scopedSubmissions.filter((s) => s.status === 'needs_revision').length,
        acceptedTasks: scopedSubmissions.filter((s) => s.status === 'accepted').length,
      };
    });

    if (payment === 'pending') rows = rows.filter((r) => r.pendingPayments > 0);
    else if (payment === 'failed') rows = rows.filter((r) => r.failedPayments > 0);
    else if (payment === 'paid') rows = rows.filter((r) => r.paidCount > 0);
    else if (payment === 'none') rows = rows.filter((r) => r.paidCount + r.pendingPayments + r.failedPayments === 0);

    if (access === 'courses') rows = rows.filter((r) => !r.fullAccess && r.courseCount > 0);
    else if (access === 'materials') rows = rows.filter((r) => !r.fullAccess && r.materialCount > 0);
    else if (access === 'none') rows = rows.filter((r) => !r.fullAccess && r.courseCount === 0 && r.materialCount === 0);

    if (PROGRESS_STATES.includes(progress)) rows = rows.filter((r) => r.progressState === progress);

    if (tasks === 'pending') rows = rows.filter((r) => r.tasksPending > 0);
    else if (tasks === 'overdue') rows = rows.filter((r) => r.tasksOverdue > 0);
    else if (tasks === 'all_done') rows = rows.filter((r) => r.tasksAssigned > 0 && r.tasksPending === 0);
    else if (tasks === 'awaiting_review') rows = rows.filter((r) => r.awaitingReview > 0);
    else if (tasks === 'needs_revision') rows = rows.filter((r) => r.needsRevision > 0);
    else if (tasks === 'none_submitted') rows = rows.filter((r) => r.submissionCount === 0);

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/learners/:id — everything about one learner. */
async function getLearner(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Learner not found' });
    const learner = await User.findOne({ _id: req.params.id, ...LEARNER_FILTER });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const id = learner._id;
    const [grants, enrollments, submissions, certificates, progressRows, materialGrants, allCourses] = await Promise.all([
      CourseAccess.find({ studentId: id }).populate('courseId', 'title slug thumbnail price published'),
      Enrollment.find({ studentId: id }).populate('courseId', 'title price').sort({ createdAt: -1 }),
      Submission.find({ studentId: id })
        .populate('courseId', 'title')
        .populate('assignmentId', 'title maxScore dueDate')
        .sort({ createdAt: -1 }),
      Certificate.find({ userId: id, kind: 'course' }).sort({ issuedAt: -1 }),
      Progress.find({ studentId: String(id) }).select('courseId completed updatedAt').lean(),
      ResourceAccess.find({ studentId: id })
        .populate('resourceId', 'title type url')
        .populate('courseId', 'title')
        .sort({ createdAt: -1 }),
      // Full Access covers every published course, granted or not.
      learner.fullAccess ? Course.find({ published: { $ne: false } }).select('title slug thumbnail price published') : [],
    ]);

    const grantedIds = new Set(grants.filter((g) => g.courseId).map((g) => String(g.courseId._id)));
    const fullAccessCourses = allCourses.filter((c) => !grantedIds.has(String(c._id)));

    const courseIds = [...grants.map((g) => g.courseId?._id).filter(Boolean), ...fullAccessCourses.map((c) => c._id)];
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

    const describe = (course, extra) => {
      const key = String(course._id);
      const lessonCount = lessonsBy.get(key) || 0;
      const progress = progressBy.get(key) || { completed: 0, lastActivity: null };
      return {
        courseId: course._id,
        title: course.title,
        thumbnail: course.thumbnail,
        lessonCount,
        completedLessons: progress.completed,
        progress: lessonCount ? Math.round((progress.completed / lessonCount) * 100) : 0,
        lastActivity: progress.lastActivity,
        certificateSerial: certificateBy.get(key)?.serial || null,
        ...extra,
      };
    };

    const courses = [
      ...grants
        .filter((g) => g.courseId)
        .map((grant) =>
          describe(grant.courseId, {
            // A removed or expired grant is still covered while Full Access is on.
            live: isGrantLive(grant) || (learner.fullAccess && grant.courseId.published !== false),
            active: grant.active,
            expiresAt: grant.expiresAt || null,
            source: grant.source || 'manual',
            grantedAt: grant.createdAt,
          })
        ),
      ...fullAccessCourses.map((course) =>
        describe(course, { live: true, active: true, expiresAt: null, source: 'full', grantedAt: learner.fullAccessGrantedAt })
      ),
    ].sort((a, b) => Number(b.live) - Number(a.live) || new Date(b.grantedAt || 0) - new Date(a.grantedAt || 0));

    res.json({
      learner,
      courses,
      enrollments,
      submissions,
      certificates,
      materials: materialGrants
        .filter((m) => m.resourceId)
        .map((m) => ({
          resourceId: m.resourceId._id,
          title: m.resourceId.title,
          type: m.resourceId.type,
          url: m.resourceId.url,
          courseId: m.courseId?._id || m.courseId,
          courseTitle: m.courseId?.title || 'Deleted course',
          grantedAt: m.createdAt,
        })),
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/learners/:id/full-access  body: { enabled } */
async function setLearnerFullAccess(req, res, next) {
  try {
    const learner = await User.findOne({ _id: req.params.id, ...LEARNER_FILTER });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const enabled = Boolean(req.body?.enabled);
    const changed = await setFullAccess(learner, enabled, { by: req.user._id });

    if (changed) {
      await activity.log(req, {
        category: 'enrolment',
        action: enabled ? 'access.full_granted' : 'access.full_revoked',
        summary: enabled
          ? `Gave ${learner.name} Full Access to every course and material`
          : `Ended ${learner.name}'s Full Access (individual courses kept)`,
        entityType: 'user',
        entityId: learner._id,
      });
    }

    res.json({ success: true, fullAccess: learner.fullAccess });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/learners/:id/materials  body: { resourceIds: [] }
 *
 * Limited Access to learning materials: replaces the set of individual
 * study materials shared with this learner. Materials of courses they can
 * already open need no entry and are ignored by the learner pages anyway.
 */
async function setLearnerMaterials(req, res, next) {
  try {
    const learner = await User.findOne({ _id: req.params.id, ...LEARNER_FILTER });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const requested = Array.isArray(req.body?.resourceIds) ? req.body.resourceIds : null;
    if (!requested) return res.status(400).json({ error: 'resourceIds must be a list' });
    if (requested.length > 500) return res.status(400).json({ error: 'Too many materials in one go' });

    const validIds = [...new Set(requested.map(String))].filter((rid) => mongoose.isValidObjectId(rid));
    const resources = await Resource.find({ _id: { $in: validIds } }).populate('courseId', 'title');
    const wanted = new Map(resources.map((r) => [String(r._id), r]));

    const existing = await ResourceAccess.find({ studentId: learner._id }).select('resourceId');
    const had = new Set(existing.map((e) => String(e.resourceId)));

    const toRemove = [...had].filter((rid) => !wanted.has(rid));
    const toAdd = [...wanted.values()].filter((r) => !had.has(String(r._id)));

    if (toRemove.length) await ResourceAccess.deleteMany({ studentId: learner._id, resourceId: { $in: toRemove } });
    if (toAdd.length) {
      await ResourceAccess.insertMany(
        toAdd.map((r) => ({ studentId: learner._id, resourceId: r._id, courseId: r.courseId?._id || r.courseId, grantedBy: req.user._id })),
        { ordered: false }
      ).catch((err) => {
        // A concurrent save may already have added one; the unique index makes that a no-op.
        if (err.code !== 11000 && !err.writeErrors) throw err;
      });

      await notifyUser(learner._id, {
        type: 'access_granted',
        title: 'Study material shared with you',
        message:
          toAdd.length === 1
            ? `"${toAdd[0].title}" (${toAdd[0].courseId?.title || 'course material'}) is now available in Resources.`
            : `${toAdd.length} study materials are now available in Resources.`,
        link: '/resources',
      });
    }

    if (toAdd.length || toRemove.length) {
      await activity.log(req, {
        category: 'enrolment',
        action: 'access.materials_updated',
        summary: `Updated ${learner.name}'s shared materials: ${toAdd.length} added, ${toRemove.length} removed`,
        entityType: 'user',
        entityId: learner._id,
      });
    }

    res.json({ success: true, added: toAdd.length, removed: toRemove.length, total: wanted.size });
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
  setLearnerFullAccess,
  setLearnerMaterials,
  setLearnerStatus,
  enrolLearner,
  unenrolLearner,
  resetUserPassword,
  temporaryPassword,
};
