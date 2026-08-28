const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');

/**
 * Attach lesson counts + this student's completion percentage to courses.
 * Computed here so the dashboard needs one request instead of N.
 */
async function decorateCourses(courses, studentId) {
  const courseIds = courses.map((c) => c._id);

  const [lessonCounts, progressRows] = await Promise.all([
    Lesson.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]),
    Progress.find({ studentId, courseId: { $in: courseIds } }).lean(),
  ]);

  const countByCourse = new Map(lessonCounts.map((r) => [String(r._id), r.count]));
  const completedByCourse = new Map();
  for (const row of progressRows) {
    if (!row.completed) continue;
    const key = String(row.courseId);
    completedByCourse.set(key, (completedByCourse.get(key) || 0) + 1);
  }

  return courses.map((course) => {
    const key = String(course._id);
    const lessonCount = countByCourse.get(key) || 0;
    const completed = completedByCourse.get(key) || 0;
    return {
      ...course.toJSON(),
      lessonCount,
      completedLessons: completed,
      progress: lessonCount ? Math.round((completed / lessonCount) * 100) : 0,
    };
  });
}

/** GET /api/courses */
async function listCourses(req, res, next) {
  try {
    const courses = await Course.find().sort({ createdAt: 1 });
    res.json(await decorateCourses(courses, req.student.id));
  } catch (err) {
    next(err);
  }
}

/** GET /api/courses/:id */
async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const [decorated] = await decorateCourses([course], req.student.id);
    res.json(decorated);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCourses, getCourse };
