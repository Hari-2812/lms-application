const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const lessonProgress = require('../services/lessonProgressService');

/**
 * Merge each lesson with this student's progress row.
 * Lesson.toJSON() strips videoFileId, so the Drive id never reaches the client.
 */
async function withProgress(lessons, studentId) {
  const progressRows = await Progress.find({
    studentId,
    lessonId: { $in: lessons.map((l) => l._id) },
  }).lean();

  const byLesson = new Map(progressRows.map((p) => [String(p.lessonId), p]));

  return lessons.map((lesson) => {
    const progress = byLesson.get(String(lesson._id));
    return {
      ...lesson.toJSON(),
      // The client builds its video src from this id alone.
      streamUrl: `/api/videos/${lesson._id}/stream`,
      progress: progress
        ? {
            position: progress.position,
            percent: progress.percent,
            // Seconds of the video actually played (not just how far the seek bar went).
            watchedSeconds: progress.watchedSeconds || 0,
            completed: progress.completed,
            // Lets the dashboard order recent activity by real timestamps.
            updatedAt: progress.updatedAt,
          }
        : { position: 0, percent: 0, watchedSeconds: 0, completed: false, updatedAt: null },
    };
  });
}

/**
 * Marks which lessons this learner cannot open yet (sequential unlocking —
 * see lessonProgressService). `lessons` must be in course order. A locked
 * lesson keeps its title and length for the curriculum, but not its stream.
 */
function withLocks(lessons, enforce) {
  const locked = enforce ? lessonProgress.lockedFlags(lessons.map((l) => Boolean(l.progress?.completed))) : [];
  return lessons.map((lesson, index) => {
    if (!locked[index]) return { ...lesson, locked: false };
    const { streamUrl, ...rest } = lesson;
    return { ...rest, locked: true };
  });
}

/** GET /api/courses/:courseId/lessons */
async function listLessonsForCourse(req, res, next) {
  try {
    const lessons = await Lesson.find({ courseId: req.params.courseId }).sort(lessonProgress.COURSE_ORDER);
    const decorated = await withProgress(lessons, req.student.id);
    res.json(withLocks(decorated, await lessonProgress.enforcesSequence(req.courseAccess)));
  } catch (err) {
    next(err);
  }
}

/** GET /api/lessons/:id — locked lessons are refused by requireLessonUnlocked before this runs. */
async function getLesson(req, res, next) {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const [decorated] = await withProgress([lesson], req.student.id);
    res.json({ ...decorated, locked: false });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLessonsForCourse, getLesson };
