const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const User = require('../models/User');
const { notifyUser } = require('./notificationService');

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

/** Completed-lesson count vs. total, for one student and course. */
async function completionFor(studentId, courseId) {
  const [lessonCount, completedCount] = await Promise.all([
    Lesson.countDocuments({ courseId }),
    Progress.countDocuments({ studentId: asProgressId(studentId), courseId, completed: true }),
  ]);
  return { lessonCount, completedCount, complete: lessonCount > 0 && completedCount >= lessonCount };
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
    await notifyUser(studentId, {
      type: 'certificate',
      title: 'Certificate ready',
      message: `Your certificate for "${course.title}" has been generated and is ready to download.`,
      courseId,
      link: '/certificates',
    });
  }

  return certificate;
}

/**
 * Generates a sample certificate from free-text input — the "see what you'll
 * get" flow. Persisted when a student is signed in so it shows up in their
 * Certificate section; returned unsaved to anonymous visitors.
 */
async function issueSample({ studentId, recipientName, courseTitle, instructor, lessonCount, hours }) {
  const payload = {
    kind: 'sample',
    recipientName,
    courseTitle,
    instructor: instructor || '',
    lessonCount: Number(lessonCount) || 0,
    hours: Number(hours) || 0,
    serial: Certificate.generateSerial('SAMPLE'),
    issuedAt: new Date(),
  };

  if (!studentId) return { ...payload, id: null, preview: true };

  const certificate = await Certificate.create({ ...payload, userId: studentId });

  await notifyUser(studentId, {
    type: 'certificate',
    title: 'Sample certificate generated',
    message: `Your sample certificate for "${courseTitle}" is ready in the Certificates section.`,
    link: '/certificates',
  });

  return certificate;
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

  return Certificate.find({ userId: studentId }).sort({ issuedAt: -1 });
}

module.exports = { issueForCourse, issueSample, listMine, completionFor };
