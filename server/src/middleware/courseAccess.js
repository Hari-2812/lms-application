const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const { courseAccessFor } = require('../services/enrolmentService');

/**
 * Gate for a course's lessons, video stream, progress and reviews. Lets
 * through staff, learners with Full Access, and learners with a live grant
 * for the course (admin-granted, paid or free) — see enrolmentService.
 */
function requireCourseAccess(resolveCourseId) {
  return async function (req, res, next) {
    try {
      const courseId = await resolveCourseId(req);
      if (!courseId || !mongoose.isValidObjectId(courseId)) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const access = await courseAccessFor(req.user, courseId);
      if (!access.allowed) {
        return res.status(403).json({
          error:
            access.reason === 'expired'
              ? 'Your access to this course has expired'
              : 'You do not have access to this course',
        });
      }

      req.courseId = courseId;
      req.courseAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** A lesson id from the request, or null when it is missing or malformed (→ 404, not a 500). */
async function courseOfLesson(lessonId) {
  if (!mongoose.isValidObjectId(lessonId)) return null;
  const lesson = await Lesson.findById(lessonId).select('courseId');
  return lesson?.courseId;
}

/** Resolvers for the routes that need them — kept next to the middleware that uses them. */
const resolveCourseId = {
  fromParam: (paramName) => (req) => req.params[paramName],
  fromBody: (fieldName) => (req) => req.body?.[fieldName],
  fromLessonParam: (paramName) => (req) => courseOfLesson(req.params[paramName]),
  fromLessonBody: (fieldName) => (req) => courseOfLesson(req.body?.[fieldName]),
};

module.exports = { requireCourseAccess, resolveCourseId };
