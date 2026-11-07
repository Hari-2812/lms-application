const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Progress = require('../models/Progress');
const CourseAccess = require('../models/CourseAccess');
const Enrollment = require('../models/Enrollment');
const ResourceAccess = require('../models/ResourceAccess');
const Review = require('../models/Review');
const { isGrantLive } = require('../services/enrolmentService');

/**
 * Attach lesson counts, this student's completion percentage, and whether
 * they currently have access, to each course. Computed here so the
 * dashboard needs one request instead of N.
 *
 * `student` is undefined for anonymous catalogue browsing (the course list
 * is public) — such requests get lesson counts but no progress and no access.
 *
 * `accessVia` says how a learner got in: 'staff', 'full' (Full Access) or
 * 'grant' (admin-granted, paid or free). `hasSelectedMaterials` marks a
 * course the learner cannot open but has been given some study materials from.
 *
 * Once a course has learner reviews, its rating is their real average; until
 * then the admin-entered catalogue rating (if any) is shown.
 */
async function decorateCourses(courses, student) {
  const courseIds = courses.map((c) => c._id);
  const isAdmin = student?.role === 'admin';
  const hasFullAccess = Boolean(student?.fullAccess);
  const needsGrants = student && !isAdmin && !hasFullAccess;

  const [lessonCounts, progressRows, accessRows, materialRows, reviewStats] = await Promise.all([
    Lesson.aggregate([
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]),
    student ? Progress.find({ studentId: student.id, courseId: { $in: courseIds } }).lean() : [],
    needsGrants
      ? CourseAccess.find({ studentId: student.id, courseId: { $in: courseIds }, active: true }).lean()
      : [],
    needsGrants ? ResourceAccess.distinct('courseId', { studentId: student.id, courseId: { $in: courseIds } }) : [],
    Review.aggregate([
      { $match: { courseId: { $in: courseIds }, hidden: false } },
      { $group: { _id: '$courseId', average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);
  const reviewsByCourse = new Map(reviewStats.map((r) => [String(r._id), r]));
  const materialCourses = new Set(materialRows.map(String));

  const countByCourse = new Map(lessonCounts.map((r) => [String(r._id), r.count]));
  const completedByCourse = new Map();
  for (const row of progressRows) {
    if (!row.completed) continue;
    const key = String(row.courseId);
    completedByCourse.set(key, (completedByCourse.get(key) || 0) + 1);
  }
  // Expired grants (Settings → access duration) no longer count as access.
  const accessByCourse = new Set(accessRows.filter(isGrantLive).map((r) => String(r.courseId)));

  return courses.map((course) => {
    const key = String(course._id);
    const lessonCount = countByCourse.get(key) || 0;
    const completed = completedByCourse.get(key) || 0;
    const accessVia = isAdmin ? 'staff' : hasFullAccess ? 'full' : accessByCourse.has(key) ? 'grant' : null;
    const reviews = reviewsByCourse.get(key);
    return {
      ...course.toJSON(),
      ...(reviews ? { rating: Math.round(reviews.average * 10) / 10, ratingCount: reviews.count } : {}),
      lessonCount,
      completedLessons: completed,
      progress: lessonCount ? Math.round((completed / lessonCount) * 100) : 0,
      hasAccess: Boolean(accessVia),
      accessVia,
      hasSelectedMaterials: !accessVia && materialCourses.has(key),
    };
  });
}

/** GET /api/courses */
async function listCourses(req, res, next) {
  try {
    // Draft courses are editable in the admin dashboard but stay out of the
    // student-facing catalogue. `$ne: false` rather than `true` so courses
    // created before the field existed keep showing up.
    const filter = req.user?.role === 'admin' ? {} : { published: { $ne: false } };

    const courses = await Course.find(filter).sort({ createdAt: 1 });
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
    if (course.published === false && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [decorated] = await decorateCourses([course], req.user);

    // The details page needs to tell "not enrolled" apart from "enrolled,
    // payment still being confirmed" so it can show the right call to action.
    if (req.user) {
      const enrollment = await Enrollment.findOne({ studentId: req.user._id, courseId: course._id });
      decorated.enrollmentStatus = enrollment?.status || null;
      // A pending Razorpay order is a checkout the learner can simply retry;
      // a pending manual one is waiting on an admin.
      decorated.enrollmentGateway = enrollment?.gateway || null;
    }

    res.json(decorated);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCourses, getCourse };
