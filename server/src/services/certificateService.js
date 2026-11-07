const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const User = require('../models/User');
const Submission = require('../models/Submission');
const settingsService = require('./settingsService');
const { notifyUser, notifyAdmins } = require('./notificationService');

/**
 * Certificate issuing.
 *
 * Course certificates are generated automatically — `issueForCourse` is
 * called from the progress controller the moment a student's completed
 * lesson count reaches the course's lesson count, and again (idempotently)
 * by GET /api/certificates so a student who completed a course before this
 * feature existed still gets theirs.
 */

/**
 * Progress.studentId is a String column while Certificate.userId is an
 * ObjectId. find()/countDocuments() cast through the schema either way, but
 * aggregate() does not — so progress aggregations need the string form.
 */
const asProgressId = (studentId) => String(studentId);

/**
 * Whether a student has met the course's completion criteria, as set in
 * Settings → Learning rules: a share of the lessons complete and, optionally,
 * an accepted task submission for the course.
 */
async function completionFor(studentId, courseId) {
  const [{ learning }, lessonCount, completedCount] = await Promise.all([
    settingsService.get(),
    Lesson.countDocuments({ courseId }),
    Progress.countDocuments({ studentId: asProgressId(studentId), courseId, completed: true }),
  ]);

  const requiredCount = Math.max(1, Math.ceil((lessonCount * learning.certificateCompletionPercent) / 100));
  const lessonsDone = lessonCount > 0 && completedCount >= requiredCount;

  let taskDone = true;
  if (learning.requireAcceptedTask) {
    taskDone = Boolean(await Submission.exists({ studentId, courseId, status: 'accepted' }));
  }

  return {
    lessonCount,
    completedCount,
    requiredCount,
    needsAcceptedTask: learning.requireAcceptedTask && !taskDone,
    complete: lessonsDone && taskDone,
  };
}

/**
 * Issues the certificate for a completed course, or returns the existing one.
 * Returns null when the course is not actually finished, so callers can use
 * it as both a check and an action.
 *
 * `notify` is false for the catch-up pass in listMine — a student opening
 * the Certificates page should not get a bell notification for a course they
 * finished weeks ago.
 */
async function issueForCourse(studentId, courseId, { notify = true } = {}) {
  const existing = await Certificate.findOne({ userId: studentId, courseId, kind: 'course' });
  if (existing) return existing;

  const { lessonCount, complete } = await completionFor(studentId, courseId);
  if (!complete) return null;

  const [course, student] = await Promise.all([Course.findById(courseId), User.findById(studentId)]);
  if (!course || !student) return null;

  let certificate;
  try {
    certificate = await Certificate.create({
      userId: studentId,
      courseId,
      kind: 'course',
      recipientName: student.name,
      courseTitle: course.title,
      instructor: course.instructor,
      lessonCount,
      hours: course.hours,
      serial: Certificate.generateSerial(),
    });
  } catch (err) {
    // Two concurrent progress saves can both see "no certificate yet" and
    // race to create one; the unique index makes the loser a no-op.
    if (err.code === 11000) return Certificate.findOne({ userId: studentId, courseId, kind: 'course' });
    throw err;
  }

  if (notify) {
    await notifyUser(
      studentId,
      {
        type: 'certificate',
        title: 'Certificate ready',
        message: `Your certificate for "${course.title}" has been generated and is ready to download.`,
        courseId,
        link: '/certificates',
      },
      { setting: 'learner.certificateReady' }
    );
    await notifyAdmins(
      {
        type: 'certificate',
        title: 'Certificate issued',
        message: `${student.name} earned the certificate for "${course.title}" (${certificate.serial}).`,
        courseId,
        link: '/admin/certificates',
      },
      { setting: 'admin.certificateIssued' }
    );
  }

  return certificate;
}

/**
 * Builds a sample certificate from free-text input, for staff previewing the
 * template. Never saved, and never shown to learners.
 */
function issueSample({ recipientName, courseTitle, instructor, lessonCount, hours }) {
  return {
    id: null,
    preview: true,
    kind: 'sample',
    recipientName,
    courseTitle,
    instructor: instructor || '',
    lessonCount: Number(lessonCount) || 0,
    hours: Number(hours) || 0,
    serial: Certificate.generateSerial('SAMPLE'),
    issuedAt: new Date(),
  };
}

/**
 * Every certificate a student holds, newest first, after topping up any
 * course they have finished but never had a certificate generated for.
 */
async function listMine(studentId) {
  const completed = await Progress.aggregate([
    { $match: { studentId: asProgressId(studentId), completed: true } },
    { $group: { _id: '$courseId' } },
  ]);

  await Promise.all(
    completed.map((row) => issueForCourse(studentId, row._id, { notify: false }).catch(() => null))
  );

  // Earned certificates only. Samples are an admin preview tool; any made by
  // learners before that change stay in the database but are no longer listed.
  return Certificate.find({ userId: studentId, kind: 'course' }).sort({ issuedAt: -1 });
}

module.exports = { issueForCourse, issueSample, listMine, completionFor };
