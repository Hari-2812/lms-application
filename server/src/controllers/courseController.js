const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const CourseAccess = require('../models/CourseAccess');

/**
 * Attach lesson counts, this student's completion percentage, and whether
 * they currently have access, to each course. Computed here so the
 * dashboard needs one request instead of N.
 *
 * `student` is undefined for anonymous catalogue browsing (the course list
 * is public) — such requests get lesson counts but no progress and no access.
 */
async function decorateCourses(courses, student) {
  const courseIds = courses.map((c) => c._id);
  const isAdmin = student?.role === 'admin';

  const [lessonCounts, progressRows, accessRows] = await Promise.all([
    Lesson.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]),
    student ? Progress.find({ studentId: student.id, courseId: { $in: courseIds } }).lean() : [],
    isAdmin || !student
      ? Promise.resolve([])
      : CourseAccess.find({ studentId: student.id, courseId: { $in: courseIds }, active: true }).lean(),
  ]);

  const countByCourse = new Map(lessonCounts.map((r) => [String(r._id), r.count]));
  const completedByCourse = new Map();
  for (const row of progressRows) {
    if (!row.completed) continue;
    const key = String(row.courseId);
    completedByCourse.set(key, (completedByCourse.get(key) || 0) + 1);
  }
  const accessByCourse = new Set(accessRows.map((r) => String(r.courseId)));

  return courses.map((course) => {
    const key = String(course._id);
    const lessonCount = countByCourse.get(key) || 0;
    const completed = completedByCourse.get(key) || 0;
    return {
      ...course.toJSON(),
      lessonCount,
      completedLessons: completed,
      progress: lessonCount ? Math.round((completed / lessonCount) * 100) : 0,
      hasAccess: isAdmin || accessByCourse.has(key),
    };
  });
}

/** GET /api/courses */
async function listCourses(req, res, next) {
  try {
    const courses = await Course.find().sort({ createdAt: 1 });
    res.json(await decorateCourses(courses, req.user));
  } catch (err) {
    next(err);
  }
}

/** GET /api/courses/:id */
async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const [decorated] = await decorateCourses([course], req.user);
    res.json(decorated);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCourses, getCourse };
