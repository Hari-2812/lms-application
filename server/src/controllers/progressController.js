const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');

const COMPLETE_AT_PERCENT = 90; // "watched enough" threshold for the demo

/** POST /api/progress  body: { lessonId, position, duration } */
async function saveProgress(req, res, next) {
  try {
    const { lessonId, position = 0, duration = 0 } = req.body || {};
    if (!lessonId) return res.status(400).json({ error: 'lessonId is required' });

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const percent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;

    const existing = await Progress.findOne({ studentId: req.student.id, lessonId });
    const completed = (existing?.completed ?? false) || percent >= COMPLETE_AT_PERCENT;

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
