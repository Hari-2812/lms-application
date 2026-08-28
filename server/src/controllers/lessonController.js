const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');

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
            completed: progress.completed,
            // Lets the dashboard order recent activity by real timestamps.
            updatedAt: progress.updatedAt,
          }
        : { position: 0, percent: 0, completed: false, updatedAt: null },
    };
  });
}

/** GET /api/courses/:courseId/lessons */
async function listLessonsForCourse(req, res, next) {
  try {
    const lessons = await Lesson.find({ courseId: req.params.courseId }).sort({ order: 1 });
    res.json(await withProgress(lessons, req.student.id));
  } catch (err) {
    next(err);
  }
}

/** GET /api/lessons/:id */
async function getLesson(req, res, next) {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const [decorated] = await withProgress([lesson], req.student.id);
    res.json(decorated);
  } catch (err) {
    next(err);
  }
}

module.exports = { listLessonsForCourse, getLesson };
