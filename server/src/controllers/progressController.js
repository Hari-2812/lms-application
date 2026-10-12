const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const { notifyUser } = require('../services/notificationService');
const certificateService = require('../services/certificateService');

const COMPLETE_AT_PERCENT = 90; // "watched enough" threshold for the demo
const MILESTONES = [50, 100];

/**
 * After a lesson is newly marked complete, checks whether the student's
 * overall course completion just crossed a milestone (50%/100%) and, if so,
 * notifies them. Completing one lesson can only move the percentage up, so
 * comparing the pre- and post-completion counts is enough to detect a cross.
 */
async function checkCourseMilestone(studentId, courseId) {
  const [lessonCount, completedCount, course] = await Promise.all([
    Lesson.countDocuments({ courseId }),
    Progress.countDocuments({ studentId, courseId, completed: true }),
    Course.findById(courseId).select('title'),
  ]);
  if (!lessonCount || !course) return;

  const newPercent = Math.round((completedCount / lessonCount) * 100);
  const prevPercent = Math.round(((completedCount - 1) / lessonCount) * 100);

  const crossed = MILESTONES.find((m) => prevPercent < m && newPercent >= m);
  if (!crossed) return;

  await notifyUser(studentId, {
    type: 'progress_milestone',
    title: crossed >= 100 ? 'Course completed!' : `${crossed}% complete`,
    message:
      crossed >= 100
        ? `You finished "${course.title}" — congratulations!`
        : `You're ${crossed}% of the way through "${course.title}"`,
    courseId,
  });
}

/** POST /api/progress  body: { lessonId, position, duration } */
async function saveProgress(req, res, next) {
  try {
    const { lessonId, position = 0, duration = 0 } = req.body || {};
    if (!lessonId) return res.status(400).json({ error: 'lessonId is required' });

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const percent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;

    const existing = await Progress.findOne({ studentId: req.student.id, lessonId });
    const wasCompleted = existing?.completed ?? false;
    const completed = wasCompleted || percent >= COMPLETE_AT_PERCENT;

    const progress = await Progress.findOneAndUpdate(
      { studentId: req.student.id, lessonId },
      {
        studentId: req.student.id,
        lessonId,
        courseId: lesson.courseId,
        position,
        duration,
        percent,
        completed,
      },
      { new: true, upsert: true }
    );

    if (completed && !wasCompleted) {
      await checkCourseMilestone(req.student.id, lesson.courseId);

      // Finishing the last lesson generates the course certificate. A no-op
      // when the course still has lessons left, or when the certificate was
      // already issued. Never fails the progress save: a certificate that
      // did not get created here is picked up by GET /api/certificates.
      await certificateService
        .issueForCourse(req.student.id, lesson.courseId)
        .catch((err) => console.error('[progress] certificate issue failed:', err.message));
    }

    res.json({
      lessonId: progress.lessonId,
      position: progress.position,
      percent: progress.percent,
      completed: progress.completed,
      updatedAt: progress.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress/:lessonId */
async function getProgress(req, res, next) {
  try {
    const progress = await Progress.findOne({
      studentId: req.student.id,
      lessonId: req.params.lessonId,
    });

    if (!progress) {
      return res.json({
        lessonId: req.params.lessonId,
        position: 0,
        percent: 0,
        completed: false,
        updatedAt: null,
      });
    }

    res.json({
      lessonId: progress.lessonId,
      position: progress.position,
      percent: progress.percent,
      completed: progress.completed,
      updatedAt: progress.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { saveProgress, getProgress };
